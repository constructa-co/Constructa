import { describe, expect, it, vi } from "vitest";
import { computeProgrammePlan } from "./programme-plan";
import {
    DETAILED_REASON,
    MAX_STAGES,
    PROGRAMME_SAVE_ERROR,
    WHOLE_JOB_NAME,
    buildProgrammePhases,
    buildSimpleProgramme,
    continueToProposal,
    draftPlan,
    emptyProgrammeDraft,
    initialProgrammeState,
    isProgrammeSaved,
    programmeReducer,
    programmeSaveStatus,
    saveProgramme,
    stageDurationField,
    stageNameField,
    viewForProject,
    type ProgrammeAction,
    type ProgrammeDraft,
    type ProgrammeState,
    type SaveProgramme,
    type StageDraft,
} from "./simple-programme";

// 12 October 2026 is a Monday.
const MONDAY = "2026-10-12";

function keys() {
    let n = 0;
    return () => `k${n++}`;
}

function stage(key: string, name: string, duration: string, unit: "days" | "weeks" = "weeks", source: number | null = null): StageDraft {
    return { key, name, duration, unit, source };
}

function storeFor(initial: ProgrammeState) {
    let state = initial;
    return {
        getState: () => state,
        dispatch: (action: ProgrammeAction) => { state = programmeReducer(state, action); },
    };
}

const whole: ProgrammeDraft = { ...emptyProgrammeDraft(MONDAY), duration: "3", unit: "weeks" };
const staged: ProgrammeDraft = {
    ...emptyProgrammeDraft(MONDAY),
    stages: [stage("a", "Strip out", "1"), stage("b", "First fix", "8", "days"), stage("c", "Finishes", "2")],
};

describe("minimum programme", () => {
    it("needs only a start date and a duration", () => {
        const built = buildSimpleProgramme(whole);
        expect(built).toEqual({
            ok: true,
            input: { startDate: MONDAY, stages: [{ name: WHOLE_JOB_NAME, workingDays: 15, unit: "weeks", source: null }] },
        });
    });

    it("gives one end date for the start and duration, in days or weeks", () => {
        expect(draftPlan(whole)).toMatchObject({ start_date: MONDAY, end_date: "2026-10-30", duration_label: "3 weeks" });
        expect(draftPlan({ ...whole, duration: "15", unit: "days" })?.end_date).toBe("2026-10-30");
        expect(draftPlan({ ...whole, duration: "8", unit: "days" })).toMatchObject({ end_date: "2026-10-21", duration_label: "8 working days" });
    });

    it("says what is missing", () => {
        const built = buildSimpleProgramme(emptyProgrammeDraft());
        expect(built.ok).toBe(false);
        if (!built.ok) {
            expect(built.fieldErrors.startDate).toBe("Choose the date you start on site.");
            expect(built.fieldErrors.duration).toBe("Say how long the job takes.");
        }
        expect(draftPlan(emptyProgrammeDraft())).toBeNull();
    });

    it("asks for a weekday start, because the programme counts Monday to Friday", () => {
        const built = buildSimpleProgramme({ ...whole, startDate: "2026-10-17" });
        expect(built.ok).toBe(false);
        if (!built.ok) expect(built.fieldErrors.startDate).toContain("Choose a weekday");
        expect(draftPlan({ ...whole, startDate: "2026-10-17" })).toBeNull();
    });

    it.each(["0", "-3", "2.5", "abc", "1e3", "99999", ""])("rejects the duration %j", (duration) => {
        expect(buildSimpleProgramme({ ...whole, duration }).ok).toBe(false);
    });

    it("rejects a job longer than ten years", () => {
        expect(buildSimpleProgramme({ ...whole, duration: "521" }).ok).toBe(false);
        expect(buildSimpleProgramme({ ...whole, duration: "520" }).ok).toBe(true);
    });
});

describe("stages", () => {
    it("run one after another and add up to the programme", () => {
        const plan = draftPlan(staged)!;
        expect(plan.stages.map((s) => [s.name, s.start_date, s.end_date, s.working_days])).toEqual([
            ["Strip out", MONDAY, "2026-10-16", 5],
            ["First fix", "2026-10-19", "2026-10-28", 8],
            ["Finishes", "2026-10-29", "2026-11-11", 10],
        ]);
        expect(plan.working_days).toBe(5 + 8 + 10);
        expect(plan.end_date).toBe(plan.stages[2].end_date);
        expect(plan.duration_label).toBe("23 working days");
    });

    it("must number three to six, each with a name and a duration", () => {
        const two = buildSimpleProgramme({ ...staged, stages: staged.stages.slice(0, 2) });
        expect(two.ok).toBe(false);
        if (!two.ok) expect(two.fieldErrors.stages).toContain("between 3 and 6");

        const seven = buildSimpleProgramme({ ...staged, stages: Array.from({ length: 7 }, (_, i) => stage(`s${i}`, `Stage ${i}`, "1")) });
        expect(seven.ok).toBe(false);

        const unnamed = buildSimpleProgramme({ ...staged, stages: [stage("a", " ", "1"), stage("b", "B", ""), stage("c", "C", "1")] });
        expect(unnamed.ok).toBe(false);
        if (!unnamed.ok) {
            expect(unnamed.fieldErrors[stageNameField("a")]).toBe("Give this stage a name.");
            expect(unnamed.fieldErrors[stageDurationField("b")]).toBe("Say how long this stage takes.");
        }
    });

    it("stores stages back to back with the offsets the canonical calculation reads", () => {
        const built = buildSimpleProgramme(staged);
        if (!built.ok) throw new Error("expected a valid programme");
        const phases = buildProgrammePhases(built.input, []);
        expect(phases.map((p) => [p.name, p.manualDays, p.startOffset, p.duration_unit])).toEqual([
            ["Strip out", 5, 0, "Weeks"],
            ["First fix", 8, 7, "Days"],
            ["Finishes", 10, 17, "Weeks"],
        ]);
        // What is stored produces exactly the plan that was previewed.
        expect(computeProgrammePlan(MONDAY, phases)).toEqual(draftPlan(staged));
    });

    it("limits the editor to six stages", () => {
        const store = storeFor(initialProgrammeState(emptyProgrammeDraft(MONDAY), false));
        store.dispatch({ type: "stages/enable", keys: ["a", "b", "c"] });
        expect(store.getState().draft.stages).toHaveLength(3);
        ["d", "e", "f", "g", "h"].forEach((key) => store.dispatch({ type: "stage/add", key }));
        expect(store.getState().draft.stages).toHaveLength(MAX_STAGES);
    });

    it("reorders and removes stages, and returns to one bar keeping the typed length", () => {
        const store = storeFor(initialProgrammeState({ ...staged, duration: "4", unit: "weeks" }, false));
        store.dispatch({ type: "stage/move", key: "c", direction: -1 });
        expect(store.getState().draft.stages.map((s) => s.key)).toEqual(["a", "c", "b"]);
        store.dispatch({ type: "stage/move", key: "a", direction: -1 });
        expect(store.getState().draft.stages.map((s) => s.key)).toEqual(["a", "c", "b"]);
        store.dispatch({ type: "stage/remove", key: "c" });
        expect(store.getState().draft.stages.map((s) => s.key)).toEqual(["a", "b"]);
        store.dispatch({ type: "stages/disable" });
        expect(draftPlan(store.getState().draft)?.duration_label).toBe("4 weeks");
    });
});

describe("established programme data", () => {
    const established = [
        { name: "Strip out", calculatedDays: 3, manualDays: 5, manhours: 24, startOffset: 0, color: "blue" },
        { name: "First fix", calculatedDays: 10, manualDays: null, manhours: 80, startOffset: 7, color: "emerald" },
        { name: "Finishes", calculatedDays: 5, manualDays: 5, manhours: 40, startOffset: 21, color: "orange", pct_complete: 0 },
    ];

    it("opens compatible phases in the simple view", () => {
        const view = viewForProject({ start_date: MONDAY, programme_phases: established }, keys());
        expect(view.kind).toBe("simple");
        if (view.kind !== "simple") return;
        expect(view.hasSaved).toBe(true);
        expect(view.draft.stages.map((s) => [s.name, s.duration, s.unit, s.source])).toEqual([
            ["Strip out", "1", "weeks", 0],
            ["First fix", "2", "weeks", 1],
            ["Finishes", "1", "weeks", 2],
        ]);
    });

    it("keeps the fields the detailed planner and live tracking use when a stage is changed", () => {
        const view = viewForProject({ start_date: MONDAY, programme_phases: established }, keys());
        if (view.kind !== "simple") throw new Error("expected the simple view");
        const draft: ProgrammeDraft = {
            ...view.draft,
            stages: view.draft.stages.map((s, i) => (i === 1 ? { ...s, name: "First fix and plaster", duration: "3" } : s)),
        };
        const built = buildSimpleProgramme(draft);
        if (!built.ok) throw new Error("expected a valid programme");
        const phases = buildProgrammePhases(built.input, established);

        expect(phases[0]).toMatchObject({ name: "Strip out", calculatedDays: 3, manualDays: 5, manhours: 24, color: "blue", startOffset: 0 });
        expect(phases[1]).toMatchObject({ name: "First fix and plaster", calculatedDays: 10, manualDays: 15, manhours: 80, color: "emerald", startOffset: 7 });
        // The later stage moves out by the extra week; its own fields are untouched.
        expect(phases[2]).toMatchObject({ name: "Finishes", manualDays: 5, manhours: 40, color: "orange", pct_complete: 0, startOffset: 28 });
        expect(established[1].name).toBe("First fix");
    });

    it("opens a single phase as the whole job and keeps its name", () => {
        const view = viewForProject({ start_date: MONDAY, programme_phases: [{ name: "General", calculatedDays: 8, manualDays: null, manhours: 64, startOffset: 0 }] }, keys());
        expect(view).toMatchObject({ kind: "simple", draft: { duration: "8", unit: "days", stages: [], wholeSource: 0, wholeName: "General" } });
        if (view.kind !== "simple") return;
        const built = buildSimpleProgramme({ ...view.draft, duration: "10" });
        if (!built.ok) throw new Error("expected a valid programme");
        expect(buildProgrammePhases(built.input, [{ name: "General", calculatedDays: 8, manualDays: null, manhours: 64, startOffset: 0 }])[0])
            .toMatchObject({ name: "General", calculatedDays: 8, manualDays: 10, manhours: 64 });
    });

    it.each([
        ["overlapping stages", [{ name: "A", calculatedDays: 5, startOffset: 0 }, { name: "B", calculatedDays: 5, startOffset: 2 }, { name: "C", calculatedDays: 5, startOffset: 14 }]],
        ["a gap between stages", [{ name: "A", calculatedDays: 5, startOffset: 0 }, { name: "B", calculatedDays: 5, startOffset: 14 }, { name: "C", calculatedDays: 5, startOffset: 21 }]],
        ["a dependency", [{ name: "A", calculatedDays: 5, startOffset: 0 }, { name: "B", calculatedDays: 5, startOffset: 7, dependsOn: [0] }, { name: "C", calculatedDays: 5, startOffset: 14 }]],
        ["progress recorded", [{ name: "A", calculatedDays: 5, startOffset: 0, pct_complete: 40 }, { name: "B", calculatedDays: 5, startOffset: 7 }, { name: "C", calculatedDays: 5, startOffset: 14 }]],
        ["two stages", [{ name: "A", calculatedDays: 5, startOffset: 0 }, { name: "B", calculatedDays: 5, startOffset: 7 }]],
        ["more than six stages", Array.from({ length: 7 }, (_, i) => ({ name: `S${i}`, calculatedDays: 5, startOffset: i * 7 }))],
    ])("leaves a programme with %s to the detailed planner, untouched", (_label, phases) => {
        const view = viewForProject({ start_date: MONDAY, programme_phases: phases }, keys());
        expect(view).toMatchObject({ kind: "detailed", origin: "programme", reason: DETAILED_REASON, canStartSimple: false });
        if (view.kind === "detailed") expect(view.plan).toEqual(computeProgrammePlan(MONDAY, phases));
    });

    it("shows a timeline from the earlier editor read-only and lets a simple programme be started beside it", () => {
        const view = viewForProject({
            start_date: "2026-11-02",
            programme_phases: [],
            gantt_phases: [{ name: "Groundworks", start_date: "2026-11-02", duration_days: 10, duration_unit: "Days" }],
        }, keys());
        expect(view).toMatchObject({ kind: "detailed", origin: "legacy_timeline", canStartSimple: true });
    });

    it("starts blank, carrying the start date from the brief, when nothing is saved", () => {
        expect(viewForProject({ start_date: MONDAY, programme_phases: [] }, keys()))
            .toEqual({ kind: "simple", hasSaved: false, draft: emptyProgrammeDraft(MONDAY) });
        expect(viewForProject({}, keys())).toMatchObject({ kind: "simple", hasSaved: false, draft: { startDate: "" } });
    });
});

describe("saving", () => {
    it("shows Unsaved, Saving, Saved and Failed truthfully", async () => {
        const store = storeFor(initialProgrammeState(emptyProgrammeDraft(), false));
        expect(programmeSaveStatus(store.getState())).toBe("empty");

        store.dispatch({ type: "field/change", patch: { startDate: MONDAY, duration: "3" } });
        expect(programmeSaveStatus(store.getState())).toBe("unsaved");

        let release!: (value: { success: true }) => void;
        const save = vi.fn<SaveProgramme>(() => new Promise((resolve) => { release = resolve; }));
        const pending = saveProgramme(store, save);
        expect(programmeSaveStatus(store.getState())).toBe("saving");
        // A second press while saving does not send a second request.
        await expect(saveProgramme(store, save)).resolves.toBe("busy");
        release({ success: true });
        await expect(pending).resolves.toBe("saved");
        expect(programmeSaveStatus(store.getState())).toBe("saved");
        expect(save).toHaveBeenCalledTimes(1);
        expect(isProgrammeSaved(store.getState())).toBe(true);
    });

    it("keeps every input when a save fails, and the retry sends the same programme", async () => {
        const store = storeFor(initialProgrammeState(staged, false));
        const save = vi.fn<SaveProgramme>()
            .mockResolvedValueOnce({ success: false, error: "" })
            .mockResolvedValueOnce({ success: true });

        await expect(saveProgramme(store, save)).resolves.toBe("failed");
        expect(programmeSaveStatus(store.getState())).toBe("failed");
        expect(store.getState().save.error).toBe(PROGRAMME_SAVE_ERROR);
        expect(store.getState().draft).toEqual(staged);
        expect(isProgrammeSaved(store.getState())).toBe(false);

        await expect(saveProgramme(store, save)).resolves.toBe("saved");
        expect(save.mock.calls[1][0]).toEqual(save.mock.calls[0][0]);
        expect(programmeSaveStatus(store.getState())).toBe("saved");
        expect(store.getState().draft.stages.map((s) => s.name)).toEqual(["Strip out", "First fix", "Finishes"]);
    });

    it("treats a thrown network error as a failed save and keeps the draft", async () => {
        const store = storeFor(initialProgrammeState(whole, false));
        await expect(saveProgramme(store, vi.fn().mockRejectedValue(new Error("offline")))).resolves.toBe("failed");
        expect(store.getState().draft).toEqual(whole);
        expect(store.getState().save.error).toBe(PROGRAMME_SAVE_ERROR);
    });

    it("shows the server's own reason, such as a locked project", async () => {
        const store = storeFor(initialProgrammeState(whole, false));
        await saveProgramme(store, vi.fn().mockResolvedValue({ success: false, error: "This proposal has been accepted." }));
        expect(store.getState().save.error).toBe("This proposal has been accepted.");
    });

    it("does not call the server for an invalid programme", async () => {
        const store = storeFor(initialProgrammeState(emptyProgrammeDraft(), false));
        const save = vi.fn();
        await expect(saveProgramme(store, save)).resolves.toBe("invalid");
        expect(save).not.toHaveBeenCalled();
        expect(store.getState().fieldErrors.startDate).toBeTruthy();
    });

    it("clears the failure once the contractor edits again", async () => {
        const store = storeFor(initialProgrammeState(whole, false));
        await saveProgramme(store, vi.fn().mockResolvedValue({ success: false, error: "x" }));
        store.dispatch({ type: "field/change", patch: { duration: "4" } });
        expect(programmeSaveStatus(store.getState())).toBe("unsaved");
    });

    it("points each saved stage at its saved phase so a later save keeps that phase's fields", async () => {
        const store = storeFor(initialProgrammeState(staged, false));
        await saveProgramme(store, vi.fn().mockResolvedValue({ success: true }));
        expect(store.getState().draft.stages.map((s) => s.source)).toEqual([0, 1, 2]);
    });
});

describe("continuing to the proposal", () => {
    it("opens the proposal straight away when the programme on screen is saved", async () => {
        const store = storeFor(initialProgrammeState(whole, true));
        const save = vi.fn();
        const navigate = vi.fn();
        await expect(continueToProposal(store, save, navigate)).resolves.toBe("navigated");
        expect(save).not.toHaveBeenCalled();
        expect(navigate).toHaveBeenCalledTimes(1);
    });

    it("saves first, and stays put with the inputs when that save fails", async () => {
        const store = storeFor(initialProgrammeState(whole, false));
        const navigate = vi.fn();
        await expect(continueToProposal(store, vi.fn().mockResolvedValue({ success: false, error: "x" }), navigate)).resolves.toBe("failed");
        expect(navigate).not.toHaveBeenCalled();
        expect(store.getState().draft).toEqual(whole);

        await expect(continueToProposal(store, vi.fn().mockResolvedValue({ success: true }), navigate)).resolves.toBe("navigated");
        expect(navigate).toHaveBeenCalledTimes(1);
    });

    it("does not leave with an incomplete programme", async () => {
        const store = storeFor(initialProgrammeState(emptyProgrammeDraft(MONDAY), false));
        const navigate = vi.fn();
        await expect(continueToProposal(store, vi.fn(), navigate)).resolves.toBe("invalid");
        expect(navigate).not.toHaveBeenCalled();
    });
});
