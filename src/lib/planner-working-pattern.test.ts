import { describe, expect, it } from "vitest";
import { computeProgrammePlan } from "./programme-plan";
import { plannerDisplayPlan, plannerPhaseSpan, plannerPhasesOnOpen, sequencePlannerPhases, sequenceSuggestedPhases, type PlannerPhase } from "./planner-phases";

const friday = "2026-10-16";
const phase = (name: string, days = 2): PlannerPhase => ({ name, calculatedDays: 99, manualDays: days, manhours: 12, startOffset: 0, color: "blue", pct_complete: 20 });
const patterns = [[1, 2, 3, 4, 5], [1, 2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5, 6]];

describe("detailed planner saved job calendar", () => {
    it.each(patterns.map(weekdays => ({ weekdays })))("uses the canonical saved weekdays $weekdays for every displayed span", ({ weekdays }) => {
        const pattern = { version: 1, weekdays }, phases = [phase("Works")];
        const plan = plannerDisplayPlan(friday, phases, weekdays.length, pattern)!;
        expect(plan).toEqual(computeProgrammePlan(friday, phases, pattern));
        expect(plan.end_date).toBe(weekdays.length === 5 ? "2026-10-19" : "2026-10-17");
        expect(plannerPhaseSpan(friday, phases[0], pattern)).toEqual({ startOffset: 0, calendarDays: weekdays.length === 5 ? 4 : 2 });
    });

    it.each(patterns.map(weekdays => ({ weekdays })))("sequences without invented weekly gaps using weekdays $weekdays, preserving manual duration and metadata", ({ weekdays }) => {
        const pattern = { version: 1, weekdays }, input = [phase("First"), phase("Next", 1)];
        const before = JSON.stringify(input), rows = sequencePlannerPhases(input, friday, pattern)!;
        expect(rows[1].startOffset).toBe(weekdays.length === 5 ? 4 : weekdays.length === 6 ? 3 : 2);
        expect(rows[0]).toEqual({ ...input[0], startOffset: 0 });
        expect(rows[1]).toMatchObject({ name: "Next", manualDays: 1, calculatedDays: 99, color: "blue", pct_complete: 20, manhours: 12 });
        expect(JSON.stringify(input)).toBe(before);
        expect(computeProgrammePlan(friday, rows, pattern)?.stages).toHaveLength(2);
    });

    it("opens saved phases byte-exact and does not resequence or save suggestions by showing them", () => {
        const saved = [phase("Saved")], pattern = { version: 1, weekdays: [1, 2, 3, 4, 5, 6] };
        expect(plannerPhasesOnOpen(saved, null, 6, friday, pattern).phases).toBe(saved);
        expect(sequenceSuggestedPhases([phase("General"), phase("Next", 1)], 6, friday, pattern)).toMatchObject([{ startOffset: 0 }, { startOffset: 3 }]);
    });

    it("rejects invalid saved patterns, incomplete and overflowing dates instead of displaying a partial canonical plan", () => {
        expect(plannerDisplayPlan(friday, [phase("Bad")], 6, { version: 1, weekdays: [] })).toBeNull();
        expect(sequencePlannerPhases([phase("Bad")], friday, { version: 1, weekdays: [] })).toBeNull();
        expect(plannerDisplayPlan(friday, [phase("Good"), { ...phase("No duration", 0), calculatedDays: 0 }], 6, { version: 1, weekdays: [1, 2, 3, 4, 5, 6] })).toBeNull();
        expect(sequencePlannerPhases([phase("Overflow", 100_000_002)], "9999-12-31", { version: 1, weekdays: [0, 1, 2, 3, 4, 5, 6] })).toBeNull();
    });
});
