import { roundMoney } from "./financial";

/** Allow minor float/rounding drift when comparing saved percentage totals. */
export const PAYMENT_PERCENTAGE_TOLERANCE = 0.01;

export function sumPaymentStagePercentages(rows: Array<{ percentage: number }>): number {
    return roundMoney(rows.reduce((sum, row) => sum + row.percentage, 0));
}

export function paymentStagesExceedHundredPercent(total: number): boolean {
    return total > 100 + PAYMENT_PERCENTAGE_TOLERANCE;
}

export function paymentStagesMeetHundredPercent(total: number): boolean {
    return total >= 100 - PAYMENT_PERCENTAGE_TOLERANCE && total <= 100 + PAYMENT_PERCENTAGE_TOLERANCE;
}

export function paymentStagesUnderHundredPercent(total: number): boolean {
    return total < 100 - PAYMENT_PERCENTAGE_TOLERANCE;
}

export const PAYMENT_STAGES_OVER_100_ERROR = "The payment stages add up to more than 100%.";
export const PAYMENT_STAGES_UNDER_100_ERROR = "The payment stages must add up to 100% before they can be saved.";

/**
 * Percentage-based payment saves: empty is allowed (draft-in-progress), non-empty
 * rows must total 100%. Fixed-amount schedules are validated elsewhere.
 */
export function validatePercentagePaymentStagesForPersist(
    rows: Array<{ percentage: number }> | null | undefined,
): { ok: true } | { ok: false; error: string } {
    const list = rows ?? [];
    if (list.length === 0) return { ok: true };
    const total = sumPaymentStagePercentages(list);
    if (paymentStagesExceedHundredPercent(total)) return { ok: false, error: PAYMENT_STAGES_OVER_100_ERROR };
    if (paymentStagesUnderHundredPercent(total)) return { ok: false, error: PAYMENT_STAGES_UNDER_100_ERROR };
    return { ok: true };
}