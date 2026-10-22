import { describe, expect, it, vi } from "vitest";
import { buildProgrammePhases, buildSimpleProgramme, emptyProgrammeDraft, initialProgrammeState, programmeReducer, saveProgramme, viewForProject, type ProgrammeState, type SimpleProgrammeInput } from "./simple-programme";
import { computeProgrammePlan } from "./programme-plan";

describe("contractor-led simple activities", () => {
    it("starts with one empty contractor activity rather than manufacturing three", () => {
        const state = initialProgrammeState(emptyProgrammeDraft("2026-10-19"), false);
        const next = programmeReducer(state, { type: "stages/enable", keys: ["a", "b", "c"] });
        expect(next.draft.stages).toEqual([{ key: "a", name: "", duration: "", unit: "weeks", source: null }]);
        expect(state.draft.stages).toEqual([]);
    });

    it.each([1, 2, 3, 6])("builds %i named activities without a fixed three-stage minimum", count => {
        const draft = { ...emptyProgrammeDraft("2026-10-19"), stages: Array.from({ length: count }, (_, i) => ({ key: String(i), name: `My work ${i + 1}`, duration: "1", unit: "weeks" as const, source: null })) };
        const built = buildSimpleProgramme(draft);
        expect(built.ok).toBe(true);
        if (!built.ok) return;
        const phases = buildProgrammePhases(built.input, []);
        expect(phases).toHaveLength(count);
        const reopened = viewForProject({ start_date: "2026-10-19", programme_phases: phases }, () => "key");
        expect(reopened.kind).toBe("simple");
        expect(computeProgrammePlan("2026-10-19", phases)?.working_days).toBe(count * 5);
    });

    it("saves and reopens two activities through the unchanged controller without losing retained phase fields", async () => {
        const existing = [{ name: "First crew", manualDays: 5, calculatedDays: 3, manhours: 16, color: "green", startOffset: 0 }, { name: "Second crew", manualDays: 5, calculatedDays: 8, manhours: 24, color: "amber", startOffset: 7 }];
        let key = 0;
        const opened = viewForProject({ start_date: "2026-10-19", programme_phases: existing }, () => `id-${key++}`);
        expect(opened.kind).toBe("simple"); if (opened.kind !== "simple") return;
        let state: ProgrammeState = initialProgrammeState(opened.draft, true);
        const write = vi.fn(async (input: SimpleProgrammeInput) => {
            const saved = buildProgrammePhases(input, existing);
            expect(saved).toHaveLength(2);
            expect(saved[1]).toMatchObject({ name: "Second crew", manhours: 24, color: "amber", calculatedDays: 8 });
            return { success: true as const };
        });
        const store = { getState: () => state, dispatch: (action: Parameters<typeof programmeReducer>[1]) => { state = programmeReducer(state, action); } };
        await expect(saveProgramme(store, write)).resolves.toBe("saved");
        expect(write).toHaveBeenCalledTimes(1);
        expect(state.draft.stages).toHaveLength(2);
        expect(state.draft.stages.map(stage => stage.source)).toEqual([0, 1]);
    });

    it("preserves a saved single activity when explicitly opening its named-stage editor", () => {
        const phase = { name: "Replace door", calculatedDays: 2, manualDays: 3, manhours: 16, color: "amber", startOffset: 0 };
        const view = viewForProject({ start_date: "2026-10-19", programme_phases: [phase] }, () => "saved");
        expect(view.kind).toBe("simple"); if (view.kind !== "simple") return;
        const state = programmeReducer(initialProgrammeState(view.draft, true), { type: "stages/enable", keys: ["named"] });
        expect(state.draft.stages).toEqual([{ key: "named", name: "Replace door", duration: "3", unit: "days", source: 0 }]);
        const built = buildSimpleProgramme(state.draft); expect(built.ok).toBe(true); if (!built.ok) return;
        expect(buildProgrammePhases(built.input, [phase])[0]).toMatchObject(phase);
        expect(phase.name).toBe("Replace door");
    });
});
