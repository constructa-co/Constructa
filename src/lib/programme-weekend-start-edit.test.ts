import { describe, expect, it, vi } from "vitest";
import { computeDisplayProgramme } from "./relative-programme";
import {
    DETAILED_REASON,
    buildProgrammePhases,
    buildSimpleProgramme,
    initialProgrammeState,
    programmeReducer,
    saveProgramme,
    viewForProject,
    type ProgrammeAction,
    type ProgrammeDraft,
    type ProgrammeState,
    type SaveProgramme,
} from "./simple-programme";

// 17 October 2026 is a Saturday, 19 October the Monday after it.
// 25 October 2026 is a Sunday, 26 October the Monday after it.
const SATURDAY = "2026-10-17";
const MONDAY = "2026-10-19";
const WEEKDAY_ERROR = "Choose a weekday. The programme counts Monday to Friday.";

function keys() {
    let n = 0;
    return () => `k${n++}`;
}

function storeFor(draft: ProgrammeDraft) {
    let state: ProgrammeState = initialProgrammeState(draft, true);
    return {
        getState: () => state,
        dispatch: (action: ProgrammeAction) => { state = programmeReducer(state, action); },
    };
}

function simpleDraft(view: ReturnType<typeof viewForProject>): ProgrammeDraft {
    if (view.kind !== "simple") throw new Error(`expected the simple view, got ${view.kind}`);
    return view.draft;
}

describe("a saved simple programme after the Brief moves its start to a weekend", () => {
    it("opens one saved whole-job phase in the simple editor, keeping the weekend date as saved", () => {
        const phases = [{ name: "Works on site", calculatedDays: 5, manualDays: 5, startOffset: 0 }];
        const before = structuredClone(phases);
        const view = viewForProject({ start_date: SATURDAY, programme_phases: phases }, keys());

        expect(view).toEqual({
            kind: "simple",
            hasSaved: true,
            draft: { startDate: SATURDAY, duration: "1", unit: "weeks", stages: [], wholeSource: 0, wholeName: "Works on site" },
        });
        expect(phases).toEqual(before);
    });

    it("refuses to save until the date is explicitly corrected, then saves the same stage from that weekday", async () => {
        const saved = [{ name: "Works on site", calculatedDays: 5, manualDays: 5, startOffset: 0 }];
        const store = storeFor(simpleDraft(viewForProject({ start_date: SATURDAY, programme_phases: saved }, keys())));
        const save = vi.fn<SaveProgramme>(async () => ({ success: true }));

        expect(buildSimpleProgramme(store.getState().draft)).toEqual({ ok: false, fieldErrors: { startDate: WEEKDAY_ERROR } });
        expect(await saveProgramme(store, save)).toBe("invalid");
        expect(save).not.toHaveBeenCalled();
        expect(store.getState().draft.startDate).toBe(SATURDAY);
        expect(store.getState().fieldErrors).toEqual({ startDate: WEEKDAY_ERROR });

        store.dispatch({ type: "field/change", patch: { startDate: MONDAY } });
        expect(await saveProgramme(store, save)).toBe("saved");
        expect(save).toHaveBeenCalledTimes(1);
        const input = save.mock.calls[0][0];
        expect(input).toEqual({ startDate: MONDAY, stages: [{ name: "Works on site", workingDays: 5, unit: "weeks", source: 0 }] });
        expect(buildProgrammePhases(input, saved)).toEqual([
            { name: "Works on site", calculatedDays: 5, manualDays: 5, manhours: 0, startOffset: 0, duration_unit: "Weeks" },
        ]);
    });

    it.each([
        ["Saturday", SATURDAY, MONDAY],
        ["Sunday", "2026-10-25", "2026-10-26"],
    ])("opens saved back-to-back stages in the simple editor from a %s start and saves them after a weekday correction", async (_label, weekend, weekday) => {
        // Saved from a weekday start one stage after another.
        const saved = [
            { name: "Strip out", calculatedDays: 5, manualDays: 5, manhours: 40, startOffset: 0, color: "blue" },
            { name: "First fix", calculatedDays: 10, manualDays: null, manhours: 80, startOffset: 7, color: "emerald" },
            { name: "Finishes", calculatedDays: 5, manualDays: 5, startOffset: 21 },
        ];
        const before = structuredClone(saved);
        const draft = simpleDraft(viewForProject({ start_date: weekend, programme_phases: saved }, keys()));
        expect(draft.startDate).toBe(weekend);
        expect(draft.stages.map((s) => [s.key, s.name, s.duration, s.unit, s.source])).toEqual([
            ["k0", "Strip out", "1", "weeks", 0],
            ["k1", "First fix", "2", "weeks", 1],
            ["k2", "Finishes", "1", "weeks", 2],
        ]);
        expect(saved).toEqual(before);

        const store = storeFor(draft);
        const save = vi.fn<SaveProgramme>(async () => ({ success: true }));
        expect(await saveProgramme(store, save)).toBe("invalid");
        expect(save).not.toHaveBeenCalled();
        expect(store.getState().draft.startDate).toBe(weekend);

        store.dispatch({ type: "field/change", patch: { startDate: weekday } });
        expect(await saveProgramme(store, save)).toBe("saved");
        const input = save.mock.calls[0][0];
        expect(input.startDate).toBe(weekday);
        expect(buildProgrammePhases(input, saved).map((p) => [p.name, p.manualDays, p.startOffset, p.color])).toEqual([
            ["Strip out", 5, 0, "blue"],
            ["First fix", 10, 7, "emerald"],
            ["Finishes", 5, 21, undefined],
        ]);
    });

    it("still opens an empty programme with a weekend Brief date as a blank editable draft", () => {
        expect(viewForProject({ start_date: SATURDAY, programme_phases: [] }, keys()))
            .toEqual({ kind: "simple", hasSaved: false, draft: { startDate: SATURDAY, duration: "", unit: "weeks", stages: [], wholeSource: null, wholeName: null } });
    });
});

describe("programmes that are not simple stay protected with a weekend start", () => {
    it.each([
        ["overlapping stages", [{ name: "A", calculatedDays: 5, startOffset: 0 }, { name: "B", calculatedDays: 5, startOffset: 2 }, { name: "C", calculatedDays: 5, startOffset: 14 }]],
        ["a gap between stages", [{ name: "A", calculatedDays: 5, startOffset: 0 }, { name: "B", calculatedDays: 5, startOffset: 14 }, { name: "C", calculatedDays: 5, startOffset: 21 }]],
        ["a dependency", [{ name: "A", calculatedDays: 5, startOffset: 0 }, { name: "B", calculatedDays: 5, startOffset: 7, dependsOn: [0] }, { name: "C", calculatedDays: 5, startOffset: 14 }]],
        ["progress recorded", [{ name: "A", calculatedDays: 5, startOffset: 0, pct_complete: 40 }, { name: "B", calculatedDays: 5, startOffset: 7 }]],
        ["an actual start recorded", [{ name: "A", calculatedDays: 5, startOffset: 0, actual_start_date: MONDAY }, { name: "B", calculatedDays: 5, startOffset: 7 }]],
        ["a stage with its own start date", [{ name: "A", calculatedDays: 5, startOffset: 0 }, { name: "B", calculatedDays: 5, start_date: "2026-10-26" }]],
        ["a fractional offset", [{ name: "A", calculatedDays: 5, startOffset: 0 }, { name: "B", calculatedDays: 5, startOffset: 7.5 }]],
        ["more than six stages", Array.from({ length: 7 }, (_, i) => ({ name: `S${i}`, calculatedDays: 5, startOffset: i * 7 }))],
    ])("leaves a programme with %s to the detailed planner, untouched", (_label, phases) => {
        const before = structuredClone(phases);
        const view = viewForProject({ start_date: SATURDAY, programme_phases: phases }, keys());
        expect(view).toEqual({
            kind: "detailed",
            plan: computeDisplayProgramme(SATURDAY, phases),
            origin: "programme",
            reason: DETAILED_REASON,
            canStartSimple: false,
            startDate: SATURDAY,
        });
        expect(phases).toEqual(before);
    });

    it("keeps the exact weekday rule: a weekday start with a stage offset landing on a weekend is still detailed", () => {
        // From Monday, offset 5 is the Saturday; the plan would roll it to the
        // Monday after, but weekday starts keep their exact offset check.
        const phases = [{ name: "A", calculatedDays: 5, startOffset: 0 }, { name: "B", calculatedDays: 5, startOffset: 5 }];
        expect(viewForProject({ start_date: MONDAY, programme_phases: phases }, keys()))
            .toMatchObject({ kind: "detailed", origin: "programme", reason: DETAILED_REASON, canStartSimple: false });
    });
});

