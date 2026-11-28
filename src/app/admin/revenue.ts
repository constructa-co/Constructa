/**
 * Admin revenue truth (D124 N5.1).
 *
 * Revenue figures come only from verified billing data. No billing provider
 * is connected, so revenue is unavailable: unknown, which is different from
 * zero. A signup is an account, not a paying customer, and no plan price is
 * assumed. Everything derived from revenue (margin, gross profit, EBITDA,
 * Rule of 40, forecasts, report lines) is unavailable too.
 */

import type { RevenueMetrics } from "./types";

export const NO_VERIFIED_BILLING_LABEL = "Unavailable";
export const NO_VERIFIED_BILLING_NOTE = "No verified billing data. Signups are accounts, not revenue.";
export const NO_VERIFIED_BILLING_DETAIL =
    "Revenue, margin, Rule of 40 and forecasts stay unavailable until real billing data exists. No plan price is assumed and signups are never counted as revenue.";

/** Revenue as it stands: no verified billing, so nothing is known. */
export function revenueWithoutVerifiedBilling(): RevenueMetrics {
    return {
        status: "no_verified_billing",
        mrr: null,
        arr: null,
        arpu: null,
        ltv: null,
        mrrByMonth: [],
        momGrowthPct: null,
        qoqGrowthPct: null,
        yoyGrowthPct: null,
        projectedArrEoy: null,
    };
}

/** Gross margin %, or null when revenue is unknown or not positive. */
export function grossMarginPct(revenueGbp: number | null, costGbp: number): number | null {
    if (revenueGbp === null || revenueGbp <= 0) return null;
    return ((revenueGbp - costGbp) / revenueGbp) * 100;
}

/** Revenue growth % + margin %, or null when either is unknown. */
export function ruleOf40Score(revenueGrowthPct: number | null, marginPct: number | null): number | null {
    return revenueGrowthPct === null || marginPct === null ? null : revenueGrowthPct + marginPct;
}

/** £ figure, or "Unavailable" when unknown. Unknown is never shown as £0. */
export function gbpOrUnavailable(n: number | null, format: (value: number) => string): string {
    return n === null ? NO_VERIFIED_BILLING_LABEL : format(n);
}
