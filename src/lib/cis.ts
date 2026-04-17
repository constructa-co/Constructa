/**
 * Constructa — UK Construction Industry Scheme (CIS) helpers.
 *
 * Pure functions, no DB calls, so they can be tested and reused
 * across server actions and client components.
 *
 * Background: the CIS deduction (20% verified, 30% unverified, 0%
 * gross-status) applies to the LABOUR element of a payment only.
 * Materials are excluded. The contractor enters the gross amount
 * and a materials breakdown, and the labour element is the
 * difference.
 *
 * Plant-hire handling (HMRC IR35 / ESM5525):
 *   - Plant hired WITH an operator (i.e. a skilled person running
 *     the kit) → the supply is treated as a service and the operator
 *     cost is LABOUR within CIS.
 *   - Plant hired WITHOUT an operator (self-drive) → the supply is
 *     treated as goods and is MATERIALS — no CIS deduction.
 * The contractor makes this split when entering the payment.
 */

/**
 * `unverified` is a DB-level state meaning "subcontractor has been added
 * but not verified against HMRC yet". Per HMRC rules, payments to
 * unverified subcontractors attract the 30% higher rate until
 * verification is complete — so `unverified` and `higher` produce the
 * same deduction percentage.
 */
export type CisStatus = "gross" | "standard" | "higher" | "unverified";

export interface CisDeductionInputs {
    /** Total invoice amount (labour + materials, ex-VAT). */
    gross: number;
    /** Materials portion — plant without operator, supplies, goods. */
    materials: number;
    /** Subcontractor's CIS verification status. */
    status: CisStatus;
}

export interface CisDeductionResult {
    /** Implicit labour element = gross − materials (clamped ≥ 0). */
    labour: number;
    /** Applied deduction percentage (0, 20 or 30). */
    rate: number;
    /** Deduction amount, rounded to pence. */
    deduction: number;
    /** Net payment to subcontractor after deduction. */
    net: number;
}

/**
 * Return the CIS deduction rate for a given verification status.
 * Uses HMRC's published rates.
 */
export function deductionRate(status: CisStatus): number {
    switch (status) {
        case "gross":      return 0;
        case "standard":   return 20;
        case "higher":     return 30;
        case "unverified": return 30; // HMRC: treat as higher rate until verified
        default: {
            // Exhaustiveness check — TypeScript will flag this if a new
            // status is added to the union without a case here.
            const _exhaustive: never = status;
            void _exhaustive;
            return 30;
        }
    }
}

/**
 * Calculate the CIS deduction and net payment for a subcontractor
 * invoice. Follows HMRC rules: deduction only applies to labour,
 * materials are excluded. If materials > gross, the labour element
 * is clamped to 0 (no negative labour, no negative deduction).
 */
export function calculateCisDeduction(input: CisDeductionInputs): CisDeductionResult {
    const gross = Math.max(0, Number(input.gross) || 0);
    const materials = Math.max(0, Number(input.materials) || 0);
    const labour = Math.max(0, gross - materials);
    const rate = deductionRate(input.status);
    // Round to pence — HMRC expects whole-pence amounts on statements.
    const deduction = Math.round(labour * rate) / 100;
    const net = Math.round((gross - deduction) * 100) / 100;
    return { labour, rate, deduction, net };
}

/**
 * UK tax month boundaries: a tax month runs from the 6th of one
 * month to the 5th of the next (HMRC RTI). Returns the YYYY-MM-06
 * start date of the tax month a given payment falls into.
 */
export function getTaxMonthStart(paymentDate: string): string {
    const d = new Date(paymentDate + "T00:00:00Z");
    const day = d.getUTCDate();
    let year = d.getUTCFullYear();
    let month = d.getUTCMonth() + 1; // 1-indexed
    if (day < 6) {
        // Belongs to previous tax month
        month -= 1;
        if (month === 0) {
            month = 12;
            year -= 1;
        }
    }
    return `${year}-${String(month).padStart(2, "0")}-06`;
}
