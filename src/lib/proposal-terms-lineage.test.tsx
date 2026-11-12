import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/app/dashboard/projects/proposal/actions", () => ({
    getProposalPublicationAction: vi.fn(), publishProposalAction: vi.fn(), retryProposalDeliveryAction: vi.fn(),
    saveProposalDraftAction: vi.fn(), suggestProposalWordingAction: vi.fn(), uploadPhotoAction: vi.fn(),
}));
import { representativeInput } from "./__fixtures__/proposal";
import { PROPOSAL_TERMS_PROFILE_VERSION, STANDARD_PROPOSAL_TERMS, resolveProposalTerms } from "./proposal-terms";
import { buildPreviewSnapshot, buildProposalPayload, draftFromProject, initialReviewState, isReviewDirty, reviewReadiness, reviewReducer, saveDraft, savedDraftFromProject, type ReviewContext, type ReviewStore, type SaveProposalDraft } from "./proposal-review";
import { buildProposalDocument } from "./proposal-document";
import { renderProposalBrochure } from "./pdf/proposal-brochure";
import ReviewSendClient from "@/app/dashboard/projects/proposal/review-send-client";

const NOW = "2026-10-05T09:00:00.000Z";
function context(tc_overrides: ReviewContext["project"]["tc_overrides"]): ReviewContext {
    const input = representativeInput();
    return { project: { ...input.project, validity_days: 30, client_email: "labelled-unit-client@example.test", tc_overrides }, profile: input.profile, estimate: input.estimate, nextVersion: 1 };
}
const key = () => "unit-stage";
function storeFor(c: ReviewContext): ReviewStore {
    let state = initialReviewState(draftFromProject(c.project, key), savedDraftFromProject(c.project, key));
    return { getState: () => state, dispatch: action => { state = reviewReducer(state, action); } };
}
describe("stored terms lineage, not legal authority", () => {
    it.each([null, undefined])("retains the existing default contract for %j without labelling it Robert's original", value => {
        const c = context(value), draft = draftFromProject(c.project, key);
        expect(draft.terms).toBeNull(); expect(resolveProposalTerms(draft.terms)).toEqual(STANDARD_PROPOSAL_TERMS);
        expect(buildPreviewSnapshot(c, draft, "acknowledgement", NOW)!.terms.profile_version).toBe(PROPOSAL_TERMS_PROFILE_VERSION);
    });
    it("preserves an explicitly saved empty list in both editor and saved baseline", () => {
        const c = context([]), draft = draftFromProject(c.project, key), saved = savedDraftFromProject(c.project, key);
        expect(draft.terms).toEqual([]); expect(saved.terms).toEqual([]);
        expect(isReviewDirty(initialReviewState(draft, saved))).toBe(false); expect(c.project.tc_overrides).toEqual([]);
    });
    it("does not reintroduce the standard clauses into the explicit draft save payload", () => {
        const c = context([]), built = buildProposalPayload(draftFromProject(c.project, key));
        expect(built.ok).toBe(true); if (built.ok) expect(built.payload.terms).toEqual([]);
    });
    it("agrees with the existing publication minimum rather than showing a sendable default", () => {
        const c = context([]), draft = draftFromProject(c.project, key), readiness = reviewReadiness(c, draft);
        expect(resolveProposalTerms(c.project.tc_overrides)).toEqual([]);
        expect(readiness.ready).toBe(false); expect(readiness.missing.map(item => item.key)).toContain("terms");
        expect(buildPreviewSnapshot(c, draft, "acknowledgement", NOW)).toBeNull();
    });
    it("shows zero terms in the actual review section after reload, without a server call", () => {
        const html = renderToStaticMarkup(<ReviewSendClient context={context([])} caseStudies={[]} lockReason={null} estimateIssue={null} publications={[]} now={NOW} />);
        const terms = html.slice(html.indexOf('id="review-terms"'), html.indexOf('id="review-closing"'));
        expect(terms).toContain("0 terms are shown to the client"); expect(terms).toContain("none");
        expect(terms).not.toContain("Jurisdiction"); expect(terms).not.toContain("12 terms");
    });
    it("saves only after explicit intent and keeps the empty list through an unrelated wording edit", async () => {
        const store = storeFor(context([])), save = vi.fn<SaveProposalDraft>(async () => ({ success: true as const }));
        expect(save).not.toHaveBeenCalled(); store.dispatch({ type: "draft/change", patch: { closing: "Labelled unit-test closing" } });
        expect(save).not.toHaveBeenCalled(); expect(await saveDraft(store, save)).toBe("saved");
        expect(save).toHaveBeenCalledTimes(1); expect(save.mock.calls[0][0].terms).toEqual([]);
        expect(store.getState().saved.terms).toEqual([]);
    });
    it("keeps deliberately restored null defaults distinct from an empty list", () => {
        const store = storeFor(context([])); store.dispatch({ type: "draft/change", patch: { terms: null } });
        expect(store.getState().draft.terms).toBeNull(); expect(resolveProposalTerms(store.getState().draft.terms)).toHaveLength(12);
    });
    it("keeps an all-hidden custom list empty after resolution, without fallback", () => {
        const c = context([{ clause_number: 41, title: "Labelled hidden unit clause", body: "Synthetic test wording only", hidden: true, custom: true }]);
        const draft = draftFromProject(c.project, key); expect(draft.terms).toHaveLength(1); expect(resolveProposalTerms(draft.terms)).toEqual([]);
        expect(reviewReadiness(c, draft).missing.map(item => item.key)).toContain("terms");
    });
    it("carries visible custom clause wording/order through snapshot, document and actual local PDF text", () => {
        const c = context([
            { clause_number: 17, title: "UNIT ALPHA", body: "Labelled synthetic alpha wording.", custom: true },
            { clause_number: 22, title: "UNIT HIDDEN", body: "Labelled synthetic hidden wording.", hidden: true },
            { clause_number: 35, title: "UNIT BETA", body: "Labelled synthetic beta wording.", custom: true },
        ]);
        const draft = draftFromProject(c.project, key), snapshot = buildPreviewSnapshot(c, draft, "acknowledgement", NOW)!;
        expect(snapshot.terms.clauses.map(x => [x.title, x.body])).toEqual([["UNIT ALPHA", "Labelled synthetic alpha wording."], ["UNIT BETA", "Labelled synthetic beta wording."]]);
        const doc = buildProposalDocument(snapshot, { isDraft: true }), block = doc.sections.find(s => s.id === "terms")!.blocks[0];
        expect(block).toMatchObject({ type: "terms", clauses: [{ number: 1, title: "UNIT ALPHA" }, { number: 2, title: "UNIT BETA" }] });
        const output = renderProposalBrochure(doc, new Map()).doc.output();
        expect(output).toContain("UNIT ALPHA"); expect(output).toContain("UNIT BETA"); expect(output).not.toContain("UNIT HIDDEN");
        expect(output.indexOf("UNIT ALPHA")).toBeLessThan(output.indexOf("UNIT BETA"));
    });
});
