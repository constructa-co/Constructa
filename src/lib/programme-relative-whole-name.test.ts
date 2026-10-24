import { describe, expect, it, vi } from "vitest";
import { computeDisplayProgramme } from "./relative-programme";
import {
    buildProgrammePhases,
    buildSimpleProgramme,
    initialProgrammeState,
    programmeReducer,
    saveProgramme,
    viewForProject,
    type ProgrammeAction,
    type ProgrammeDraft,
} from "./simple-programme";

function savedWholeJob(name: string): ProgrammeDraft {
    const view = viewForProject({
        start_date: "2026-10-12",
        programme_phases: [{ name, calculatedDays: 5, manualDays: 5, startOffset: 0 }],
    }, () => "stage-1");
    expect(view.kind).toBe("simple");
    if (view.kind !== "simple") throw new Error("Expected an editable saved whole-job programme");
    return view.draft;
}

describe("relative whole-job name save boundary", () => {
    it("refuses conversion of a preserved overlong dated name without truncating it", () => {
        const draft = { ...savedWholeJob("A".repeat(85)), timeBasis: "relative" as const };
        const before = JSON.stringify(draft);
        const built = buildSimpleProgramme(draft);
        expect(built.ok).toBe(false);
        if (!built.ok) expect(built.fieldErrors.stages).toContain("80");
        expect(JSON.stringify(draft)).toBe(before);
    });

    it("makes no save request and retains the original draft when conversion is refused", async () => {
        const draft = { ...savedWholeJob("A".repeat(85)), timeBasis: "relative" as const };
        let state = initialProgrammeState(draft, false);
        const store = {
            getState: () => state,
            dispatch: (action: ProgrammeAction) => { state = programmeReducer(state, action); },
        };
        const save = vi.fn(async () => ({ success: true as const }));
        expect(await saveProgramme(store, save)).toBe("invalid");
        expect(save).not.toHaveBeenCalled();
        expect(state.draft).toEqual(draft);
        expect(state.fieldErrors.stages).toContain("80");
    });

    it("round-trips an 80-character name through saved relative phases and reopening", () => {
        const name = "A".repeat(80);
        const draft = { ...savedWholeJob(name), timeBasis: "relative" as const };
        const built = buildSimpleProgramme(draft);
        expect(built.ok).toBe(true);
        if (!built.ok) throw new Error("Expected a valid boundary name");
        const phases = buildProgrammePhases(built.input, []);
        expect(computeDisplayProgramme(null, phases)).toMatchObject({
            basis: "relative_working_days", working_days: 5, stages: [{ name, start_day: 1, end_day: 5 }],
        });
        expect(viewForProject({ start_date: null, programme_phases: phases }, () => "stage-2"))
            .toMatchObject({ kind: "simple", draft: { wholeName: name, timeBasis: "relative" } });
    });

    it("retains an existing longer name when the contractor keeps calendar dates", () => {
        const name = "A".repeat(85);
        const built = buildSimpleProgramme(savedWholeJob(name));
        expect(built.ok).toBe(true);
        if (!built.ok) throw new Error("Existing dated behaviour must remain available");
        expect(built.input.stages[0].name).toBe(name);
        expect(computeDisplayProgramme(built.input.startDate, buildProgrammePhases(built.input, [])))
            .toMatchObject({ start_date: "2026-10-12", end_date: "2026-10-16", working_days: 5 });
    });

    it("keeps the normal whole-job default and working-day duration unchanged", () => {
        const draft = { ...savedWholeJob("Works on site"), timeBasis: "relative" as const };
        const built = buildSimpleProgramme(draft);
        expect(built.ok).toBe(true);
        if (!built.ok) throw new Error("Expected the existing whole-job default");
        expect(computeDisplayProgramme(null, buildProgrammePhases(built.input, [])))
            .toMatchObject({ working_days: 5, stages: [{ name: "Works on site", start_day: 1, end_day: 5 }] });
    });
});
