import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyProgrammeDraft, initialProgrammeState, programmeReducer, type ProgrammeState } from "@/lib/simple-programme";
import { requestProjectNavigation } from "@/lib/project-navigation";

const hooks = vi.hoisted(() => ({
    effects: [] as Array<() => void | (() => void)>,
    state: null as ProgrammeState | null,
    guard: vi.fn(),
}));
vi.mock("react", async importOriginal => ({
    ...await importOriginal<typeof import("react")>(),
    useEffect: (effect: () => void | (() => void)) => { hooks.effects.push(effect); },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("next/dynamic", () => ({ default: () => () => { throw Error("Detailed planner must stay closed"); } }));
vi.mock("@/lib/use-reducer-store", () => ({ useReducerStore: () => [hooks.state, {}] }));
vi.mock("@/lib/use-unsaved-guard", () => ({ useUnsavedGuard: hooks.guard }));
vi.mock("@/components/programme-stage-focus", () => ({ default: () => null }));
vi.mock("./simple-actions", () => ({ saveSimpleProgrammeAction: vi.fn() }));

import SimpleProgrammeClient from "./simple-programme-client";

const clean = () => initialProgrammeState(emptyProgrammeDraft("2026-10-19"), false);
const cleanups: Array<() => void> = [];

function mountEffects(state: ProgrammeState, confirm: boolean) {
    const target = new EventTarget();
    const confirmLeave = vi.fn((message: string) => { expect(message).toContain("Your programme"); return confirm; });
    vi.stubGlobal("window", Object.assign(target, { confirm: confirmLeave }));
    hooks.state = state;
    hooks.effects = [];
    hooks.guard.mockClear();
    renderToStaticMarkup(<SimpleProgrammeClient project={{ id: "job-a", name: "Example job" }} lockReason={null} estimate={null} />);
    for (const effect of hooks.effects) {
        const cleanup = effect();
        if (cleanup) cleanups.push(cleanup);
    }
    return confirmLeave;
}

afterEach(() => {
    cleanups.splice(0).forEach(cleanup => cleanup());
    vi.unstubAllGlobals();
});

describe("programme editor project-picker warning", () => {
    it("lets a clean empty programme switch without confirmation", () => {
        const confirm = mountEffects(clean(), false);
        expect(requestProjectNavigation()).toBe(true);
        expect(confirm).not.toHaveBeenCalled();
        expect(hooks.guard).toHaveBeenCalledWith(false, expect.any(String));
    });

    it("lets a clean saved programme switch without confirmation", () => {
        const confirm = mountEffects(initialProgrammeState({ ...emptyProgrammeDraft("2026-10-19"), duration: "3" }, true), false);
        expect(requestProjectNavigation()).toBe(true);
        expect(confirm).not.toHaveBeenCalled();
    });

    it("Cancel prevents the picker handoff and does not change the draft", () => {
        const state = programmeReducer(clean(), { type: "field/change", patch: { duration: "3" } });
        const before = JSON.stringify(state);
        const confirm = mountEffects(state, false);
        expect(requestProjectNavigation()).toBe(false);
        expect(confirm).toHaveBeenCalledOnce();
        expect(hooks.guard).toHaveBeenCalledWith(true, confirm.mock.calls[0][0]);
        expect(JSON.stringify(state)).toBe(before);
    });

    it("explicit OK permits navigation and unmount removes the listener", () => {
        const state = programmeReducer(clean(), { type: "field/change", patch: { duration: "3" } });
        const confirm = mountEffects(state, true);
        expect(requestProjectNavigation()).toBe(true);
        expect(confirm).toHaveBeenCalledOnce();
        cleanups.splice(0).forEach(cleanup => cleanup());
        expect(requestProjectNavigation()).toBe(true);
        expect(confirm).toHaveBeenCalledOnce();
    });

    it.each(["saving", "failed"] as const)("keeps warning while a save is %s", status => {
        const state = { ...clean(), save: { status, error: status === "failed" ? "Unconfirmed" : null } };
        const confirm = mountEffects(state, false);
        expect(requestProjectNavigation()).toBe(false);
        expect(confirm).toHaveBeenCalledOnce();
    });
});
