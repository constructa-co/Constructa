import { describe, expect, it, vi } from "vitest";
import { copyProgrammeActivityName, programmeEstimateActivities } from "./programme-estimate-activities";
import { buildProgrammePhases, emptyProgrammeDraft, initialProgrammeState, programmeReducer, programmeSaveStatus, saveProgramme, viewForProject } from "./simple-programme";

const estimate = () => ({ id: "estimate", project_id: "job", estimate_lines: [
    { id: "one", estimate_id: "estimate", trade_section: "Fit kitchen", quantity: 20, manhours: 99 },
    { id: "two", estimate_id: "estimate", trade_section: "Fit kitchen" },
    { id: "three", estimate_id: "estimate", trade_section: "Decoration" },
] });
function store() {
    let state = programmeReducer(initialProgrammeState(emptyProgrammeDraft("2026-10-19"), false), { type: "stages/enable", keys: ["stage"] });
    return { getState: () => state, dispatch: (action: Parameters<typeof programmeReducer>[1]) => { state = programmeReducer(state, action); } };
}
describe("saved estimate activity names for programme drafts", () => {
    it("uses only explicit names in saved member lines, preserving wording and first-seen order", () => {
        const input = estimate(), before = JSON.stringify(input);
        input.estimate_lines.push({ id: "four", estimate_id: "estimate", trade_section: "<Works & finish>" });
        expect(programmeEstimateActivities("job", input).names).toEqual(["Fit kitchen", "Decoration", "<Works & finish>"]);
        input.estimate_lines.pop(); expect(JSON.stringify(input)).toBe(before);
    });
    it.each([null, {}, [], { ...estimate(), project_id: "another" }, { ...estimate(), id: "" }, { ...estimate(), estimate_lines: null }])("refuses missing or wrong-job estimate context: %j", input => {
        expect(programmeEstimateActivities("job", input).names).toEqual([]);
    });
    it("does not infer General, activity names from descriptions, or names from foreign/missing line membership", () => {
        const input = { ...estimate(), estimate_lines: [
            { id: "one", estimate_id: "other", trade_section: "Foreign" },
            { id: "two", trade_section: "Unverified" },
            { estimate_id: "estimate", trade_section: "No identity" },
            { id: "three", estimate_id: "estimate", description: "Do not guess" },
            { id: "four", estimate_id: "estimate", trade_section: "  " },
        ] };
        expect(programmeEstimateActivities("job", input).names).toEqual([]);
    });
    it("invalidates the review identity on selected estimate, membership or wording change, not on price changes", () => {
        const input = estimate(), first = programmeEstimateActivities("job", input).revision;
        input.estimate_lines[0].quantity = 25;
        expect(programmeEstimateActivities("job", input).revision).toBe(first);
        input.estimate_lines[0].trade_section = "Kitchen work";
        expect(programmeEstimateActivities("job", input).revision).not.toBe(first);
        expect(programmeEstimateActivities("job", { ...estimate(), id: "other" }).revision).not.toBe(first);
    });
    it("copies one exact name into one existing empty stage without touching length, order, dates or saved state", () => {
        const current = store(); current.dispatch({ type: "stage/add", key: "second" });
        const reviewed = current.getState(), before = reviewed.draft;
        expect(copyProgrammeActivityName(current, reviewed, "stage", "Fit kitchen", programmeEstimateActivities("job", estimate()).names)).toBe(true);
        expect(current.getState().draft).toEqual({ ...before, stages: [{ ...before.stages[0], name: "Fit kitchen" }, before.stages[1]] });
        expect(current.getState().saved).toBe(reviewed.saved); expect(programmeSaveStatus(current.getState())).toBe("unsaved");
        expect(copyProgrammeActivityName(current, reviewed, "second", "Decoration", ["Decoration"])).toBe(false);
    });
    it.each(["name", "duration", "removed", "saving", "failed"])("refuses retained callbacks after %s changed", change => {
        const current = store(), reviewed = current.getState();
        if (change === "name" || change === "duration") current.dispatch({ type: "stage/change", key: "stage", patch: { [change]: "Contractor edit" } });
        if (change === "removed") current.dispatch({ type: "stage/remove", key: "stage" });
        if (change === "saving") current.dispatch({ type: "save/started" });
        if (change === "failed") current.dispatch({ type: "save/failed", error: "Not confirmed" });
        const before = current.getState();
        expect(copyProgrammeActivityName(current, reviewed, "stage", "Fit kitchen", ["Fit kitchen"])).toBe(false);
        expect(current.getState()).toBe(before);
    });
    it.each([" ", "Already typed"])("never replaces nonempty stage text %j even on a fresh review", name => {
        const current = store(); current.dispatch({ type: "stage/change", key: "stage", patch: { name } });
        expect(copyProgrammeActivityName(current, current.getState(), "stage", "Fit kitchen", ["Fit kitchen"])).toBe(false);
    });
    it("refuses overlong/unlisted names and missing stages without truncation or creation", () => {
        const current = store(), before = current.getState(), long = "x".repeat(81);
        expect(copyProgrammeActivityName(current, before, "stage", long, [long])).toBe(false);
        expect(copyProgrammeActivityName(current, before, "stage", "Invented", ["Fit kitchen"])).toBe(false);
        expect(copyProgrammeActivityName(current, before, "missing", "Fit kitchen", ["Fit kitchen"])).toBe(false);
        expect(current.getState()).toBe(before);
    });
    it.each([false, true])("uses the existing explicit save and reopen contract for relative=%s", async relative => {
        const current = store(); if (relative) current.dispatch({ type: "field/change", patch: { timeBasis: "relative" } });
        const save = vi.fn().mockResolvedValue({ success: true });
        copyProgrammeActivityName(current, current.getState(), "stage", "Fit kitchen", ["Fit kitchen"]);
        expect(save).not.toHaveBeenCalled(); expect(current.getState().draft.stages[0].duration).toBe("");
        expect(await saveProgramme(current, save)).toBe("invalid"); expect(save).not.toHaveBeenCalled();
        current.dispatch({ type: "stage/change", key: "stage", patch: { duration: "2", unit: "days" } });
        expect(await saveProgramme(current, save)).toBe("saved");
        const input = save.mock.calls[0][0], phases = buildProgrammePhases(input, []);
        expect(input.stages).toEqual([{ name: "Fit kitchen", workingDays: 2, unit: "days", source: null }]);
        const reopened = viewForProject({ start_date: "2026-10-19", programme_phases: phases }, () => "saved");
        expect(reopened.kind).toBe("simple");
        if (reopened.kind === "simple") { expect(reopened.draft.wholeName).toBe("Fit kitchen"); expect(reopened.draft.duration).toBe("2"); expect(reopened.draft.timeBasis).toBe(relative ? "relative" : undefined); }
    });
});
