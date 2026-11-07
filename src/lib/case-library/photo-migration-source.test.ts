import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CASE_LIBRARY_DRAFT_PHOTOS_ON_WIRE } from "./content";
import { emptyPhotoSlots, storedPhotoSlotsProblem } from "./photos";

/**
 * A038: source contract of the unapplied photos migration. Reads text only: no
 * database is involved, so this says nothing about how Postgres behaves. That
 * is `scripts/test-case-library-sql.sh`.
 */
const ROOT = path.resolve(__dirname, "../../..");
const migration = readFileSync(path.join(ROOT, "supabase/migrations/20261028120000_case_library_photos.sql"), "utf8");
const script = readFileSync(path.join(ROOT, "scripts/test-case-library-sql.sh"), "utf8");
const sql = migration.replace(/^\s*--.*$/gm, "");

const photoVectors = JSON.parse(script.match(/<<'JSON'\n([\s\S]*?)\nJSON\n/)![1]) as Array<[string, unknown, string | null]>;

describe("the photos migration's order", () => {
    it("locks writers out first, replaces the rules, carries the rows, then checks them, all in one transaction", () => {
        const steps = [
            "BEGIN;",
            "LOCK TABLE public.case_studies IN SHARE ROW EXCLUSIVE MODE;",
            "CREATE OR REPLACE FUNCTION public.case_library_content_problem",
            "REVOKE ALL ON FUNCTION public.case_library_photos_ok(jsonb)",
            "UPDATE public.case_studies",
            "RAISE EXCEPTION",
            "COMMIT;",
        ].map((step) => sql.indexOf(step));
        expect(steps).not.toContain(-1);
        expect(steps).toEqual([...steps].sort((a, b) => a - b));
    });

    it("carries the draft and the approved copy in one write, and moves nothing else", () => {
        const update = sql.slice(sql.indexOf("UPDATE public.case_studies"), sql.indexOf("DO $$"));
        expect(update).toContain("SET draft =");
        expect(update).toContain("approved = CASE WHEN approved IS NOT NULL");
        expect(update).not.toMatch(/\b(revision|approved_revision|approved_at|updated_at|user_id)\s*=/);
    });

    it("gives the two new rules the same privileges as every other rule", () => {
        for (const rule of ["case_library_photo_slot_ok", "case_library_photos_ok"]) {
            expect(sql).toContain(`REVOKE ALL ON FUNCTION public.${rule}(jsonb) FROM PUBLIC, anon, authenticated;`);
            expect(sql).toContain(`GRANT EXECUTE ON FUNCTION public.${rule}(jsonb) TO service_role;`);
        }
        expect(sql).not.toMatch(/SECURITY DEFINER/i);
        expect(sql.match(/GRANT /g)).toHaveLength(2);
    });

    it("writes the empty slots the application writes", () => {
        const literal = sql.match(/'(\{"photos":.*?\})'::jsonb/)![1];
        expect(JSON.parse(literal)).toEqual({ photos: emptyPhotoSlots() });
    });

    it("is released with a build that sends thirteen keys, not by itself", () => {
        expect(migration).toContain("have to be released together");
        expect(CASE_LIBRARY_DRAFT_PHOTOS_ON_WIRE).toBe(false);
    });
});

describe("the SQL test script", () => {
    it("seeds twelve-key rows between the two migrations, so the transition has something real to carry", () => {
        const foundation = script.indexOf('-f "$MIGRATION"');
        const seed = script.indexOf("CREATE TABLE t.legacy_rows");
        const photos = script.indexOf('-f "$PHOTO_MIGRATION"');
        expect(foundation).toBeGreaterThan(-1);
        expect(seed).toBeGreaterThan(foundation);
        expect(photos).toBeGreaterThan(seed);
    });

    it.each(photoVectors)("holds the application's strict rule to the same answer: %s", (_name, photos, problem) => {
        expect(storedPhotoSlotsProblem(photos)).toBe(problem);
    });
});
