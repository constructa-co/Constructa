import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATIONS = join(process.cwd(), "supabase/migrations");
const V1 = "20261026110000_project_working_pattern.sql";
const V2 = "20261029103000_project_working_pattern_v2.sql";
const GRANT_FILE = "20261030220000_programme_working_pattern_execute_grant.sql";
const CLOSING = "20261028183000_new_job_closing_prefill.sql";
const TARGET = "public.valid_programme_working_pattern(jsonb)";

const read = (file: string) => readFileSync(join(MIGRATIONS, file), "utf8");
const statements = (sql: string) => sql.replace(/--.*$/gm, "").split(";").map(part => part.replace(/\s+/g, " ").trim()).filter(Boolean);
const grantsOnTarget = () => readdirSync(MIGRATIONS).filter(file =>
    statements(read(file)).some(statement => /^(GRANT|REVOKE)\b/i.test(statement) && statement.includes("valid_programme_working_pattern")));

/**
 * A059 real QA failure: SQLSTATE 42501 on valid_programme_working_pattern for
 * authenticated programme saves and new-job creation. These read the migration
 * source only. They do not prove the grant is applied to any database.
 */
describe("programme working pattern EXECUTE grant (migration source)", () => {
    it("exactly one new migration, ordered after v1 and v2, grants on the validator", () => {
        expect(grantsOnTarget()).toEqual([GRANT_FILE]);
        expect([V1, V2, GRANT_FILE]).toEqual([V1, V2, GRANT_FILE].slice().sort());
    });

    it("grants EXECUTE on only this signature, to only authenticated, and does nothing else", () => {
        expect(statements(read(GRANT_FILE))).toEqual([
            "BEGIN",
            `GRANT EXECUTE ON FUNCTION ${TARGET} TO authenticated`,
            "COMMIT",
        ]);
    });

    it("the already-applied v1 and v2 migrations are byte-for-byte unchanged", () => {
        const sha256 = (file: string) => createHash("sha256").update(readFileSync(join(MIGRATIONS, file))).digest("hex");
        expect(sha256(V1)).toBe("3da285de997961b207d075bb97f841ef1cb63040471cfc55a73aef68665366f9");
        expect(sha256(V2)).toBe("809c218cce9b990ab38059dda023fe3beca21ee6cc3b7fc9515fcc94ebacf0bf");
    });

    it("the validator stays SECURITY INVOKER and still backs the projects CHECK", () => {
        const v1 = read(V1);
        const validator = v1.slice(v1.indexOf("CREATE FUNCTION public.valid_programme_working_pattern"), v1.indexOf("ALTER TABLE public.projects"));
        expect(validator).toMatch(/LANGUAGE sql IMMUTABLE PARALLEL SAFE/);
        expect(validator).not.toMatch(/SECURITY DEFINER/);
        expect(read(V2)).not.toMatch(/SECURITY DEFINER/);
        expect(v1).toMatch(/CONSTRAINT projects_working_pattern_valid CHECK \(public\.valid_programme_working_pattern\(programme_working_pattern\)\)/);
    });

    it("new-job creation writes projects as the invoking authenticated user, so it needs the same grant", () => {
        const closing = read(CLOSING);
        expect(closing).toMatch(/SECURITY INVOKER/);
        expect(closing).toMatch(/GRANT EXECUTE ON FUNCTION public\.create_phase1_project_graph\(uuid, jsonb, jsonb\)\s+TO authenticated;/);
        expect(closing).toMatch(/REVOKE ALL ON FUNCTION public\.create_phase1_project_graph\(uuid, jsonb, jsonb\)\s+FROM PUBLIC, anon;/);
    });
});
