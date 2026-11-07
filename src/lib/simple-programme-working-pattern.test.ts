import { describe, expect, it, vi } from "vitest";
import { computeDisplayProgramme } from "./relative-programme";
import {
    buildProgrammePhases, buildSimpleProgramme, draftPlan, emptyProgrammeDraft,
    initialProgrammeState, isProgrammeSaved, programmeReducer, programmeSaveStatus,
    saveProgramme, validateStartDate, viewForProject, type ProgrammeDraft, type ProgrammeSaveResult, type SaveProgramme,
} from "./simple-programme";

const saturday = { version: 1 as const, weekdays: [1, 2, 3, 4, 5, 6] };
const all = { version: 1 as const, weekdays: [0, 1, 2, 3, 4, 5, 6] };
const whole = (): ProgrammeDraft => ({ ...emptyProgrammeDraft("2026-10-16"), duration: "2", unit: "days" });

describe("explicit per-job working days in the simple editor", () => {
    it("keeps missing-pattern requests unchanged and enables only explicitly chosen Saturday", () => {
        const legacy = buildSimpleProgramme(whole());
        expect(legacy).toEqual({ ok: true, input: { startDate: "2026-10-16", stages: [
            { name: "Works on site", workingDays: 2, unit: "days", source: null },
        ] } });
        expect(draftPlan(whole())?.stages[0].end_date).toBe("2026-10-19");
        expect(draftPlan({ ...whole(), workingPattern: saturday })?.stages[0].end_date).toBe("2026-10-17");
        expect(validateStartDate("2026-10-17")).toContain("weekday");
        expect(validateStartDate("2026-10-17", saturday)).toBeNull();
        expect(validateStartDate("2026-10-18", saturday)).not.toBeNull();
    });

    it("preserves declared week/day units and reopens the actual saved pattern and stage dates", () => {
        const draft = { ...whole(), startDate: "2026-10-17", duration: "1", unit: "weeks" as const, workingPattern: saturday };
        const result = buildSimpleProgramme(draft);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.input.stages[0]).toMatchObject({ workingDays: 6, unit: "weeks" });
        const phases = buildProgrammePhases(result.input, []);
        expect(computeDisplayProgramme(draft.startDate, phases, saturday)?.end_date).toBe("2026-10-23");
        const view = viewForProject({ start_date: draft.startDate, programme_phases: phases, programme_working_pattern: saturday }, () => "key");
        expect(view).toMatchObject({ kind: "simple", hasSaved: true, draft: { duration: "1", unit: "weeks", workingPattern: saturday } });
        if (view.kind === "simple") expect(draftPlan(view.draft)).toEqual(draftPlan(draft));
        const days = viewForProject({ start_date: draft.startDate, programme_phases: [{ ...phases[0], duration_unit: "Days" }], programme_working_pattern: saturday }, () => "key");
        expect(days).toMatchObject({ draft: { duration: "6", unit: "days" } });
    });

    it("uses one pattern for consecutive phases, offsets, preview and restored metadata", () => {
        const draft = { ...whole(), workingPattern: saturday, stages: [
            { key: "a", name: "Prepare", duration: "1", unit: "days" as const, source: 0 },
            { key: "b", name: "Install", duration: "1", unit: "days" as const, source: null },
        ] };
        const built = buildSimpleProgramme(draft);
        if (!built.ok) throw Error("valid draft");
        const phases = buildProgrammePhases(built.input, [{ color: "blue", manhours: 8 }]);
        expect(phases.map(p => p.startOffset)).toEqual([0, 1]);
        expect(phases[0]).toMatchObject({ color: "blue", manhours: 8, manualDays: 1 });
        expect(computeDisplayProgramme(draft.startDate, phases, saturday)).toEqual(draftPlan(draft));
    });

    it("marks calendar-only edits dirty, binds expected pattern and retains edits during save", async () => {
        let state = initialProgrammeState(whole(), true);
        const store = { getState: () => state, dispatch: (action: Parameters<typeof programmeReducer>[1]) => { state = programmeReducer(state, action); } };
        store.dispatch({ type: "field/change", patch: { workingPattern: saturday } });
        expect(programmeSaveStatus(state)).toBe("unsaved");
        let finish!: (result: ProgrammeSaveResult) => void;
        const save = vi.fn<SaveProgramme>(() => new Promise<ProgrammeSaveResult>(resolve => { finish = resolve; }));
        const pending = saveProgramme(store, save);
        expect(save.mock.calls[0][0]).toMatchObject({ workingPattern: saturday, expectedWorkingPattern: null });
        store.dispatch({ type: "field/change", patch: { workingPattern: all } });
        finish({ success: true, confirmedProject: { programme_working_pattern: saturday } });
        expect(await pending).toBe("saved");
        expect(state.saved.workingPattern).toEqual(saturday);
        expect(state.draft.workingPattern).toEqual(all);
        expect(isProgrammeSaved(state)).toBe(false);
    });

    it("keeps the exact weekend draft on refusal and retries only deliberately", async () => {
        let state = initialProgrammeState(whole(), true);
        state = programmeReducer(state, { type: "field/change", patch: { workingPattern: saturday } });
        const store = { getState: () => state, dispatch: (action: Parameters<typeof programmeReducer>[1]) => { state = programmeReducer(state, action); } };
        const before = JSON.stringify(state.draft);
        const save = vi.fn().mockResolvedValueOnce({ success: false, error: "Not confirmed" })
            .mockResolvedValueOnce({ success: true, confirmedProject: { programme_working_pattern: saturday } });
        expect(await saveProgramme(store, save)).toBe("failed");
        expect(JSON.stringify(state.draft)).toBe(before);
        expect(save).toHaveBeenCalledTimes(1);
        expect(isProgrammeSaved(state)).toBe(false);
        expect(await saveProgramme(store, save)).toBe("saved");
        expect(save.mock.calls[1][0]).toEqual(save.mock.calls[0][0]);
        expect(isProgrammeSaved(state)).toBe(true);
    });

    it("does not treat an older success-only transport as a confirmed calendar save", async () => {
        let state = initialProgrammeState(whole(), true);
        state = programmeReducer(state, { type: "field/change", patch: { workingPattern: saturday } });
        const store = { getState: () => state, dispatch: (action: Parameters<typeof programmeReducer>[1]) => { state = programmeReducer(state, action); } };
        expect(await saveProgramme(store, async () => ({ success: true }))).toBe("failed");
        expect(isProgrammeSaved(state)).toBe(false);
        expect(state.draft.workingPattern).toEqual(saturday);
    });

    it("refuses malformed stored data and keeps explicit relative programmes undated", () => {
        const invalid = { version: 1, weekdays: [] };
        expect(viewForProject({ programme_working_pattern: invalid }, () => "key")).toMatchObject({ kind: "detailed", canStartSimple: false, plan: null });
        expect(buildSimpleProgramme({ ...whole(), workingPattern: invalid as never }).ok).toBe(false);
        expect(draftPlan({ ...whole(), workingPattern: invalid as never })).toBeNull();
        const relative = { ...whole(), timeBasis: "relative" as const, startDate: "", duration: "1", unit: "weeks" as const, workingPattern: all };
        expect(draftPlan(relative)).toMatchObject({ working_days: 7, duration_label: "1 week" });
        expect(draftPlan(relative)).not.toHaveProperty("start_date");
    });
});
