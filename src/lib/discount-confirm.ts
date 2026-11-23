/** Discounts above this percentage need contractor confirmation and a reason before save. */
export const HIGH_DISCOUNT_THRESHOLD_PCT = 25;

export const HIGH_DISCOUNT_REASON_REQUIRED =
    "Say why you are offering a discount over 25%.";

export const HIGH_DISCOUNT_CONFIRM_TITLE = "Confirm this discount";

export const HIGH_DISCOUNT_CONFIRM_BODY =
    "You are about to save a discount above 25%. The client will see the discount and reason on the proposal.";

export const HIGH_DISCOUNT_WARNING_BODY =
    "This is a large discount. Check the total before you confirm.";

export function discountNeedsConfirmation(discountPct: number): boolean {
    return discountPct > HIGH_DISCOUNT_THRESHOLD_PCT;
}

/** Large discounts above the threshold show an extra warning, including 100%. */
export function showHighDiscountWarning(discountPct: number): boolean {
    return discountPct > HIGH_DISCOUNT_THRESHOLD_PCT;
}

export function highDiscountRequiresReason(discountPct: number, discountReason: string): boolean {
    return discountNeedsConfirmation(discountPct) && !discountReason.trim();
}

export type DiscountSubmitGate =
    | { ok: true }
    | { ok: false; needsConfirm: true; discountPct: number; showWarning: boolean }
    | { ok: false; needsConfirm?: false; fieldErrors: { discountReason?: string } };

export function evaluateDiscountSubmitGate(
    discountPct: number,
    discountReason: string,
    contractorConfirmed: boolean,
): DiscountSubmitGate {
    if (!discountNeedsConfirmation(discountPct)) return { ok: true };
    const reason = discountReason.trim();
    if (!reason) return { ok: false, fieldErrors: { discountReason: HIGH_DISCOUNT_REASON_REQUIRED } };
    if (!contractorConfirmed) {
        return {
            ok: false,
            needsConfirm: true,
            discountPct,
            showWarning: showHighDiscountWarning(discountPct),
        };
    }
    return { ok: true };
}