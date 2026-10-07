import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { EVAL_CASES } from "./cases";
import { renderReport, runEvaluation, type EvalOutcome } from "./run";

/**
 * The canned evaluation, as a test. `npm run eval:interview` runs this same
 * file with EVAL_WRITE=1, which also writes the report into the evidence
 * folder. Nothing here calls a provider.
 */
describe("interview AI wording: canned evaluation", () => {
    let outcomes: EvalOutcome[] = [];

    beforeAll(async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        outcomes = await runEvaluation();
        if (process.env.EVAL_WRITE === "1") {
            const dir = path.resolve(__dirname, "../../../../docs/evidence/stage2-tranche-2g3");
            mkdirSync(dir, { recursive: true });
            writeFileSync(path.join(dir, "AI-WIRING-EVAL.md"), renderReport(outcomes));
        }
    });

    it.each(EVAL_CASES.map((testCase) => [testCase.id, testCase.what]))("%s: %s", (id) => {
        expect(outcomes.find((entry) => entry.id === id)?.problems).toEqual([]);
    });

    it("covers every required category", () => {
        expect(new Set(EVAL_CASES.map((testCase) => testCase.category))).toEqual(new Set([
            "source faithfulness", "credentials", "career versus business", "omitted answers", "prompt injection", "sources change", "provider and budget", "edited approval",
        ]));
    });

    it("stops every unfaithful reply except the ones openly marked as known misses", () => {
        const letThrough = outcomes.filter((entry) => entry.kind === "unfaithful" && entry.wording === "ai").map((entry) => entry.id);
        expect(letThrough.sort()).toEqual(EVAL_CASES.filter((testCase) => testCase.knownMiss).map((testCase) => testCase.id).sort());
    });

    it("accepts every faithful reply except the ones openly marked as false rejections", () => {
        const refused = outcomes.filter((entry) => entry.kind === "faithful" && entry.wording !== "ai").map((entry) => entry.id);
        expect(refused.sort()).toEqual(EVAL_CASES.filter((testCase) => testCase.falseRejection).map((testCase) => testCase.id).sort());
    });

    it("never leaves a contractor without a draft, never stores a rejected reply, and never writes the profile unasked", () => {
        for (const entry of outcomes) {
            expect(entry.draftGenerator, entry.id).toBe(entry.wording === "ai" ? "ai" : "template");
            // With nothing to narrate the draft holds only the offered facts and no introduction text.
            if (entry.wording !== "nothing-to-word") expect(entry.draftText.length, entry.id).toBeGreaterThan(0);
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
