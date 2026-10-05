import { describe, expect, it } from "vitest";
import {
    estimateSuggestedPhases,
    plannerCalendarDays,
    plannerPhasesOnOpen,
    savedPlannerPhases,
    sequenceSuggestedPhases,
    suggestedStageName,
    type PlannerEstimate,
    type PlannerPhase,
} from "./planner-phases";
import { computeProgrammePlan } from "./programme-plan";
import { buildProgrammePhases } from "./simple-programme";

/** Three stages as the simple programme saves them. */
const savedStages = buildProgrammePhases({
    startDate: "2026-11-02",
    stages: [
        { name: "Strip out", workingDays: 3, unit: "days", source: null },
        { name: "First fix and tiling", workingDays: 10, unit: "weeks", source: null },
        { name: "Second fix and finish", workingDays: 4, unit: "days", source: null },
    ],
}, []) as unknown as PlannerPhase[];

/** An estimate priced on the simple screen: every line filed under "General", no labour hours. */
const simpleEstimate: PlannerEstimate = {
    estimate_lines: [
        { trade_section: "General", quantity: 1, estimate_line_components: [] },
        { trade_section: "General", quantity: 18, estimate_line_components: [] },
    ],
};

/** An estimate with labour built up, the case that used to replace saved stages. */
const labourEstimate: PlannerEstimate = {
    estimate_lines: [
        { trade_section: "General", quantity: 1, estimate_line_components: [{ total_manhours: 40 }] },
        { trade_section: "Tiling", quantity: 2, estimate_line_components: [{ total_manhours: 12 }, { total_manhours: 4 }] },
        { trade_section: "Preliminaries", quantity: 1, estimate_line_components: [] },
    ],
};

describe("the planner opens on the saved programme", () => {
    it("returns saved stages exactly as they were saved, whatever the estimate says", () => {
        for (const estimate of [null, simpleEstimate, labourEstimate]) {
            const opening = plannerPhasesOnOpen(savedStages, estimate, 5);
            expect(opening.origin).toBe("saved");
            expect(opening.phases).toBe(savedStages);
        }
    });

    it("never turns the contractor's stages into a 'General' stage from the estimate", () => {
        const { phases } = plannerPhasesOnOpen(savedStages, labourEstimate, 5);
        expect(phases.map((phase) => phase.name)).toEqual(["Strip out", "First fix and tiling", "Second fix and finish"]);
        expect(phases.map((phase) => phase.manualDays)).toEqual([3, 10, 4]);
        // The proposal would still state the same three stages and dates.
        expect(computeProgrammePlan("2026-11-02", phases)?.stages.map((stage) => [stage.name, stage.start_date, stage.end_date])).toEqual([
            ["Strip out", "2026-11-02", "2026-11-04"],
            ["First fix and tiling", "2026-11-05", "2026-11-18"],
            ["Second fix and finish", "2026-11-19", "2026-11-24"],
        ]);
    });

    it("keeps a single saved stage too", () => {
        const one = [{ name: "Works on site", calculatedDays: 15, manualDays: 15, manhours: 0, startOffset: 0 }];
        expect(plannerPhasesOnOpen(one, labourEstimate, 5)).toEqual({ phases: one, origin: "saved" });
    });
});

describe("a job with no programme", () => {
    it("is offered a starting point from labour hours, marked as a suggestion", () => {
        const opening = plannerPhasesOnOpen([], labourEstimate, 5);
        expect(opening.origin).toBe("suggested");
        expect(opening.phases).toEqual([
            { name: "Works on site", calculatedDays: 5, manualDays: null, manhours: 40, startOffset: 0 },
            { name: "Tiling", calculatedDays: 4, manualDays: null, manhours: 32, startOffset: 7 },
        ]);
    });

    it("has nothing to open on when the estimate carries no labour hours", () => {
        expect(plannerPhasesOnOpen([], simpleEstimate, 5)).toEqual({ phases: [], origin: "empty" });
        expect(plannerPhasesOnOpen([], null, 5)).toEqual({ phases: [], origin: "empty" });
    });

    it("never offers the filing label 'General' as a stage name", () => {
        expect(suggestedStageName("General")).toBe("Works on site");
        expect(suggestedStageName("")).toBe("Works on site");
        expect(suggestedStageName(null)).toBe("Works on site");
        expect(suggestedStageName(" Tiling ")).toBe("Tiling");
        expect(estimateSuggestedPhases(labourEstimate, 5).map((phase) => phase.name)).not.toContain("General");

        // What the server suggests for a simple estimate: one section, a placeholder week.
        const fromServer = [{ name: "General", calculatedDays: 5, manualDays: null, manhours: 0, startOffset: 0 }];
        expect(sequenceSuggestedPhases(fromServer, 5)).toEqual([{ name: "Works on site", calculatedDays: 5, manualDays: null, manhours: 0, startOffset: 0 }]);
    });

    it("places suggested stages one after another on the planner's weekly grid", () => {
        const placed = sequenceSuggestedPhases([
            { name: "Demolition", calculatedDays: 3, manualDays: null },
            { name: "Structure", calculatedDays: 12, manualDays: 8 },
            { name: "Finishes", calculatedDays: 5, manualDays: null },
        ], 5);
        expect(placed.map((phase) => phase.startOffset)).toEqual([0, 7, 21]);
        expect(plannerCalendarDays(8, 5)).toBe(14);
        expect(plannerCalendarDays(8, 7)).toBe(8);
    });
});

describe("reading what is saved", () => {
    it("leaves out anything that is not a named phase rather than breaking the chart", () => {
        expect(savedPlannerPhases(null)).toEqual([]);
        expect(savedPlannerPhases("phases")).toEqual([]);
        expect(savedPlannerPhases([null, 3, { calculatedDays: 5 }, { name: "Roof", calculatedDays: 5 }])).toEqual([{ name: "Roof", calculatedDays: 5 }]);
    });
});
