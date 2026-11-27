import { describe, expect, it } from "vitest";
import { estimateSuggestedPhases, plannerReviewStageIndexes } from "./planner-phases";
import { computeProgrammePlan, draftPlanCoversEveryPhase, planCoversEveryPhase } from "./programme-plan";

const FIVE_DAY = { version: 1 as const, weekdays: [1, 2, 3, 4, 5] };
const MONDAY = "2026-11-02";

describe("CON-028 meaningful regenerate phases from estimate work", () => {
    it("builds one stage per trade section from labour hours", () => {
        const estimate = {
            estimate_lines: [
                { trade_section: "Groundworks", quantity: 1, estimate_line_components: [{ total_manhours: 40 }] },
                { trade_section: "Roofing", quantity: 2, estimate_line_components: [{ total_manhours: 8 }] },
            ],
        };
        const phases = estimateSuggestedPhases(estimate, 5, MONDAY, FIVE_DAY);
        expect(phases.map(p => p.name)).toEqual(["Groundworks", "Roofing"]);
        expect(phases[0]).toMatchObject({ calculatedDays: 5, manhours: 40 });
        expect(phases[1]).toMatchObject({ calculatedDays: 2, manhours: 16 });
    });

    it("keeps a named stage with no length, flagged for review, when lines have no labour hours", () => {
        const estimate = {
            estimate_lines: [
                { trade_section: "Drawing items", quantity: 4, estimate_line_components: [] },
            ],
        };
        const [phase] = estimateSuggestedPhases(estimate, 5, MONDAY, FIVE_DAY);
        // No stand-in five-day length that could be saved and sent as if it were worked out.
        expect(phase).toMatchObject({ name: "Drawing items", calculatedDays: 0, manualDays: null, manhours: 0, needsReview: true });
    });

    it("A061 stays unresolved for a proposal until the contractor sets its days", () => {
        const estimate = {
            estimate_lines: [
                { trade_section: "Groundworks", quantity: 1, estimate_line_components: [{ total_manhours: 40 }] },
                { trade_section: "Drawing items", quantity: 4, estimate_line_components: [] },
            ],
        };
        const suggested = estimateSuggestedPhases(estimate, 5, MONDAY, FIVE_DAY);
        expect(suggested[0]).toMatchObject({ name: "Groundworks", calculatedDays: 5, manhours: 40 });
        expect(suggested[0].needsReview).toBeUndefined();
        expect(plannerReviewStageIndexes(suggested)).toEqual([1]);
        // Draft storage may keep it while the contractor works; a proposal may not use it.
        const unresolved = computeProgrammePlan(MONDAY, suggested, FIVE_DAY);
        expect(draftPlanCoversEveryPhase(unresolved, suggested)).toBe(true);
        expect(planCoversEveryPhase(unresolved, suggested)).toBe(false);

        // The contractor's own figure resolves it through the existing manual-days field.
        const reviewed = suggested.map((phase, index) => (index === 1 ? { ...phase, manualDays: 3 } : phase));
        expect(plannerReviewStageIndexes(reviewed)).toEqual([]);
        expect(planCoversEveryPhase(computeProgrammePlan(MONDAY, reviewed, FIVE_DAY), reviewed)).toBe(true);
    });

    it("does not invent a stage from a lone filing label without lines", () => {
        expect(estimateSuggestedPhases({ estimate_lines: [] }, 5, MONDAY, FIVE_DAY)).toEqual([]);
    });
});