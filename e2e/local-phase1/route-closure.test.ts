import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NEW_PROJECT_PATH, PROPOSAL_READINESS_PATH, resolvePostSetupPath } from "../../src/lib/first-session";

describe("local Phase 1 company handoff route closure", () => {
    it("includes the actual destination of a first company introduction", () => {
        expect(resolvePostSetupPath(null, "/dashboard", true)).toBe(PROPOSAL_READINESS_PATH);
        expect(existsSync(path.join(process.cwd(), "src/app", PROPOSAL_READINESS_PATH, "page.tsx"))).toBe(true);
        expect(existsSync(path.join(process.cwd(), "src/app", PROPOSAL_READINESS_PATH, "readiness-client.tsx"))).toBe(true);
    });

    it("includes the next job-entry route without creating a job", () => {
        expect(NEW_PROJECT_PATH).toBe("/dashboard/projects/new");
        expect(existsSync(path.join(process.cwd(), "src/app", NEW_PROJECT_PATH, "page.tsx"))).toBe(true);
    });
});
