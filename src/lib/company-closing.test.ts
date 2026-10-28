import { describe, expect, it, vi } from "vitest";
import { minimalInput } from "./__fixtures__/proposal";
import { buildProposalDocument } from "./proposal-document";
import { applyCompanyClosingMessage, buildPreviewSnapshot, companyClosingForDraft, draftFromProject, draftFromReviewContext, initialReviewState, isReviewDirty, reviewReducer, saveDraft, savedDraftFromProject, type ReviewAction, type ReviewContext } from "./proposal-review";

const message = "We look forward to working with you.\n\nAlex, managing director";
function setup(savedClosing: string | null = null) {
    const input = minimalInput(), context: ReviewContext = { project: { ...input.project, closing_statement: savedClosing }, profile: { ...input.profile, md_message: message }, estimate: input.estimate, nextVersion: 1 };
    let state = initialReviewState(draftFromReviewContext(context, () => "key"), savedDraftFromProject(context.project, () => "key"));
    const store = { getState: () => state, dispatch: (action: ReviewAction) => { state = reviewReducer(state, action); } };
    return { store, context };
}
function setupLegacyBlankClosing() {
    const input = minimalInput(), context: ReviewContext = { project: { ...input.project, closing_statement: "" }, profile: { ...input.profile, md_message: message }, estimate: input.estimate, nextVersion: 1 };
    let state = initialReviewState(draftFromReviewContext(context, () => "key"), savedDraftFromProject(context.project, () => "key"));
    const store = { getState: () => state, dispatch: (action: ReviewAction) => { state = reviewReducer(state, action); } };
    return { store, context };
}
describe("reviewed company message to closing draft", () => {
    it("seeds the review draft from md_message when closing is unset, without saving", () => {
        const { store } = setup();
        expect(store.getState().draft.closing).toBe(message);
        expect(store.getState().saved.closing).toBe("");
        expect(isReviewDirty(store.getState())).toBe(true);
    });
    it("leaves legacy empty-string saved closings blank and does not seed from md_message", () => {
        const input = minimalInput();
        const context: ReviewContext = {
            project: { ...input.project, closing_statement: "" },
            profile: { ...input.profile, md_message: message },
            estimate: input.estimate,
            nextVersion: 1,
        };
        expect(companyClosingForDraft(context.project, context.profile)).toBe("");
        expect(draftFromReviewContext(context, () => "key").closing).toBe("");
    });
    it("uses exact source wording only on explicit choice, marks it unsaved and clears prior confirmation", () => {
        const { store } = setupLegacyBlankClosing(); store.dispatch({ type: "confirm/set", confirmed: true });
        expect(applyCompanyClosingMessage(store, message, true)).toEqual({ ok: true });
        expect(store.getState().draft.closing).toBe(message); expect(store.getState().saved.closing).toBe("");
        expect(isReviewDirty(store.getState())).toBe(true); expect(store.getState().confirmed).toBe(false);
    });
    it.each(["", "  \n "])("does not invent a message for blank source %j", source => {
        const { store } = setupLegacyBlankClosing(), before = JSON.stringify(store.getState());
        expect(applyCompanyClosingMessage(store, source, true).ok).toBe(false); expect(JSON.stringify(store.getState())).toBe(before);
    });
    it("refuses overlong company text without truncation and accepts the existing closing limit", () => {
        const { store } = setupLegacyBlankClosing(); expect(applyCompanyClosingMessage(store, "x".repeat(20001), true).ok).toBe(false);
        expect(store.getState().draft.closing).toBe(""); expect(applyCompanyClosingMessage(store, "x".repeat(20000), true).ok).toBe(true);
        expect(store.getState().draft.closing).toHaveLength(20000);
    });
    it("preserves a saved proposal override even after it is cleared in a newer unsaved draft", () => {
        const { store } = setup("Proposal-specific message"); store.dispatch({ type: "draft/change", patch: { closing: "" } });
        expect(applyCompanyClosingMessage(store, message, true).ok).toBe(false);
        expect(store.getState().draft.closing).toBe(""); expect(store.getState().saved.closing).toBe("Proposal-specific message");
    });
    it("reads the latest draft rather than overwriting typing after an earlier render", () => {
        const { store } = setup(); const click = () => applyCompanyClosingMessage(store, message, true);
        store.dispatch({ type: "draft/change", patch: { closing: "New typing" } });
        expect(click().ok).toBe(false); expect(store.getState().draft.closing).toBe("New typing");
    });
    it.each(["saving", "publishing", "assistant", "suggestion"])("does not apply during %s", busy => {
        const { store } = setup();
        if (busy === "saving") store.dispatch({ type: "save/started" });
        if (busy === "publishing") store.dispatch({ type: "send/started" });
        if (busy === "assistant") store.dispatch({ type: "ai/started", field: "closing", requestId: "r" });
        if (busy === "suggestion") {
            store.dispatch({ type: "ai/started", field: "closing", requestId: "r" });
            store.dispatch({ type: "ai/succeeded", requestId: "r", suggestion: { id: "r", field: "closing", text: "Pending review", basedOn: "" } });
        }
        expect(applyCompanyClosingMessage(store, message, true).ok).toBe(false); expect(store.getState().draft.closing).toBe(message);
    });
    it("does not apply when the project is not editable", () => {
        const { store } = setup(); expect(applyCompanyClosingMessage(store, message, false).ok).toBe(false); expect(store.getState().draft.closing).toBe(message);
    });
    it("uses the existing explicit save and immutable document pipeline without changing the profile", async () => {
        const { store, context } = setup(), profileBefore = JSON.stringify(context.profile), save = vi.fn(async () => ({ success: true as const }));
        expect(save).not.toHaveBeenCalled();
        store.dispatch({ type: "draft/change", patch: { closing: "For this proposal: " + message } });
        expect(await saveDraft(store, save)).toBe("saved"); expect(save).toHaveBeenCalledWith(expect.objectContaining({ closing: "For this proposal: " + message }));
        const snapshot = buildPreviewSnapshot(context, store.getState().draft, "acknowledgement", "2026-10-22T01:00:00Z")!;
        expect(snapshot.content.closing_statement).toBe("For this proposal: " + message);
        expect(buildProposalDocument(snapshot).sections.find(section => section.id === "closing")!.blocks[0]).toMatchObject({ type: "paragraphs", paragraphs: ["For this proposal: We look forward to working with you.", "Alex, managing director"] });
        expect(JSON.stringify(context.profile)).toBe(profileBefore);
    });
    it("retains contractor edits on failed Save and does not silently refill a subsequently omitted closing", async () => {
        const { store, context } = setup();
        const save = vi.fn(async () => ({ success: false as const, error: "Save not confirmed" }));
        expect(await saveDraft(store, save)).toBe("failed"); expect(store.getState().draft.closing).toBe(message);
        store.dispatch({ type: "draft/change", patch: { closing: "" } });
        expect(draftFromProject({ ...context.project, closing_statement: null }, () => "key").closing).toBe("");
        expect(draftFromReviewContext(context, () => "key").closing).toBe(message);
    });
});
