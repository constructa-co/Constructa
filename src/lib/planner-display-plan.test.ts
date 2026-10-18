import { describe, expect, it } from "vitest";
import { plannerDisplayPlan, type PlannerPhase } from "./planner-phases";
import { computeProgrammePlan } from "./programme-plan";

function phase(name: string, startOffset: number, days = 5): PlannerPhase {
    return { name, startOffset, calculatedDays: days, manualDays: null, manhours: 0 };
}

describe("planner display plan", () => {
    it("uses the unchanged canonical proposal calculation without mutating phases", () => {
        const phases = [phase("Demo", 0), phase("Install", 7), phase("Finish", 14)];
        const before = JSON.stringify(phases);
        const plan = plannerDisplayPlan("2026-10-19", phases, 5);
        expect(plan).toEqual(computeProgrammePlan("2026-10-19", phases));
        expect(plan).toMatchObject({ end_date: "2026-11-06", working_days: 15, calendar_days: 19, duration_label: "3 weeks" });
        expect(JSON.stringify(phases)).toBe(before);
    });

    it.each([4, 6, 7])("does not substitute a five-day calendar for the %i-day choice", (daysPerWeek) => {
        expect(plannerDisplayPlan("2026-10-19", [phase("Demo", 0)], daysPerWeek)).toBeNull();
    });

    it("preserves gaps, overlaps, manual durations and saved order", () => {
        const phases = [phase("Later", 14), { ...phase("Early", 0), manualDays: 2 }, phase("Overlap", 0, 3)];
        const before = JSON.stringify(phases);
        const plan = plannerDisplayPlan("2026-10-19", phases, 5);
        expect(plan).toEqual(computeProgrammePlan("2026-10-19", phases));
        expect(plan?.stages.map((stage) => stage.name)).toEqual(["Later", "Early", "Overlap"]);
        expect(plan?.stages[1].end_date).toBe("2026-10-20");
        expect(JSON.stringify(phases)).toBe(before);
    });

    it("does not show a partial summary when a phase cannot be dated", () => {
        expect(plannerDisplayPlan("2026-10-19", [phase("Valid", 0), phase("Undated", 7, 0)], 5)).toBeNull();
    });

    it("does not silently truncate phases at the canonical safety limit", () => {
        expect(plannerDisplayPlan("2026-10-19", Array.from({ length: 201 }, (_, i) => phase(`Stage ${i}`, i * 7)), 5)).toBeNull();
    });

    it("returns no display plan for an empty programme or invalid date", () => {
        expect(plannerDisplayPlan("2026-10-19", [], 5)).toBeNull();
        expect(plannerDisplayPlan("2026-02-30", [phase("Demo", 0)], 5)).toBeNull();
    });
});
