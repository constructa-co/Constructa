import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { draftFromProject, initialReviewState, reviewReducer, savedDraftFromProject, type ReviewProject, type ReviewState } from "@/lib/proposal-review";
import { requestProjectNavigation } from "@/lib/project-navigation";

const hooks = vi.hoisted(() => ({ effects: [] as Array<() => void | (() => void)>, state: null as ReviewState | null, guard: vi.fn() }));
vi.mock("react", async importOriginal => ({
    ...await importOriginal<typeof import("react")>(),
    useEffect: (effect: () => void | (() => void)) => { hooks.effects.push(effect); },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/lib/use-reducer-store", () => ({ useReducerStore: () => [hooks.state, {}] }));
vi.mock("@/lib/use-unsaved-guard", () => ({ useUnsavedGuard: hooks.guard }));
vi.mock("./actions", () => ({
    getProposalPublicationAction: vi.fn(), publishProposalAction: vi.fn(), retryProposalDeliveryAction: vi.fn(),
    saveProposalDraftAction: vi.fn(), suggestProposalWordingAction: vi.fn(), uploadPhotoAction: vi.fn(),
}));

import ReviewSendClient from "./review-send-client";

const project: ReviewProject = { id: "job-a", name: "Example job", scope_text: "Saved scope" };
const clean = (p = project) => initialReviewState(draftFromProject(p, () => "row"), savedDraftFromProject(p, () => "row"));
const cleanups: Array<() => void> = [];

function mountEffects(state: ReviewState, confirm: boolean, lockReason: string | null = null) {
    const confirmLeave = vi.fn((message: string) => { expect(message).toContain("Your proposal"); return confirm; });
    vi.stubGlobal("window", Object.assign(new EventTarget(), { confirm: confirmLeave }));
    hooks.state = state;
    hooks.effects = [];
    hooks.guard.mockClear();
    // No estimate: the existing preview-hash effect returns without work.
    renderToStaticMarkup(<ReviewSendClient context={{ project, profile: {}, estimate: null, nextVersion: 1 }} caseStudies={[]} lockReason={lockReason} estimateIssue={null} publications={[]} now="2026-10-17T20:00:00Z" />);
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

describe("proposal editor project-picker warning", () => {
    it("does not warn on a saved draft", () => {
        const confirm = mountEffects(clean(), false);
        expect(requestProjectNavigation()).toBe(true);
        expect(confirm).not.toHaveBeenCalled();
        expect(hooks.guard).toHaveBeenCalledWith(false, expect.any(String));
    });

    it("Cancel retains a changed draft and prevents the picker handoff", () => {
        const state = reviewReducer(clean(), { type: "draft/change", patch: { introduction: "Unsent local opening" } });
        const before = JSON.stringify(state);
        const confirm = mountEffects(state, false);
        expect(requestProjectNavigation()).toBe(false);
        expect(confirm).toHaveBeenCalledOnce();
        expect(hooks.guard).toHaveBeenCalledWith(true, confirm.mock.calls[0][0]);
        expect(JSON.stringify(state)).toBe(before);
    });

    it("explicit OK permits navigation and cleanup removes the listener", () => {
        const state = reviewReducer(clean(), { type: "draft/change", patch: { introduction: "Unsent local opening" } });
        const confirm = mountEffects(state, true);
        expect(requestProjectNavigation()).toBe(true);
        expect(confirm).toHaveBeenCalledOnce();
        cleanups.splice(0).forEach(cleanup => cleanup());
        expect(requestProjectNavigation()).toBe(true);
        expect(confirm).toHaveBeenCalledOnce();
    });

    it.each(["saving", "failed"] as const)("keeps warning while saving is %s", status => {
        const confirm = mountEffects({ ...clean(), save: { status, error: null } }, false);
        expect(requestProjectNavigation()).toBe(false);
        expect(confirm).toHaveBeenCalledOnce();
    });

    it("retains the existing unsaved brief-prefill warning without typing", () => {
        const state = clean({ id: "job-b", name: "Brief-only job", brief_scope: "Brief scope" });
        const confirm = mountEffects(state, false);
        expect(requestProjectNavigation()).toBe(false);
        expect(confirm).toHaveBeenCalledOnce();
        expect(state.saved.scope).toBe("");
        expect(state.draft.scope).toBe("Brief scope");
    });

    it("does not introduce an editing warning on a locked project", () => {
        const state = reviewReducer(clean(), { type: "draft/change", patch: { introduction: "Local snapshot" } });
        const confirm = mountEffects(state, false, "Read only");
        expect(requestProjectNavigation()).toBe(true);
        expect(confirm).not.toHaveBeenCalled();
        expect(hooks.guard).toHaveBeenCalledWith(false, expect.any(String));
    });
});
