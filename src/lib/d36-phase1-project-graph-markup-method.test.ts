import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATIONS = join(process.cwd(), "supabase/migrations");
const D36_COLUMNS = "20261115120000_d36_markup_method.sql";
const A069_BASE = "20261028183000_new_job_closing_prefill.sql";
const D36_RPC = "20261116140000_d36_phase1_project_graph_markup_method.sql";
const START = "CREATE OR REPLACE FUNCTION public.create_phase1_project_graph(";

const read = (file: string) => readFileSync(join(MIGRATIONS, file), "utf8");
const sql = read(D36_RPC);
const definition = (() => {
    const start = sql.indexOf(START);
    const end = sql.indexOf("$$;", start);
    if (start < 0 || end < 0) throw new Error("definition not found");
    return sql.slice(start, end + 3);
})();

describe("D36 blank-project graph RPC markup_method (migration source, no database)", () => {
    it("adds one migration after the markup columns and the A069 closing redefine", () => {
        const names = readdirSync(MIGRATIONS).filter((name) => name.endsWith(".sql")).sort();
        const idx = names.indexOf(D36_RPC);
        expect(idx).toBeGreaterThan(names.indexOf(D36_COLUMNS));
        expect(idx).toBeGreaterThan(names.indexOf(A069_BASE));
        expect(names.filter((name) => read(name).includes(START))).toEqual(
            expect.arrayContaining([A069_BASE, D36_RPC]),
        );
    });

    it("redefines only the creation function: no table changes or backfill", () => {
        const stripped = sql.replace(/--.*$/gm, "");
        expect(stripped).not.toMatch(/\bUPDATE\s+public\.estimates\b/i);
        expect(stripped).not.toMatch(/\bALTER\s+TABLE\b/i);
        expect(sql).toMatch(/BEGIN;/);
        expect(sql).toMatch(/COMMIT;/);
    });

    it("reads the company choice once and writes markup_method on each new estimate insert", () => {
        expect(definition).toContain("v_markup_method text;");
        expect(definition).toMatch(/SELECT p\.markup_method\s+INTO v_markup_method\s+FROM public\.profiles p/);
        expect(definition).toMatch(/v_markup_method IS NULL OR v_markup_method NOT IN \('on_net', 'compound'\)/);
        const insert = definition.slice(
            definition.indexOf("INSERT INTO public.estimates"),
            definition.indexOf("RETURNING id INTO v_estimate_id", definition.indexOf("INSERT INTO public.estimates")),
        );
        expect(insert).toMatch(/markup_method/);
        expect(insert).toMatch(/WHEN v_estimate->>'markup_method' IN \('on_net', 'compound'\)/);
    });

    it("does not read the profile on an idempotent retry of an existing job", () => {
        const retryReturn = definition.indexOf("AND p.creation_request_id = p_request_id");
        const markupRead = definition.indexOf("SELECT p.markup_method");
        expect(retryReturn).toBeLessThan(markupRead);
        expect(definition).not.toMatch(/UPDATE public\.projects/i);
    });

    it("keeps the authenticated grants on the redefined function", () => {
        expect(sql).toContain("REVOKE ALL ON FUNCTION public.create_phase1_project_graph(uuid, jsonb, jsonb)\n    FROM PUBLIC, anon;");
        expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.create_phase1_project_graph(uuid, jsonb, jsonb)\n    TO authenticated;");
    });
});