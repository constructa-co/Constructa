import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { EVAL_CASES } from "./cases";
import { renderReport, runEvaluation, type EvalOutcome } from "./run";

/**
 * The canned evaluation, as a test. `npm run eval:cohort-ai` runs this same
 * file with EVAL_WRITE=1, which also writes the report into the evidence
 * folder. Nothing here calls a provider.
 *
 * The two lists below are the checks' known limits, pinned by name. A change
 * that lets another unfaithful reply through, or refuses another faithful
 * one, fails here until the list and the report are updated on purpose.
 */
const KNOWN_MISSES: string[] = [
    "brief-injection-discount", "brief-adds-materials-claim", "brief-invents-start-date",
    "wording-adds-credentials", "wording-drops-exclusion",
    "study-reverses-meaning", "study-moves-fact",
    "programme-blames-weather", "programme-swaps-status",
];
const FALSE_REJECTIONS: string[] = ["brief-word-to-digit", "wording-word-to-digit", "study-word-to-digit", "programme-signed-team", "programme-counts-stages"];

describe("cohort AI text features: canned evaluation", () => {
    let outcomes: EvalOutcome[] = [];

    beforeAll(async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        outcomes = await runEvaluation();
        if (process.env.EVAL_WRITE === "1") {
            const dir = path.resolve(__dirname, "../../../../docs/evidence/cohort-ai-bounds");
            mkdirSync(dir, { recursive: true });
            writeFileSync(path.join(dir, "EVALUATION.md"), renderReport(outcomes));
        }
    });

    it("covers all four features with faithful, unfaithful and failed replies", () => {
        for (const feature of ["brief.suggest", "proposal.wording", "case-studies.enhance", "schedule.programme-update"]) {
            for (const kind of ["faithful", "unfaithful", "no reply"]) {
                if (feature === "case-studies.enhance" && kind === "no reply") continue;
                expect(EVAL_CASES.some((testCase) => testCase.feature === feature && testCase.kind === kind), `${feature} ${kind}`).toBe(true);
            }
        }
        expect(new Set(EVAL_CASES.map((testCase) => testCase.id)).size).toBe(EVAL_CASES.length);
    });

    it("lets through exactly the unfaithful replies openly listed as known misses", () => {
        expect(outcomes.filter((entry) => entry.knownMiss).map((entry) => entry.id).sort()).toEqual([...KNOWN_MISSES].sort());
    });

    it("refuses exactly the faithful replies openly listed as false rejections", () => {
        expect(outcomes.filter((entry) => entry.falseRejection).map((entry) => entry.id).sort()).toEqual([...FALSE_REJECTIONS].sort());
    });

    it("makes one call per case, records every one, and shows nothing when the provider fails", () => {
        for (const entry of outcomes) {
            expect(entry.providerCalls, entry.id).toBe(1);
            expect(entry.attempt, entry.id).not.toBeNull();
            if (entry.kind === "no reply") expect(entry.shown, entry.id).toBe(false);
            if (!entry.shown) expect(entry.message, entry.id).toBeTruthy();
            expect(entry.attempt === "ok", entry.id).toBe(entry.shown);
        }
    });

    it("gives the same report every time, and the report says what it is not", async () => {
        const again = renderReport(await runEvaluation());
        expect(again).toBe(renderReport(outcomes));
        expect(again).toContain("It is not evidence about what a real model writes");
        expect(again).toContain("Provider calls made by a real provider: 0.");
        expect(again).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
    });
});
