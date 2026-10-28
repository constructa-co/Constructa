/**
 * Running-total preview for Advanced estimating quantity/rate drafts only.
 * Uses the same parse and lineTotal rules as the Advanced row save path.
 * Other Advanced drafts (unit, description, build-up, resources, catalogue review)
 * are out of scope — preview is withheld until those are cleared.
 */

import type { EstimateLine } from "@/app/dashboard/projects/costs/types";
import type { AdvancedRunningTotalDraft } from "./simple-estimate";
import { lineTotal, parseAdvancedQuantityDraft } from "./simple-estimate";

type QuantityLikeDraft = { line: EstimateLine; raw: string; context: string };

export function advancedQuantityDraftValid(draft: QuantityLikeDraft): boolean {
    const quantity = parseAdvancedQuantityDraft(draft.raw);
    return quantity !== null && Number.isFinite(quantity * draft.line.unit_rate);
}

export function advancedRateDraftValid(draft: QuantityLikeDraft): boolean {
    const rate = parseAdvancedQuantityDraft(draft.raw);
    return rate !== null && Number.isFinite(draft.line.quantity * rate);
}

function proposedLineTotalFromQuantity(draft: QuantityLikeDraft): number | null {
    const quantity = parseAdvancedQuantityDraft(draft.raw);
    if (quantity === null || !Number.isFinite(quantity * draft.line.unit_rate)) return null;
    return lineTotal(quantity, draft.line.unit_rate);
}

function proposedLineTotalFromRate(draft: QuantityLikeDraft): number | null {
    const rate = parseAdvancedQuantityDraft(draft.raw);
    if (rate === null || !Number.isFinite(draft.line.quantity * rate)) return null;
    return lineTotal(draft.line.quantity, rate);
}

function lineAllowsAdvancedMoneyDraft(line: EstimateLine, isClientBoQ: boolean): boolean {
    return !isClientBoQ && line.pricing_mode === "simple" && line.trade_section !== "Preliminaries";
}

export function computeAdvancedRunningTotalDraft(input: {
    estimateId: string;
    contextToken: string;
    isClientBoQ: boolean;
    quantityDraft: QuantityLikeDraft | null;
    rateDraft: QuantityLikeDraft | null;
    quantityPending: boolean;
    quantityConsumed: boolean;
    ratePending: boolean;
    rateConsumed: boolean;
    quantityMessage: string;
    rateMessage: string;
    hasOtherDraftWork: boolean;
    hasPendingOrUncertainLineWork: boolean;
    hasBlockingResourceWork: boolean;
}): AdvancedRunningTotalDraft | null {
    if (
        input.hasOtherDraftWork ||
        input.hasPendingOrUncertainLineWork ||
        input.hasBlockingResourceWork ||
        input.quantityPending ||
        input.quantityConsumed ||
        input.ratePending ||
        input.rateConsumed ||
        input.quantityMessage ||
        input.rateMessage
    ) {
        return null;
    }

    const lineTotals: Record<string, number> = {};

    if (input.quantityDraft && input.quantityDraft.context === input.contextToken) {
        const { line } = input.quantityDraft;
        if (!lineAllowsAdvancedMoneyDraft(line, input.isClientBoQ)) return null;
        const total = proposedLineTotalFromQuantity(input.quantityDraft);
        if (total === null) return null;
        if (total !== line.line_total) lineTotals[line.id] = total;
    }

    if (input.rateDraft && input.rateDraft.context === input.contextToken) {
        const { line } = input.rateDraft;
        if (!lineAllowsAdvancedMoneyDraft(line, input.isClientBoQ)) return null;
        const total = proposedLineTotalFromRate(input.rateDraft);
        if (total === null) return null;
        if (total !== line.line_total) {
            if (lineTotals[line.id] !== undefined && lineTotals[line.id] !== total) return null;
            lineTotals[line.id] = total;
        }
    }

    return Object.keys(lineTotals).length > 0
        ? { estimateId: input.estimateId, contextToken: input.contextToken, lineTotals }
        : null;
}
