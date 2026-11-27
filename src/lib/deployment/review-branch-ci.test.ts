import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(path.resolve(import.meta.dirname, "../../../.github/workflows/e2e.yml"), "utf8");
function enabled(job: string, values: Record<string, string | boolean> = {}) {
    const block = workflow.split(`  ${job}:\n`)[1]?.split(/\n  [a-z][a-z0-9-]*:/)[0];
    const expression = block?.match(/^    if: \$\{\{ (.*?) \}\}/m)?.[1];
    expect(expression).toBeDefined();
    const defaults = {
        "github.event_name": "pull_request",
        "inputs.verified_isolated_target": false,
        "inputs.verified_isolated_project_ref": "",
        "vars.E2E_SUPABASE_PROJECT_REF": "",
        "needs.verify-isolated-target.outputs.verified": "",
        ...values,
    };
    let substituted = expression!.replaceAll("always()", "true");
    for (const [key, value] of Object.entries(defaults)) {
        substituted = substituted.replaceAll(key, JSON.stringify(value));
    }
    // Evaluate only the checked-in boolean expression, never application input.
    return Function(`"use strict";return (${substituted});`)() as boolean;
}

const verifiedManual = {
    "github.event_name": "workflow_dispatch",
    "inputs.verified_isolated_target": true,
    "inputs.verified_isolated_project_ref": "isolated-example",
    "vars.E2E_SUPABASE_PROJECT_REF": "isolated-example",
};

describe("verified isolated hosted-write gate", () => {
    it("never verifies or runs hosted writes on pull requests, even with matching configuration", () => {
        expect(enabled("verify-isolated-target", { ...verifiedManual, "github.event_name": "pull_request" })).toBe(false);
        expect(enabled("phase1")).toBe(false);
        expect(enabled("hosted-write-status")).toBe(true);
        expect(workflow).not.toContain("github.event.pull_request.draft");
        expect(workflow).not.toContain("github.head_ref");
    });
    it.each([
        {},
        { "inputs.verified_isolated_target": false },
        { "inputs.verified_isolated_project_ref": "" },
        { "vars.E2E_SUPABASE_PROJECT_REF": "" },
        { "inputs.verified_isolated_project_ref": "wrong-target" },
    ])("does not opt into a manual verification with absent or mismatched consent/target: %j", override => {
        const values = Object.keys(override).length ? { ...verifiedManual, ...override } : { "github.event_name": "workflow_dispatch" };
        expect(enabled("verify-isolated-target", values)).toBe(false);
    });
    it("requires existing configuration validation before the hosted job is eligible", () => {
        expect(enabled("verify-isolated-target", verifiedManual)).toBe(true);
        expect(workflow).toContain("verified: ${{ steps.configuration.outcome == 'success' }}");
        expect(workflow).toContain("run: npx playwright test --list");
        for (const verified of ["", "false"]) {
            expect(enabled("phase1", { "needs.verify-isolated-target.outputs.verified": verified })).toBe(false);
            expect(enabled("hosted-write-status", { "needs.verify-isolated-target.outputs.verified": verified })).toBe(true);
        }
        expect(enabled("phase1", { "needs.verify-isolated-target.outputs.verified": "true" })).toBe(true);
        expect(enabled("hosted-write-status", { "needs.verify-isolated-target.outputs.verified": "true" })).toBe(false);
        expect(workflow).toContain("Hosted Phase 1 journey: SKIPPED, not PASS");
    });
});
