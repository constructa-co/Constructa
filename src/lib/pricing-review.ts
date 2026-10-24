import { z } from "zod";
import { MAX_SCOPE_LENGTH, splitScope } from "./guided-brief";
import { EMPTY_PRICE_LINE_DRAFT, MAX_DESCRIPTION_LENGTH, type PriceLineDraft } from "./simple-estimate";
import type { Estimate } from "@/app/dashboard/projects/costs/types";

export interface PricingReviewContext {
    projectId: string;
    estimateId: string | null;
    work: string;
    contractorMessage: string;
    existingWork: { description: string; section: string }[];
    /** Internal stale-review guard. Never send this pricing snapshot to a model or log it. */
    revision: string;
    clientBoQ: boolean;
}
type Result<T> = { ok: true; value: T } | { ok: false; error: string };
export const PRICING_REVIEW_STALE = "The job or estimate changed after this was prepared. Review the current work before starting a draft.";
export const PRICING_REVIEW_OPEN = "Finish or cancel the open estimating work before starting another draft.";

/** No calls or writes. This is a client review guard, not server authorisation. */
export function buildPricingReviewContext(project: { id: string; brief_scope: string }, estimate: Estimate | null, contractorMessage = ""): Result<PricingReviewContext> {
    if (!project.id || (estimate && estimate.project_id !== project.id)) return { ok: false, error: "This estimate does not belong to the current job." };
    const { work } = splitScope(project.brief_scope);
    if (work.length > MAX_SCOPE_LENGTH || contractorMessage.length > MAX_SCOPE_LENGTH) return { ok: false, error: "The source text is too long for this review. Your saved wording is unchanged." };
    const lines = estimate?.estimate_lines ?? [];
    if (lines.some(line => line.estimate_id !== estimate?.id)) return { ok: false, error: "A price line does not belong to the selected estimate." };
    const revision = JSON.stringify({ projectId: project.id, briefScope: project.brief_scope, contractorMessage, estimate: estimate ? {
        id: estimate.id, projectId: estimate.project_id, isActive: estimate.is_active, clientBoQ: estimate.is_client_boq,
        overhead: estimate.overhead_pct, profit: estimate.profit_pct, risk: estimate.risk_pct, prelims: estimate.prelims_pct,
        discount: estimate.discount_pct, total: estimate.total_cost,
        lines: lines.map(line => ({ id: line.id, description: line.description, section: line.trade_section, quantity: line.quantity,
            unit: line.unit, rate: line.unit_rate, total: line.line_total, mode: line.pricing_mode, components: line.estimate_line_components })),
    } : null });
    return { ok: true, value: { projectId: project.id, estimateId: estimate?.id ?? null, work, contractorMessage,
        existingWork: lines.map(line => ({ description: line.description, section: line.trade_section })),
        revision, clientBoQ: !!estimate?.is_client_boq } };
}

/** An allowlisted future model input, not an outbound request. Free text may still contain personal data. */
export function pricingModelData(context: PricingReviewContext) {
    return { work: context.work, contractorMessage: context.contractorMessage, existingWork: context.existingWork.map(line => ({ ...line })) };
}

const SourceRangeSchema = z.object({ source: z.enum(["briefWork", "contractorMessage"]), start: z.number().int().nonnegative(), end: z.number().int().positive() }).strict();
export const PricingSuggestionSchema = z.object({ message: z.string().max(1200), suggestions: z.array(SourceRangeSchema).max(8) }).strict();
type SourceRange = z.infer<typeof SourceRangeSchema>;
export interface PendingPricingReview {
    projectId: string;
    estimateId: string | null;
    revision: string;
    /** Untrusted plain reply text; it never becomes an action or a price. */
    message: string;
    suggestions: (SourceRange & { description: string })[];
}

function descriptionFromSource(context: PricingReviewContext, range: SourceRange): Result<string> {
    const source = range.source === "briefWork" ? context.work : context.contractorMessage;
    if (!Number.isSafeInteger(range.start) || !Number.isSafeInteger(range.end) || range.end <= range.start || range.end > source.length) return { ok: false, error: "The suggestion does not quote a valid part of your source text." };
    // Match the existing single-line description input without dropping words.
    const description = source.slice(range.start, range.end).replace(/\s+/g, " ").trim();
    if (!description || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(description)) return { ok: false, error: "The quoted work is blank or contains unsupported control characters." };
    if (description.length > MAX_DESCRIPTION_LENGTH) return { ok: false, error: "This work is longer than one 500-character price line. Choose a shorter activity; nothing has been truncated." };
    return { ok: true, value: description };
}

/** Validate an untrusted reply into pending review only. Unknown action/price fields are refused. */
export function reviewPricingSuggestion(context: PricingReviewContext, reply: unknown): Result<PendingPricingReview> {
    const parsed = PricingSuggestionSchema.safeParse(reply);
    if (!parsed.success) return { ok: false, error: "This suggestion could not be reviewed. It has not changed the estimate." };
    const suggestions: PendingPricingReview["suggestions"] = [];
    const seen = new Set<string>();
    for (const range of parsed.data.suggestions) {
        const description = descriptionFromSource(context, range);
        if (!description.ok) return description;
        const key = JSON.stringify(range);
        if (seen.has(key)) return { ok: false, error: "The suggestion repeats the same source activity. Nothing has changed." };
        seen.add(key);
        suggestions.push({ ...range, description: description.value });
    }
    return { ok: true, value: { projectId: context.projectId, estimateId: context.estimateId, revision: context.revision, message: parsed.data.message, suggestions } };
}

/** Called only after an explicit user choice. Still returns an unsaved draft, never a write. */
export function prepareReviewedPriceDraft(pending: PendingPricingReview, index: number, current: PricingReviewContext, hasOpenWork: boolean): Result<PriceLineDraft> {
    if (hasOpenWork) return { ok: false, error: PRICING_REVIEW_OPEN };
    if (pending.projectId !== current.projectId || pending.estimateId !== current.estimateId || pending.revision !== current.revision) return { ok: false, error: PRICING_REVIEW_STALE };
    if (current.clientBoQ) return { ok: false, error: "Use the existing client BoQ workflow for this estimate." };
    if (!Number.isSafeInteger(index) || index < 0) return { ok: false, error: "Choose one reviewed source activity." };
    const suggestion = pending.suggestions[index];
    if (!suggestion || !SourceRangeSchema.safeParse({ source: suggestion.source, start: suggestion.start, end: suggestion.end }).success) return { ok: false, error: "Choose one reviewed source activity." };
    const description = descriptionFromSource(current, suggestion);
    if (!description.ok) return description;
    if (description.value !== suggestion.description) return { ok: false, error: PRICING_REVIEW_STALE };
    return { ok: true, value: { ...EMPTY_PRICE_LINE_DRAFT, description: description.value } };
}
