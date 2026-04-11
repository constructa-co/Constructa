/**
 * Canonical financial functions — the single source of truth for every
 * money calculation that drives KPIs, PDFs, P&L, billing, overview, and
 * management accounts.
 *
 * Sprint 58 Phase 1 item #8. Perplexity audit Grade F on testing:
 * 62,000 lines, 0 tests, highest-risk area is financial calculations.
 * These functions previously lived inline in four different files
 * (proposal-pdf-button.tsx, client-editor.tsx, billing/page.tsx,
 * overview/page.tsx) which caused the £1,593 vs £1,753 discrepancy
 * fixed in Sprint 57 — the billing page had silently diverged from
 * the proposal.
 *
 * Centralising them here achieves three things:
 *   1. Vitest can import them directly and assert on pure functions.
 *   2. Any future drift gets caught by the tests.
 *   3. When we refactor the PDF generator in Sprint 58 P3, it can
 *      import these instead of re-rolling the math a fifth time.
 *
 * The QS cost hierarchy (locked by Robert's domain spec):
 *
 *   1. Direct Cost            — sum of all non-Preliminaries line totals
 *   2. + Preliminaries        — explicit lines if present, else directCost × prelims_pct
 *   3. = Total Construction Cost
 *   4. + Overhead             — totalConstruction × overhead_pct
 *   5. = Cost + Overhead
 *   6. + Risk                 — costPlusOverhead × risk_pct
 *   7. = Adjusted Total
 *   8. + Profit               — adjusted × profit_pct
 *   9. = Pre-Discount Total
 *  10. − Discount             — preDiscount × discount_pct
 *  11. = Contract Sum (exc. VAT)  ← shown to client
 *
 * Overhead / Risk / Profit / Discount are compounded in that order;
 * they do NOT commute. Prelims-then-compound is the correct RICS
 * hierarchy. Changing any step breaks contractor trust.
 */

// ── Input types ──────────────────────────────────────────────────────────────

/** A minimal estimate row — just the fields the math cares about. */
export interface EstimateInput {
    prelims_pct?: number | string | null;
    overhead_pct?: number | string | null;
    risk_pct?: number | string | null;
    profit_pct?: number | string | null;
    discount_pct?: number | string | null;
    /** Legacy fallback when there are no line rows at all. */
    total_cost?: number | string | null;
}

/** A minimal estimate line — just the fields the math cares about. */
export interface EstimateLineInput {
    trade_section?: string | null;
    line_total?: number | string | null;
    quantity?: number | string | null;
    unit_rate?: number | string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Coerce a number|string|null|undefined to a safe number. NaN → 0. */
export function toNumber(v: number | string | null | undefined): number {
    if (v == null) return 0;
    if (typeof v === "number") return Number.isFinite(v) ? v : 0;
    const parsed = Number(v);
    return Number.isFinite(parsed) ? parsed : 0;
}

/** Round to 2 decimal places (standard money rounding). */
export function roundMoney(n: number): number {
    return Math.round(n * 100) / 100;
}

// ── Canonical contract sum ──────────────────────────────────────────────────

/**
 * Full breakdown of the contract sum calculation.
 * Used by the proposal PDF, proposal editor, billing page, overview RAG,
 * and the P&L dashboard. All five sites MUST produce the same number.
 */
export interface ContractSumBreakdown {
    directCost: number;
    prelimsTotal: number;
    totalConstructionCost: number;
    overheadAmount: number;
    riskAmount: number;
    profitAmount: number;
    discountAmount: number;
    contractSum: number;
    /** Handy multiplier for converting a single line rate into an all-in rate. */
    ohRiskProfitMultiplier: number;
}

/**
 * Canonical QS contract sum. Mirrors computeEstimateContractSum() in the
 * proposal editor exactly, but now lives in one place.
 */
export function computeContractSum(
    estimate: EstimateInput,
    lines: EstimateLineInput[]
): ContractSumBreakdown {
    // 1. Direct cost — everything that isn't a Preliminaries line.
    const directCost = lines
        .filter(
            (l) =>
                (l.trade_section ?? "General") !== "Preliminaries" &&
                toNumber(l.line_total) > 0
        )
        .reduce((sum, l) => sum + toNumber(l.line_total), 0);

    // 2. Preliminaries — explicit lines take precedence over the percentage.
    const explicitPrelimsLines = lines.filter(
        (l) => (l.trade_section ?? "") === "Preliminaries"
    );
    const explicitPrelimsTotal = explicitPrelimsLines.reduce(
        (sum, l) => sum + toNumber(l.line_total),
        0
    );

    // Fallback base for prelims when there are no lines at all
    // (legacy estimates with only a total_cost value).
    const fallbackBase =
        directCost > 0 ? directCost : toNumber(estimate.total_cost);
    const prelimsFromPct = fallbackBase * (toNumber(estimate.prelims_pct) / 100);
    const prelimsTotal =
        explicitPrelimsLines.length > 0 ? explicitPrelimsTotal : prelimsFromPct;

    // 3. Total construction cost.
    const totalConstructionCost = fallbackBase + prelimsTotal;

    // 4-7. Overhead → Risk → Profit, compounded in that order.
    const overheadPct = toNumber(estimate.overhead_pct);
    const riskPct = toNumber(estimate.risk_pct);
    const profitPct = toNumber(estimate.profit_pct);
    const discountPct = toNumber(estimate.discount_pct);

    const overheadAmount = totalConstructionCost * (overheadPct / 100);
    const costPlusOverhead = totalConstructionCost + overheadAmount;
    const riskAmount = costPlusOverhead * (riskPct / 100);
    const adjustedTotal = costPlusOverhead + riskAmount;
    const profitAmount = adjustedTotal * (profitPct / 100);
    const preDiscount = adjustedTotal + profitAmount;
    const discountAmount = preDiscount * (discountPct / 100);

    const contractSum = preDiscount - discountAmount;

    // Multiplier used by the PDF to convert a raw line rate into an all-in
    // rate displayed to the client (matches the same order of compounding).
    const ohRiskProfitMultiplier =
        (1 + overheadPct / 100) *
        (1 + riskPct / 100) *
        (1 + profitPct / 100) *
        (1 - discountPct / 100);

    return {
        directCost,
        prelimsTotal,
        totalConstructionCost,
        overheadAmount,
        riskAmount,
        profitAmount,
        discountAmount,
        contractSum,
        ohRiskProfitMultiplier,
    };
}

/** Shorthand: just the final contract sum, rounded. */
export function computeContractSumValue(
    estimate: EstimateInput,
    lines: EstimateLineInput[]
): number {
    return roundMoney(computeContractSum(estimate, lines).contractSum);
}

// ── Budget cost (no margins) ────────────────────────────────────────────────

/**
 * Total budget cost = direct + prelims, no uplifts. This is what shows in
 * the P&L "Budget Cost" KPI and drives the burn bar.
 */
export function computeBudgetCost(
    estimate: EstimateInput,
    lines: EstimateLineInput[]
): number {
    const { totalConstructionCost } = computeContractSum(estimate, lines);
    return totalConstructionCost;
}

// ── AfP netting (Billing) ────────────────────────────────────────────────────

export interface AfpInput {
    gross_valuation: number | string;
    previous_cert: number | string;
    retention_pct: number | string;
}

export interface AfpBreakdown {
    grossThisCert: number;
    retentionHeld: number;
    netDue: number;
}

/**
 * Application for Payment netting. Gross valuation minus previous
 * certifications minus retention → net due. Clamped so a previous cert
 * greater than the gross never produces a negative net.
 */
export function computeAfp(input: AfpInput): AfpBreakdown {
    const gross = toNumber(input.gross_valuation);
    const prev = toNumber(input.previous_cert);
    const retPct = toNumber(input.retention_pct);

    const grossThisCert = Math.max(0, gross - prev);
    const retentionHeld = gross * (retPct / 100);
    const netDue = Math.max(0, grossThisCert - retentionHeld);

    return {
        grossThisCert: roundMoney(grossThisCert),
        retentionHeld: roundMoney(retentionHeld),
        netDue: roundMoney(netDue),
    };
}

// ── Forecast at completion (P&L + Overview RAG) ─────────────────────────────

export interface ForecastInput {
    /** Budget by trade section — derived from non-Preliminaries estimate lines. */
    budgetBySection: Record<string, number>;
    /** Actual spend by section from project_expenses where cost_status = 'actual'. */
    actualBySection: Record<string, number>;
    /** Committed (PO'd but not invoiced) spend by section from cost_status = 'committed'. */
    committedBySection: Record<string, number>;
    /** User-entered per-section forecast overrides (from project_section_forecasts). */
    overrides?: Record<string, number>;
}

/**
 * Forecast final cost. Per section:
 *   override  if the user entered one
 *   actual + committed + remaining_budget  otherwise
 * where remaining_budget = max(0, budget − actual − committed).
 *
 * This is the same logic the P&L dashboard and the overview RAG already
 * run — centralised here so the unit tests can pin it.
 */
export function computeForecastFinal(input: ForecastInput): number {
    const overrides = input.overrides ?? {};
    const sections = new Set<string>([
        ...Object.keys(input.budgetBySection),
        ...Object.keys(input.actualBySection),
        ...Object.keys(input.committedBySection),
    ]);

    let total = 0;
    sections.forEach((sec) => {
        if (overrides[sec] != null) {
            total += overrides[sec];
            return;
        }
        const budget = input.budgetBySection[sec] ?? 0;
        const actual = input.actualBySection[sec] ?? 0;
        const committed = input.committedBySection[sec] ?? 0;
        const remaining = Math.max(0, budget - actual - committed);
        total += actual + committed + remaining;
    });
    return total;
}

/**
 * Forecast margin as an amount and % of contract value.
 * Negative values mean the project is forecast to lose money.
 */
export function computeForecastMargin(
    contractValue: number,
    forecastFinal: number
): { margin: number; marginPct: number } {
    const margin = contractValue - forecastFinal;
    const marginPct = contractValue > 0 ? (margin / contractValue) * 100 : 0;
    return { margin, marginPct };
}

// ── CIS deduction (UK Construction Industry Scheme) ─────────────────────────

export type CisStatus = "gross" | "standard" | "higher" | "unverified";

/**
 * CIS deduction = labour × rate. Materials are always exempt.
 *   gross       0%
 *   standard    20%
 *   higher      30%
 *   unverified  30%  (treated as higher rate until verification complete)
 */
export function computeCisDeduction(
    grossPaid: number,
    materials: number,
    status: CisStatus
): { labour: number; deduction: number; netPaid: number } {
    const labour = Math.max(0, grossPaid - materials);
    const rate =
        status === "gross" ? 0 : status === "standard" ? 0.2 : 0.3;
    const deduction = roundMoney(labour * rate);
    const netPaid = roundMoney(grossPaid - deduction);
    return { labour, deduction, netPaid };
}

// ── Percentage helpers ──────────────────────────────────────────────────────

/** Percentage progress (0..100) between two numbers. Clamps to 0/100. */
export function pctProgress(current: number, target: number): number {
    if (target <= 0) return 0;
    return Math.max(0, Math.min(100, (current / target) * 100));
}
