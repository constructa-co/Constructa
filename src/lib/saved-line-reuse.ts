import { buildPricingReviewContext, prepareReviewedPriceDraft, reviewPricingSuggestion, PRICING_REVIEW_OPEN, PRICING_REVIEW_STALE, type PricingReviewContext } from "./pricing-review";
import { isSimpleEditable, MAX_DESCRIPTION_LENGTH, MAX_PRICE_ACTIVITY_LENGTH, type PriceLineDraft } from "./simple-estimate";
import type { Estimate } from "@/app/dashboard/projects/costs/types";

type Result<T> = { ok: true; value: T } | { ok: false; error: string };
export type SavedLineWording = { lineId: string; description: string; activity: string };
export type SavedLineReuseContext = { review: PricingReviewContext; sources: SavedLineWording[] };
export type ReviewedSavedLine = SavedLineWording & { projectId: string; estimateId: string | null; revision: string };

export function savedLineReuseContext(project: { id: string; brief_scope: string }, estimate: Estimate | null): Result<SavedLineReuseContext> {
    const review = buildPricingReviewContext(project, estimate);
    if (!review.ok) return review;
    if (!estimate) return { ok: false, error: "Choose an estimate with saved price lines first." };
    const ids = estimate.estimate_lines.map(line => line.id);
    if (new Set(ids).size !== ids.length) return { ok: false, error: "Price-line identities are ambiguous. Review the saved estimate before reusing wording." };
    return { ok: true, value: { review: review.value, sources: estimate.estimate_lines
        .filter(line => isSimpleEditable(line, estimate))
        .map(line => ({ lineId: line.id, description: line.description, activity: line.trade_section ?? "" })) } };
}

export function reviewSavedLine(source: SavedLineWording, context: SavedLineReuseContext): ReviewedSavedLine {
    return { ...source, projectId: context.review.projectId, estimateId: context.review.estimateId, revision: context.review.revision };
}

/** Source reuse only. The existing controller still owns explicit pricing and persistence. */
export function prepareSavedLineReuse(pending: ReviewedSavedLine, context: SavedLineReuseContext, hasOpenWork: boolean): Result<PriceLineDraft> {
    if (hasOpenWork) return { ok: false, error: PRICING_REVIEW_OPEN };
    const current = context.review;
    if (pending.projectId !== current.projectId || pending.estimateId !== current.estimateId || pending.revision !== current.revision) return { ok: false, error: PRICING_REVIEW_STALE };
    if (current.clientBoQ) return { ok: false, error: "Use the existing client BoQ workflow for this estimate." };
    const source = context.sources.find(line => line.lineId === pending.lineId);
    if (!source || source.description !== pending.description || source.activity !== pending.activity) return { ok: false, error: PRICING_REVIEW_STALE };
    if (source.description.length > MAX_DESCRIPTION_LENGTH) return { ok: false, error: "This saved wording is longer than 500 characters. Nothing has been shortened; enter a reviewed shorter description in a new line instead." };
    if (source.activity.length > MAX_PRICE_ACTIVITY_LENGTH || source.activity.trim() === "Preliminaries") return { ok: false, error: "This activity cannot be reused in a simple price draft. Manage Preliminaries in Advanced estimating; activity names must fit the existing 100-character limit." };
    const sourceContext = { ...current, contractorMessage: source.description };
    const reviewed = reviewPricingSuggestion(sourceContext, { message: "", suggestions: [{ source: "contractorMessage", start: 0, end: source.description.length }] });
    if (!reviewed.ok) return reviewed;
    const draft = prepareReviewedPriceDraft(reviewed.value, 0, sourceContext, false);
    return draft.ok ? { ok: true, value: { ...draft.value, activity: source.activity } } : draft;
}
