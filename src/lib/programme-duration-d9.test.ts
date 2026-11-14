import { describe, expect, it } from "vitest";
import { estimateSuggestedPhases, plannerReviewStageIndexes, sequencePlannerPhases, type PlannerEstimate } from "./planner-phases";
import { computeProgrammePlan, phaseWorkingDays } from "./programme-plan";

const v2Pattern = (standardMinutesPerDay: number) => ({
    version: 2 as const,
    timezone: "Europe/London",
    weekdays: [1, 2, 3, 4, 5],
    intervals: [1, 2, 3, 4, 5].map(weekday => ({ weekday, startMinute: 480, endMinute: 480 + standardMinutesPerDay })),
    standardMinutesPerDay,
    productivityPct: 100,
});

const estimateWith = (quantity: number | null, hours: number): PlannerEstimate => ({
    estimate_lines: [{ trade_section: "Tiling", quantity, estimate_line_components: [{ total_manhours: hours }] }],
});

describe("D9: suggested stage length uses the job's productive day", () => {
    it("keeps 8 hours per day without an explicit capacity", () => {
        expect(estimateSuggestedPhases(estimateWith(1, 24), 5)[0].calculatedDays).toBe(3);
    });

    it("uses standardMinutesPerDay from a v2 pattern", () => {
        // 24 hours at 6 productive hours a day is 4 days, not 3.
        expect(estimateSuggestedPhases(estimateWith(1, 24), 5, "2026-11-02", v2Pattern(360))[0].calculatedDays).toBe(4);
        // 24 hours at 10 productive hours a day rounds up to 3 days.
        expect(estimateSuggestedPhases(estimateWith(1, 24), 5, "2026-11-02", v2Pattern(600))[0].calculatedDays).toBe(3);
    });

    it("treats quantity 0 as zero duration flagged for review", () => {
        const [stage] = estimateSuggestedPhases(estimateWith(0, 12), 5);
        expect(stage).toMatchObject({ name: "Tiling", calculatedDays: 0, manualDays: null, manhours: 0, needsReview: true });
    });

    it("still treats a missing quantity as one and does not flag it", () => {
        const [stage] = estimateSuggestedPhases(estimateWith(null, 16), 5);
        expect(stage.calculatedDays).toBe(2);
        expect(stage.needsReview).toBeUndefined();
    });

    it("places a zero-duration stage without advancing the next stage", () => {
        const placed = sequencePlannerPhases([
            { name: "A", calculatedDays: 2, manualDays: null },
            { name: "Check me", calculatedDays: 0, manualDays: null },
            { name: "B", calculatedDays: 1, manualDays: null },
        ], "2026-11-02", undefined);
        expect(placed?.map(phase => phase.startOffset)).toEqual([0, 2, 2]);
    });
});

describe("D9: zero-length stage review flag", () => {
    const flagged = { name: "Check me", calculatedDays: 0, manualDays: null, manhours: 0, startOffset: 0, needsReview: true };
    const sized = { name: "A", calculatedDays: 2, manualDays: null, manhours: 16, startOffset: 0 };

    it("lists a flagged stage the dated plan would drop", () => {
        expect(plannerReviewStageIndexes([sized, flagged])).toEqual([1]);
        // The dated plan leaves the stage out, which is why the flag must show first.
        expect(computeProgrammePlan("2026-11-02", [sized, flagged])?.stages).toHaveLength(1);
    });

    it("clears once the contractor sets days", () => {
        expect(plannerReviewStageIndexes([sized, { ...flagged, manualDays: 3 }])).toEqual([]);
    });

    it("ignores stages that were never flagged", () => {
        expect(plannerReviewStageIndexes([sized, { ...sized, name: "Zero", calculatedDays: 0 }])).toEqual([]);
    });
});

describe("D9: manual days", () => {
    it("rounds fractional manual days up", () => {
        expect(phaseWorkingDays({ manualDays: 2.2, calculatedDays: 9 })).toBe(3);
        expect(phaseWorkingDays({ manualDays: 0.5 })).toBe(1);
    });

    it("preserves an explicit zero instead of falling back to calculated days", () => {
        expect(phaseWorkingDays({ manualDays: 0, calculatedDays: 9 })).toBe(0);
    });

    it("falls back to calculated days when manual days are absent or invalid", () => {
        expect(phaseWorkingDays({ manualDays: null, calculatedDays: 4 })).toBe(4);
        expect(phaseWorkingDays({ calculatedDays: 4 })).toBe(4);
        expect(phaseWorkingDays({ manualDays: -3, calculatedDays: 4 })).toBe(4);
    });
});

describe("D9: v2 programme working_days with overlapping stages", () => {
    const overlapping = [
        { name: "A", manualDays: 5, calculatedDays: 5, startOffset: 0 },
        { name: "B", manualDays: 5, calculatedDays: 5, startOffset: 0 },
    ];

    it("does not double count days both stages cover", () => {
        const plan = computeProgrammePlan("2026-11-02", overlapping, v2Pattern(480));
        expect(plan?.working_days).toBe(5);
        expect(plan?.stages.map(stage => stage.working_days)).toEqual([5, 5]);
    });

    it("matches the v1 programme total for the same overlap", () => {
        expect(computeProgrammePlan("2026-11-02", overlapping)?.working_days).toBe(5);
    });

    it("counts the exact union of overlaps and gaps, not the sum or the span", () => {
        const phases = [
            // Mon 2 Nov to Wed 4 Nov
            { name: "A", manualDays: 3, calculatedDays: 3, startOffset: 0 },
            // Tue 3 Nov to Thu 5 Nov: overlaps A on two days, so together they cover Mon to Thu.
            { name: "B", manualDays: 3, calculatedDays: 3, startOffset: 1 },
            // Mon 16 Nov to Tue 17 Nov: a clear gap of 7 working days after B.
            { name: "C", manualDays: 2, calculatedDays: 2, startOffset: 14 },
        ];
        const plan = computeProgrammePlan("2026-11-02", phases, v2Pattern(480));
        // Union is 4 + 2. The sum would be 8 and the start-to-finish span 12.
        expect(plan?.working_days).toBe(6);
        expect(plan?.stages.map(stage => stage.working_days)).toEqual([3, 3, 2]);
        expect(plan?.start_date).toBe("2026-11-02");
        expect(plan?.end_date).toBe("2026-11-17");
    });

    it("does not count weekend days when an overlap crosses a weekend", () => {
        const phases = [
            { name: "A", manualDays: 5, calculatedDays: 5, startOffset: 0 },
            // Fri 6 Nov, Mon 9 Nov, Tue 10 Nov: shares only Friday with A.
            { name: "B", manualDays: 3, calculatedDays: 3, startOffset: 4 },
        ];
        expect(computeProgrammePlan("2026-11-02", phases, v2Pattern(480))?.working_days).toBe(7);
    });

    it("counts a gap between stages as no working days", () => {
        const phases = [
            { name: "A", manualDays: 2, calculatedDays: 2, startOffset: 0 },
            { name: "B", manualDays: 2, calculatedDays: 2, startOffset: 14 },
        ];
        expect(computeProgrammePlan("2026-11-02", phases, v2Pattern(480))?.working_days).toBe(4);
    });

    it("still sums sequential stages", () => {
        const sequential = [
            { name: "A", manualDays: 3, calculatedDays: 3, startOffset: 0 },
            { name: "B", manualDays: 2, calculatedDays: 2, startOffset: 3 },
        ];
        expect(computeProgrammePlan("2026-11-02", sequential, v2Pattern(480))?.working_days).toBe(5);
    });
});
