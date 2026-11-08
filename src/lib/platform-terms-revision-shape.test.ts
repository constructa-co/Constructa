import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PLATFORM_TERMS_CURRENT_REVISION, PLATFORM_TERMS_DOCUMENT_ID, PLATFORM_TERMS_RECOGNIZED_REVISIONS } from "./platform-terms";

/**
 * A023 offline source check (static text of the unapplied migration; NOT Postgres, NOT a QA database).
 * Pins what a sign-up records and the shape any approved new wording must change.
 * See docs/delivery/2026-11-08/claude-batch2-handoff.md section 3.
 */
const SQL = readFileSync(join(process.cwd(), "supabase/migrations/20261024122500_platform_terms_acceptance.sql"), "utf8");
const code = SQL.split("\n").filter(line => !line.trimStart().startsWith("--")).join("\n");

describe("A023 platform terms acceptance: source shape of what is recorded", () => {
    it("the migration's revision CHECK lists exactly the application's recognised revisions", () => {
        const match = /accepted_revision IN \(([^)]*)\)/.exec(code);
        expect(match).not.toBeNull();
        const listed = [...match![1].matchAll(/'([^']+)'/g)].map(item => item[1]);
        expect(listed).toEqual([...PLATFORM_TERMS_RECOGNIZED_REVISIONS]);
        expect(listed).toContain(PLATFORM_TERMS_CURRENT_REVISION);
    });

    it("the migration's document CHECK matches the application's document id", () => {
        expect(code).toContain(`terms_document = '${PLATFORM_TERMS_DOCUMENT_ID}'`);
    });

    it("stores only user, document, revision and a database-stamped time: no wording, hash, address, agent, locale or source", () => {
        const table = /CREATE TABLE public\.platform_terms_acceptances \(([\s\S]*?)\n\);/.exec(code)![1];
        const columns = table.split("\n").map(line => line.trim()).filter(line => /^[a-z_]+ (uuid|text|timestamptz)/.test(line)).map(line => line.split(" ")[0]);
        expect(columns).toEqual(["id", "user_id", "terms_document", "accepted_revision", "accepted_at"]);
        expect(code).toMatch(/accepted_at timestamptz NOT NULL DEFAULT now\(\)/);
    });

    it("clients may insert only the three named columns and may never update or delete (so a record is immutable from the app)", () => {
        expect(code).toContain("GRANT INSERT (user_id, terms_document, accepted_revision)");
        expect(code).not.toMatch(/GRANT\s+(UPDATE|DELETE)/i);
        expect(code).not.toMatch(/service_role/);
    });

    it("RECORDED GAP: one row per (user, document), so a later approved revision cannot be recorded next to the March 2026 row", () => {
        // Under this constraint a second revision for the same user hits 23505, which the recorder reports as
        // "already-recorded". Approved new wording therefore needs the uniqueness widened to include the revision.
        expect(code).toMatch(/platform_terms_acceptances_one_current_record UNIQUE \(user_id, terms_document\)/);
        expect(code).not.toMatch(/UNIQUE \(user_id, terms_document, accepted_revision\)/);
        expect(PLATFORM_TERMS_RECOGNIZED_REVISIONS).toHaveLength(1);
    });
});
