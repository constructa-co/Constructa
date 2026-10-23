import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(path.resolve(import.meta.dirname, "../../../.github/workflows/e2e.yml"), "utf8");
function enabled(job: string, event: string, head: string) {
    const expression = workflow.match(new RegExp(`^  ${job}:\\n    (?:#[^\\n]*\\n    )*if: \\$\\{\\{ (.*?) \\}\\}`, "m"))?.[1];
    expect(expression).toBeDefined();
    const substituted = expression!.replaceAll("github.event_name", JSON.stringify(event)).replaceAll("github.head_ref", JSON.stringify(head));
    // Evaluate only the exact checked-in boolean expression, not application input.
    return Function(`"use strict";return (${substituted});`)() as boolean;
}

describe("explicit review-head hosted-write gate", () => {
    it.each(["backup/welcome-first-slice-20261018", "codex/phase1-integration-review-20261023"])("records NOT_RUN rather than automatic hosted writes for %s", head => {
        expect(enabled("hosted-write-status", "pull_request", head)).toBe(true);
        expect(enabled("phase1", "pull_request", head)).toBe(false);
    });
    it.each(["main", "feature/unrelated", "codex/phase1-integration-review-20261023-other"])("retains the original other-branch path for %s", head => {
        expect(enabled("hosted-write-status", "pull_request", head)).toBe(false);
        expect(enabled("phase1", "pull_request", head)).toBe(true);
    });
    it("retains separately authorised manual dispatch without calling it an execution", () => {
        expect(enabled("hosted-write-status", "workflow_dispatch", "")).toBe(false);
        expect(enabled("phase1", "workflow_dispatch", "")).toBe(true);
        expect(workflow).toContain("Hosted Phase 1 journey: NOT_RUN");
    });
});
