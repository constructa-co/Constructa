import { describe, expect, it, vi } from "vitest";
import { representativeInput } from "./__fixtures__/proposal";
import { buildProposalDocument } from "./proposal-document";
import { buildProposalPublicationSnapshot } from "./proposal-publication";
import { responseWording } from "./proposal-response";
import {
    AI_ADDED_FIGURES_ERROR,
    AI_UNAVAILABLE_ERROR,
    DELIVERY_ERROR,
    DRAFT_SAVE_ERROR,
    PUBLISH_ERROR,
    PUBLISH_UNKNOWN_ERROR,
    SEND_BLOCK_MESSAGE,
    addedFigures,
    buildPreviewSnapshot,
    buildProposalPayload,
    draftFromProject,
    initialReviewState,
    isReviewDirty,
    paymentShareField,
    paymentStageField,
    requestWording,
    retryDelivery,
    reviewReadiness,
    reviewReducer,
    reviewSaveStatus,
    saveDraft,
    savedDraftFromProject,
    sendBlock,
    sendProposal,
    termField,
    vatFor,
    type ProposalDraft,
    type PublishProposal,
    type ReviewAction,
    type ReviewContext,
    type ReviewState,
    type SaveProposalDraft,
} from "./proposal-review";

function keys() {
    let n = 0;
    return () => `k${n++}`;
}

function contextFrom(patch: Partial<ReviewContext["project"]> = {}): ReviewContext {
    const input = representativeInput();
    return {
        project: { ...input.project, validity_days: 30, client_email: "alex@example.test", ...patch },
        profile: input.profile,
        estimate: input.estimate,
        nextVersion: 1,
    };
}

function storeFor(context: ReviewContext, patch: Partial<ProposalDraft> = {}) {
    const draft = { ...draftFromProject(context.project, keys()), ...patch };
    let state: ReviewState = initialReviewState(draft, { ...savedDraftFromProject(context.project, keys()), ...patch });
    return {
        getState: () => state,
        dispatch: (action: ReviewAction) => { state = reviewReducer(state, action); },
    };
}

const context = contextFrom();
const okSave: SaveProposalDraft = async () => ({ success: true });
const published = { success: true as const, url: `https://app.example.test/proposal/${"a".repeat(64)}`, versionNumber: 1, publicationId: "pub-1" };

describe("draft", () => {
    it("opens what the project holds, in the client's reading order", () => {
        const draft = draftFromProject(context.project, keys());
        expect(draft.introduction).toContain("Thank you for showing us round");
        expect(draft.payments.map((row) => [row.stage, row.when, row.percentage])).toEqual([
            ["Deposit", "On booking", "30"],
            ["First fix complete", "When plumbing is tested", "40"],
            ["Completion", "On handover", "30"],
        ]);
        expect(draft.photos).toEqual([
            { url: "https://images.example.test/bathroom-before.jpg", caption: "The bathroom as it is now" },
            { url: "https://images.example.test/shower-corner.jpg", caption: "" },
        ]);
        expect(draft.caseStudyIds).toEqual(["cs-1"]);
        expect(draft.terms).toBeNull();
        expect(draft.validityDays).toBe("30");
    });

    it("starts an unwritten scope from the contractor's own brief and shows it as unsaved", () => {
        const fromBrief = contextFrom({ scope_text: null, brief_scope: "Refit the bathroom.\n\nSite, access and assumptions:\nParking on the drive." });
        const store = storeFor(fromBrief);
        expect(store.getState().draft.scope).toBe("Refit the bathroom.");
        expect(store.getState().saved.scope).toBe("");
        expect(isReviewDirty(store.getState())).toBe(true);
        expect(reviewSaveStatus(store.getState())).toBe("unsaved");
    });

    it("seeds no payment stages, terms or wording of its own", () => {
        const blank = draftFromProject({ id: "p", name: "Job" }, keys());
        expect(blank).toMatchObject({ introduction: "", scope: "", exclusions: "", clarifications: "", closing: "", payments: [], photos: [], caseStudyIds: [], terms: null });
    });

    it("keeps fixed-amount stages from the earlier editor as they are until they are replaced", () => {
        const fixed = [{ id: "a", stage: "Deposit", description: "On booking", percentage: 0, amount: 2000 }];
        const draft = draftFromProject({ ...context.project, payment_schedule: fixed }, keys());
        expect(draft.fixedPayments).toEqual(fixed);
        expect(draft.payments).toEqual([]);
        const built = buildProposalPayload(draft);
        expect(built.ok && built.payload.paymentSchedule).toBeNull();

        const replaced = buildProposalPayload({ ...draft, fixedPayments: null, payments: [{ key: "x", stage: "On completion", when: "", percentage: "100" }] });
        expect(replaced.ok && replaced.payload.paymentSchedule).toEqual([{ id: "x", stage: "On completion", description: "", percentage: 100 }]);
    });
});

describe("save payload", () => {
    const draft = draftFromProject(context.project, keys());

    it("sends the contractor's wording and choices, trimmed, with blank rows dropped", () => {
        const built = buildProposalPayload({
            ...draft,
            introduction: "  Hello.  ",
            payments: [...draft.payments, { key: "blank", stage: " ", when: "", percentage: "" }],
        });
        expect(built.ok).toBe(true);
        if (!built.ok) return;
        expect(built.payload.introduction).toBe("Hello.");
        expect(built.payload.paymentSchedule).toHaveLength(3);
        expect(built.payload.validityDays).toBe(30);
        expect(built.payload.terms).toBeNull();
    });

    it("rejects stages over 100%, unnamed stages and bad shares, and says which", () => {
        const built = buildProposalPayload({
            ...draft,
            payments: [
                { key: "a", stage: "", when: "", percentage: "50" },
                { key: "b", stage: "Middle", when: "", percentage: "abc" },
                { key: "c", stage: "End", when: "", percentage: "70" },
            ],
        });
        expect(built.ok).toBe(false);
        if (built.ok) return;
        expect(built.fieldErrors[paymentStageField("a")]).toBe("Name this payment stage.");
        expect(built.fieldErrors[paymentShareField("b")]).toBe("Enter a percentage between 1 and 100.");
        expect(built.fieldErrors.payments).toBe("These stages add up to 120%. Bring them down to 100% or less.");
    });

    it.each(["0", "366", "30.5", "", "abc"])("rejects a validity of %j days", (validityDays) => {
        const built = buildProposalPayload({ ...draft, validityDays });
        expect(built.ok).toBe(false);
        if (!built.ok) expect(built.fieldErrors.validityDays).toBeTruthy();
    });

    it("needs a title and wording for every term that is shown", () => {
        const terms = [
            { clause_number: 1, title: "Payment", body: "Due in 14 days.", hidden: false, custom: false },
            { clause_number: 2, title: "", body: "", hidden: true, custom: true },
            { clause_number: 3, title: "Access", body: " ", hidden: false, custom: true },
        ];
        const built = buildProposalPayload({ ...draft, terms });
        expect(built.ok).toBe(false);
        if (!built.ok) expect(Object.keys(built.fieldErrors)).toEqual([termField(3)]);
    });
});

describe("readiness", () => {
    it("is ready for a complete draft", () => {
        expect(reviewReadiness(context, draftFromProject(context.project, keys())).ready).toBe(true);
    });

    it("blocks a proposal with no programme, and one with a start date but no duration", () => {
        const noProgramme = contextFrom({ programme_phases: [] });
        expect(reviewReadiness(noProgramme, draftFromProject(noProgramme.project, keys())).missing.map((item) => item.key)).toEqual(["programme"]);
        const noStart = contextFrom({ start_date: null });
        expect(reviewReadiness(noStart, draftFromProject(noStart.project, keys())).missing.map((item) => item.key)).toEqual(["programme"]);
    });

    it("reads the draft on screen, not only what was last saved", () => {
        const draft = { ...draftFromProject(context.project, keys()), scope: "  ", payments: [] };
        expect(reviewReadiness(context, draft).missing.map((item) => item.key)).toEqual(["scope", "payment"]);
    });

    it("blocks when there is no single estimate to price from", () => {
        const noEstimate = { ...context, estimate: null };
        expect(reviewReadiness(noEstimate, draftFromProject(context.project, keys())).missing.map((item) => item.key)).toEqual(["contractValue"]);
    });

    it("explains recommended gaps without blocking", () => {
        const draft = { ...draftFromProject(context.project, keys()), introduction: "", closing: "", photos: [], caseStudyIds: [] };
        const readiness = reviewReadiness(context, draft);
        expect(readiness.ready).toBe(true);
        expect(readiness.recommended.filter((item) => !item.ok).map((item) => item.key)).toEqual(["introduction", "photos", "caseStudies", "closingStatement"]);
    });
});

describe("preview", () => {
    const now = "2026-10-05T09:00:00.000Z";

    it("is the snapshot a real publication would freeze, so preview, public page and PDF share one calculation", () => {
        const draft = draftFromProject(context.project, keys());
        const preview = buildPreviewSnapshot(context, draft, "acknowledgement", now)!;
        const real = buildProposalPublicationSnapshot({ ...representativeInput(), publicationId: preview.publication.id });
        expect(preview.commercial).toEqual(real.commercial);
        expect(preview.programme_plan).toEqual(real.programme_plan);
        expect(preview.terms).toEqual(real.terms);
        expect(preview.content).toEqual(real.content);
        expect(preview.response).toEqual(real.response);
        expect(preview.case_studies).toEqual(real.case_studies);
        expect(preview.photos).toEqual(real.photos);
    });

    it("shows unsaved edits and the chosen response", () => {
        const draft = { ...draftFromProject(context.project, keys()), scope: "Only the tiling.", validityDays: "14" };
        const preview = buildPreviewSnapshot(context, draft, "non_binding_intent", now)!;
        expect(preview.content.scope).toBe("Only the tiling.");
        expect(preview.publication.validity_days).toBe(14);
        expect(buildProposalDocument(preview, { isDraft: true }).response.notice).toBe(responseWording("non_binding_intent").notice);
    });

    it("still renders while required facts are missing, and is absent only without an estimate", () => {
        const incomplete = contextFrom({ programme_phases: [] });
        const preview = buildPreviewSnapshot(incomplete, draftFromProject(incomplete.project, keys()), "acknowledgement", now)!;
        expect(preview.programme_plan).toBeUndefined();
        expect(buildProposalDocument(preview, { isDraft: true }).sections.map((section) => section.id)).not.toContain("programme");
        expect(buildPreviewSnapshot({ ...context, estimate: null }, draftFromProject(context.project, keys()), "acknowledgement", now)).toBeNull();
    });

    it("charges VAT the same way in the preview as in the publication", () => {
        expect(vatFor({ is_vat_reverse_charge: true })).toEqual({ vatRate: 0, vatTreatment: "domestic_reverse_charge" });
        expect(vatFor({})).toEqual({ vatRate: 20, vatTreatment: "standard" });
        const reverse = contextFrom({ is_vat_reverse_charge: true });
        const preview = buildPreviewSnapshot(reverse, draftFromProject(reverse.project, keys()), "acknowledgement", now)!;
        expect(preview.commercial.vat_amount).toBe(0);
        expect(preview.commercial.vat_treatment).toBe("domestic_reverse_charge");
    });
});

describe("saving", () => {
    it("shows Unsaved, Saving, Saved and Failed truthfully", async () => {
        const store = storeFor(context);
        expect(reviewSaveStatus(store.getState())).toBe("saved");
        store.dispatch({ type: "draft/change", patch: { closing: "New closing." } });
        expect(reviewSaveStatus(store.getState())).toBe("unsaved");

        let release!: (value: { success: true }) => void;
        const save = vi.fn<SaveProposalDraft>(() => new Promise((resolve) => { release = resolve; }));
        const pending = saveDraft(store, save);
        expect(reviewSaveStatus(store.getState())).toBe("saving");
        await expect(saveDraft(store, save)).resolves.toBe("busy");
        release({ success: true });
        await expect(pending).resolves.toBe("saved");
        expect(reviewSaveStatus(store.getState())).toBe("saved");
        expect(save).toHaveBeenCalledTimes(1);
    });

    it("keeps every input after a failed save and retries with the same payload", async () => {
        const store = storeFor(context);
        store.dispatch({ type: "draft/change", patch: { scope: "Changed scope.", closing: "Changed closing." } });
        const before = store.getState().draft;
        const save = vi.fn<SaveProposalDraft>()
            .mockRejectedValueOnce(new Error("offline"))
            .mockResolvedValueOnce({ success: false, error: "" })
            .mockResolvedValueOnce({ success: true });

        await expect(saveDraft(store, save)).resolves.toBe("failed");
        expect(store.getState().save.error).toBe(DRAFT_SAVE_ERROR);
        expect(store.getState().draft).toEqual(before);
        expect(reviewSaveStatus(store.getState())).toBe("failed");

        await expect(saveDraft(store, save)).resolves.toBe("failed");
        expect(store.getState().draft).toEqual(before);

        await expect(saveDraft(store, save)).resolves.toBe("saved");
        expect(save.mock.calls[2][0]).toEqual(save.mock.calls[0][0]);
        expect(reviewSaveStatus(store.getState())).toBe("saved");
    });

    it("does not call the server for an invalid draft", async () => {
        const store = storeFor(context);
        store.dispatch({ type: "draft/change", patch: { validityDays: "0" } });
        const save = vi.fn();
        await expect(saveDraft(store, save)).resolves.toBe("invalid");
        expect(save).not.toHaveBeenCalled();
    });
});

describe("AI wording", () => {
    const original = "we will do the bathroom for 2 weeks";

    it("holds a suggestion as pending and changes nothing until Apply", async () => {
        const store = storeFor(context, { closing: original });
        await requestWording(store, async () => ({ ok: true, text: "We will refit the bathroom over 2 weeks." }), "closing", "r1");
        expect(store.getState().suggestion).toMatchObject({ field: "closing", basedOn: original });
        expect(store.getState().draft.closing).toBe(original);
        expect(isReviewDirty(store.getState())).toBe(false);

        store.dispatch({ type: "suggestion/apply" });
        expect(store.getState().draft.closing).toBe("We will refit the bathroom over 2 weeks.");
        expect(store.getState().suggestion).toBeNull();
        // Applying changes the draft only; saving is still the contractor's step.
        expect(reviewSaveStatus(store.getState())).toBe("unsaved");
    });

    it("discards without touching the draft", async () => {
        const store = storeFor(context, { closing: original });
        await requestWording(store, async () => ({ ok: true, text: "Something else for 2 weeks." }), "closing", "r1");
        store.dispatch({ type: "suggestion/discard" });
        expect(store.getState().draft.closing).toBe(original);
        expect(store.getState().suggestion).toBeNull();
    });

    it("drops a suggestion that adds a figure the contractor did not write", async () => {
        const store = storeFor(context, { closing: original });
        await requestWording(store, async () => ({ ok: true, text: "With 25 years of experience we will refit it in 2 weeks." }), "closing", "r1");
        expect(store.getState().suggestion).toBeNull();
        expect(store.getState().ai).toMatchObject({ status: "failed", error: AI_ADDED_FIGURES_ERROR });
        expect(addedFigures("2 weeks, £1,200", "Two parts: 2 weeks and £1200.")).toEqual([]);
        expect(addedFigures("2 weeks", "14 days")).toEqual(["14"]);
    });

    it("will not apply wording written from text the contractor has since changed", async () => {
        const store = storeFor(context, { closing: original });
        await requestWording(store, async () => ({ ok: true, text: "We will refit the bathroom over 2 weeks." }), "closing", "r1");
        store.dispatch({ type: "draft/change", patch: { closing: "we will do the bathroom for 3 weeks" } });
        store.dispatch({ type: "suggestion/apply" });
        expect(store.getState().draft.closing).toBe("we will do the bathroom for 3 weeks");
        expect(store.getState().suggestion).not.toBeNull();
    });

    it("asks nothing for an empty field and runs one request at a time", async () => {
        const ask = vi.fn(async () => ({ ok: true as const, text: "Tidy." }));
        const empty = storeFor(context, { closing: "  " });
        await requestWording(empty, ask, "closing", "r1");
        expect(ask).not.toHaveBeenCalled();

        const store = storeFor(context, { closing: "words", scope: "more words" });
        await requestWording(store, ask, "closing", "r1");
        await requestWording(store, ask, "scope", "r2");
        expect(ask).toHaveBeenCalledTimes(1);
    });

    it("leaves the proposal usable when the assistant fails", async () => {
        const store = storeFor(context, { closing: original });
        await requestWording(store, async () => { throw new Error("down"); }, "closing", "r1");
        expect(store.getState().ai).toMatchObject({ status: "failed", error: AI_UNAVAILABLE_ERROR });
        expect(store.getState().draft.closing).toBe(original);
        await requestWording(store, async () => ({ ok: false, error: "" }), "closing", "r2");
        expect(store.getState().ai.error).toBe(AI_UNAVAILABLE_ERROR);
    });

    it("drops a reply to a request that is no longer current", () => {
        const store = storeFor(context, { closing: original });
        store.dispatch({ type: "ai/started", field: "closing", requestId: "r1" });
        store.dispatch({ type: "ai/succeeded", requestId: "stale", suggestion: { id: "stale", field: "closing", text: "x", basedOn: original } });
        expect(store.getState().suggestion).toBeNull();
    });
});

describe("response choice", () => {
    it("defaults to acknowledgement of receipt on every visit", () => {
        expect(storeFor(context).getState().responseKind).toBe("acknowledgement");
    });

    it("can be switched to a non-binding intention for this send, which asks for confirmation again", () => {
        const store = storeFor(context);
        store.dispatch({ type: "confirm/set", confirmed: true });
        store.dispatch({ type: "response/choose", kind: "non_binding_intent" });
        expect(store.getState().responseKind).toBe("non_binding_intent");
        expect(store.getState().confirmed).toBe(false);
    });
});

describe("send", () => {
    const ready = () => ({ ready: true });
    const deps = (publish: PublishProposal, save: SaveProposalDraft = okSave) => ({ save, publish, readiness: ready, deliverByEmail: true });

    it("is blocked, in order, by missing facts, a pending suggestion and a missing confirmation", () => {
        const store = storeFor(context);
        expect(sendBlock(store.getState(), { ready: false })).toBe("not-ready");
        expect(sendBlock(store.getState(), { ready: true })).toBe("not-confirmed");
        store.dispatch({ type: "confirm/set", confirmed: true });
        expect(sendBlock(store.getState(), { ready: true })).toBeNull();
        expect(sendBlock({ ...store.getState(), suggestion: { id: "s", field: "closing", text: "x", basedOn: "y" } }, { ready: true })).toBe("suggestion-pending");
        expect(sendBlock({ ...store.getState(), save: { status: "failed", error: "x" } }, { ready: true })).toBe("save-failed");
        expect(SEND_BLOCK_MESSAGE["not-confirmed"]).toContain("Tick the box");
    });

    it("does not publish without the contractor's explicit confirmation", async () => {
        const store = storeFor(context);
        const publish = vi.fn();
        await expect(sendProposal(store, deps(publish))).resolves.toBe("blocked");
        expect(publish).not.toHaveBeenCalled();
    });

    it("does not publish while required facts are missing, even when confirmed", async () => {
        const store = storeFor(context);
        store.dispatch({ type: "confirm/set", confirmed: true });
        const publish = vi.fn();
        await expect(sendProposal(store, { ...deps(publish), readiness: () => ({ ready: false }) })).resolves.toBe("blocked");
        expect(publish).not.toHaveBeenCalled();
    });

    it("publishes with the chosen response and reports the committed version", async () => {
        const store = storeFor(context);
        store.dispatch({ type: "response/choose", kind: "non_binding_intent" });
        store.dispatch({ type: "confirm/set", confirmed: true });
        const publish = vi.fn<PublishProposal>(async () => ({ ...published, delivery: { status: "sent", email: "alex@example.test" } }));
        await expect(sendProposal(store, deps(publish))).resolves.toBe("published");
        expect(publish).toHaveBeenCalledWith({ responseKind: "non_binding_intent", deliverByEmail: true });
        expect(store.getState().send.status).toBe("published");
        expect(store.getState().published).toMatchObject({ versionNumber: 1, responseKind: "non_binding_intent", delivery: { status: "sent" } });
        // A second send needs a fresh confirmation.
        expect(store.getState().confirmed).toBe(false);
    });

    it("asks to change a draft after ticking the box to be confirmed again", () => {
        const store = storeFor(context);
        store.dispatch({ type: "confirm/set", confirmed: true });
        store.dispatch({ type: "draft/change", patch: { closing: "Edited after ticking." } });
        expect(store.getState().confirmed).toBe(false);
    });

    it("saves unsaved changes first and stops, publishing nothing, when that save fails", async () => {
        const store = storeFor(contextFrom({ scope_text: null, brief_scope: "Refit the bathroom." }));
        store.dispatch({ type: "confirm/set", confirmed: true });
        const publish = vi.fn<PublishProposal>(async () => ({ ...published, delivery: { status: "not_requested" } }));

        await expect(sendProposal(store, deps(publish, async () => ({ success: false, error: "Could not save." })))).resolves.toBe("save-failed");
        expect(publish).not.toHaveBeenCalled();
        expect(store.getState().send.status).toBe("idle");
        expect(store.getState().draft.scope).toBe("Refit the bathroom.");

        // A failed save has to be put right before anything can be sent.
        expect(sendBlock(store.getState(), { ready: true })).toBe("save-failed");
        await expect(sendProposal(store, deps(publish))).resolves.toBe("blocked");
        expect(publish).not.toHaveBeenCalled();

        await expect(saveDraft(store, okSave)).resolves.toBe("saved");
        await expect(sendProposal(store, deps(publish))).resolves.toBe("published");
        expect(publish).toHaveBeenCalledTimes(1);
    });

    it("saves unsaved changes before publishing, so what is sent is what is on screen", async () => {
        const store = storeFor(context);
        store.dispatch({ type: "draft/change", patch: { closing: "Edited just before sending." } });
        store.dispatch({ type: "confirm/set", confirmed: true });
        const order: string[] = [];
        const save = vi.fn<SaveProposalDraft>(async (payload) => { order.push(`save:${payload.closing}`); return { success: true }; });
        const publish = vi.fn<PublishProposal>(async () => { order.push("publish"); return { ...published, delivery: { status: "not_requested" } }; });
        await expect(sendProposal(store, deps(publish, save))).resolves.toBe("published");
        expect(order).toEqual(["save:Edited just before sending.", "publish"]);
    });

    it("reports a refused publication as not published, keeps the draft and can be retried", async () => {
        const store = storeFor(context);
        store.dispatch({ type: "confirm/set", confirmed: true });
        const before = store.getState().draft;
        const publish = vi.fn<PublishProposal>()
            .mockResolvedValueOnce({ success: false, error: "" })
            .mockResolvedValueOnce({ ...published, delivery: { status: "not_requested" } });

        await expect(sendProposal(store, deps(publish))).resolves.toBe("failed");
        expect(store.getState().send).toEqual({ status: "failed", error: PUBLISH_ERROR });
        expect(store.getState().published).toBeNull();
        expect(store.getState().draft).toEqual(before);
        // The confirmation stands, so the retry is one press.
        await expect(sendProposal(store, deps(publish))).resolves.toBe("published");
    });

    it("does not claim success or failure when the reply is lost", async () => {
        const store = storeFor(context);
        store.dispatch({ type: "confirm/set", confirmed: true });
        await expect(sendProposal(store, deps(async () => { throw new Error("network"); }))).resolves.toBe("unknown");
        expect(store.getState().send).toEqual({ status: "unknown", error: PUBLISH_UNKNOWN_ERROR });
        expect(store.getState().published).toBeNull();
        // It must be checked and confirmed again before another send.
        expect(store.getState().confirmed).toBe(false);
    });

    it("never presents a committed publication as failed because its email failed", async () => {
        const store = storeFor(context);
        store.dispatch({ type: "confirm/set", confirmed: true });
        await expect(sendProposal(store, deps(async () => ({ ...published, delivery: { status: "failed", email: "alex@example.test" } })))).resolves.toBe("published");
        expect(store.getState().send.status).toBe("published");
        expect(store.getState().published?.delivery).toEqual({ status: "failed", email: "alex@example.test" });
        expect(store.getState().delivery.error).toBe(DELIVERY_ERROR);
    });

    it("retries the email for the same publication without publishing again", async () => {
        const store = storeFor(context);
        store.dispatch({ type: "confirm/set", confirmed: true });
        const publish = vi.fn<PublishProposal>(async () => ({ ...published, delivery: { status: "failed", email: "alex@example.test" } }));
        await sendProposal(store, deps(publish));

        const retry = vi.fn()
            .mockRejectedValueOnce(new Error("offline"))
            .mockResolvedValueOnce({ success: true, delivery: { status: "sent", email: "alex@example.test" } });
        await retryDelivery(store, retry);
        expect(store.getState().published?.delivery.status).toBe("failed");
        expect(store.getState().delivery).toEqual({ status: "idle", error: DELIVERY_ERROR });
        expect(store.getState().send.status).toBe("published");

        await retryDelivery(store, retry);
        expect(retry).toHaveBeenLastCalledWith({ publicationId: "pub-1", url: published.url });
        expect(store.getState().published?.delivery).toEqual({ status: "sent", email: "alex@example.test" });
        expect(store.getState().delivery.error).toBeNull();
        expect(publish).toHaveBeenCalledTimes(1);

        // Nothing to retry once it has been sent.
        await retryDelivery(store, retry);
        expect(retry).toHaveBeenCalledTimes(2);
    });
});
