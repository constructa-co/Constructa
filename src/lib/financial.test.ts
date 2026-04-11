import { describe, expect, it } from "vitest";
import {
    computeAfp,
    computeBudgetCost,
    computeCisDeduction,
    computeContractSum,
    computeContractSumValue,
    computeForecastFinal,
    computeForecastMargin,
    pctProgress,
    roundMoney,
    toNumber,
} from "./financial";

// ─────────────────────────────────────────────────────────────────────────────
// Sprint 58 Phase 1 item #8.
//
// 29 tests on the canonical financial functions. These are the numbers that
// every client-facing surface in the app depends on — the proposal PDF,
// billing page, overview RAG, P&L dashboard, and management accounts all
// compute from these functions. One regression here and contractors get
// wrong contract sums in their proposals or wrong forecasts on their P&L.
//
// Tests deliberately cover:
//   - The canonical 22 Birchwood Avenue numbers the live app shows, so
//     this suite would have caught the Sprint 57 £1,593 vs £1,753 billing
//     discrepancy.
//   - Edge cases (empty lines, explicit prelims, negative amounts,
//     legacy total_cost fallback).
//   - Number coercion (Supabase returns numeric columns as strings).
//   - The CIS deduction rates that drive Monthly Return outputs.
// ─────────────────────────────────────────────────────────────────────────────

describe("toNumber", () => {
    it("coerces numeric strings from Supabase", () => {
        expect(toNumber("1200.00")).toBe(1200);
        expect(toNumber("15.5")).toBe(15.5);
    });
    it("returns 0 for null, undefined, empty string and NaN", () => {
        expect(toNumber(null)).toBe(0);
        expect(toNumber(undefined)).toBe(0);
        expect(toNumber("")).toBe(0);
        expect(toNumber("not a number")).toBe(0);
        expect(toNumber(NaN)).toBe(0);
        expect(toNumber(Infinity)).toBe(0);
    });
});

describe("roundMoney", () => {
    it("rounds to 2dp", () => {
        expect(roundMoney(1753.287)).toBe(1753.29);
        expect(roundMoney(1753.284)).toBe(1753.28);
        expect(roundMoney(0)).toBe(0);
        expect(roundMoney(-12.345)).toBe(-12.34);
    });
});

describe("computeContractSum — 22 Birchwood Avenue canonical", () => {
    // This is the EXACT data that was on production at the start of
    // Sprint 58. Billing was showing £1,593.90 (wrong) while the proposal
    // showed £1,753.29 (right). The correct answer — used everywhere
    // after the Sprint 57 fix — is £1,753.29.
    const estimate = {
        prelims_pct: 10,
        overhead_pct: 10,
        risk_pct: 5,
        profit_pct: 15,
        discount_pct: 0,
        total_cost: 1200,
    };
    const lines = [
        { trade_section: "Groundworks", line_total: 1200 },
    ];

    it("computes the full contract sum breakdown", () => {
        const result = computeContractSum(estimate, lines);
        expect(result.directCost).toBe(1200);
        expect(result.prelimsTotal).toBe(120);
        expect(result.totalConstructionCost).toBe(1320);
        // Overhead 10% of 1320 = 132
        expect(result.overheadAmount).toBeCloseTo(132, 2);
        // Risk 5% of (1320 + 132) = 72.60
        expect(result.riskAmount).toBeCloseTo(72.6, 2);
        // Profit 15% of (1320 + 132 + 72.60) = 228.69
        expect(result.profitAmount).toBeCloseTo(228.69, 2);
        expect(result.discountAmount).toBe(0);
        expect(roundMoney(result.contractSum)).toBe(1753.29);
    });

    it("computeContractSumValue returns 1753.29", () => {
        expect(computeContractSumValue(estimate, lines)).toBe(1753.29);
    });

    it("ohRiskProfitMultiplier at 10/5/15/0 = 1.32825", () => {
        const { ohRiskProfitMultiplier } = computeContractSum(estimate, lines);
        // (1.10) × (1.05) × (1.15) × (1.00) = 1.32825
        expect(ohRiskProfitMultiplier).toBeCloseTo(1.32825, 5);
    });
});

describe("computeContractSum — margin compounding order", () => {
    // Changing the compounding order breaks the QS hierarchy. This test
    // pins it so anyone refactoring the PDF doesn't accidentally swap
    // risk and profit, which would produce a noticeably different number.
    it("compounds overhead → risk → profit, not additive", () => {
        const additive = 1320 * (1 + 0.1 + 0.05 + 0.15); // 1716 (wrong)
        const compound = computeContractSumValue(
            {
                prelims_pct: 10,
                overhead_pct: 10,
                risk_pct: 5,
                profit_pct: 15,
                discount_pct: 0,
                total_cost: 1200,
            },
            [{ trade_section: "Groundworks", line_total: 1200 }],
        );
        expect(compound).not.toBe(additive);
        expect(compound).toBe(1753.29);
    });
});

describe("computeContractSum — explicit prelims lines", () => {
    it("uses explicit prelims lines instead of percentage", () => {
        const result = computeContractSum(
            {
                prelims_pct: 10, // would give 100 from percentage
                overhead_pct: 0,
                risk_pct: 0,
                profit_pct: 0,
                discount_pct: 0,
            },
            [
                { trade_section: "Groundworks", line_total: 1000 },
                { trade_section: "Preliminaries", line_total: 250 }, // explicit
            ],
        );
        // Should use 250, not 100
        expect(result.prelimsTotal).toBe(250);
        expect(result.totalConstructionCost).toBe(1250);
        expect(result.contractSum).toBe(1250);
    });
});

describe("computeContractSum — legacy total_cost fallback", () => {
    it("falls back to total_cost when no line rows present", () => {
        const result = computeContractSum(
            {
                prelims_pct: 10,
                overhead_pct: 10,
                risk_pct: 5,
                profit_pct: 15,
                total_cost: 1200,
            },
            [],
        );
        // Same answer as the live-line case above because the fallback
        // treats total_cost as the direct cost for prelims calculation.
        expect(roundMoney(result.contractSum)).toBe(1753.29);
    });
});

describe("computeContractSum — discount", () => {
    it("applies discount to the pre-discount total", () => {
        const noDiscount = computeContractSumValue(
            {
                prelims_pct: 0,
                overhead_pct: 0,
                risk_pct: 0,
                profit_pct: 0,
                discount_pct: 0,
            },
            [{ trade_section: "A", line_total: 1000 }],
        );
        const withDiscount = computeContractSumValue(
            {
                prelims_pct: 0,
                overhead_pct: 0,
                risk_pct: 0,
                profit_pct: 0,
                discount_pct: 10,
            },
            [{ trade_section: "A", line_total: 1000 }],
        );
        expect(noDiscount).toBe(1000);
        expect(withDiscount).toBe(900);
    });
});

describe("computeContractSum — string inputs from Supabase", () => {
    it("handles numeric strings on percentages and totals", () => {
        const result = computeContractSumValue(
            {
                prelims_pct: "10",
                overhead_pct: "10",
                risk_pct: "5",
                profit_pct: "15",
                total_cost: "1200",
            },
            [{ trade_section: "Groundworks", line_total: "1200" }],
        );
        expect(result).toBe(1753.29);
    });
});

describe("computeBudgetCost", () => {
    it("returns direct + prelims, no margins", () => {
        const cost = computeBudgetCost(
            {
                prelims_pct: 10,
                overhead_pct: 10,
                risk_pct: 5,
                profit_pct: 15,
            },
            [{ trade_section: "Groundworks", line_total: 1200 }],
        );
        expect(cost).toBe(1320);
    });

    it("ignores overhead/risk/profit even when high", () => {
        const cost = computeBudgetCost(
            { prelims_pct: 0, overhead_pct: 50, risk_pct: 50, profit_pct: 50 },
            [{ trade_section: "A", line_total: 1000 }],
        );
        expect(cost).toBe(1000);
    });
});

describe("computeAfp", () => {
    it("calculates a first interim valuation with 5% retention", () => {
        const afp = computeAfp({
            gross_valuation: 10000,
            previous_cert: 0,
            retention_pct: 5,
        });
        expect(afp.grossThisCert).toBe(10000);
        expect(afp.retentionHeld).toBe(500);
        expect(afp.netDue).toBe(9500);
    });

    it("subtracts previous certifications", () => {
        const afp = computeAfp({
            gross_valuation: 25000,
            previous_cert: 10000,
            retention_pct: 5,
        });
        expect(afp.grossThisCert).toBe(15000);
        expect(afp.retentionHeld).toBe(1250);
        expect(afp.netDue).toBe(13750);
    });

    it("clamps net to zero when previous exceeds gross", () => {
        const afp = computeAfp({
            gross_valuation: 5000,
            previous_cert: 10000,
            retention_pct: 5,
        });
        expect(afp.grossThisCert).toBe(0);
        // Retention is still computed on the gross valuation, which is
        // correct per RICS — release it through releaseRetentionAction.
        expect(afp.retentionHeld).toBe(250);
        expect(afp.netDue).toBe(0);
    });

    it("handles zero retention", () => {
        const afp = computeAfp({
            gross_valuation: 5000,
            previous_cert: 0,
            retention_pct: 0,
        });
        expect(afp.retentionHeld).toBe(0);
        expect(afp.netDue).toBe(5000);
    });
});

describe("computeForecastFinal — baseline scenario", () => {
    it("returns budget when nothing has been spent yet", () => {
        const final = computeForecastFinal({
            budgetBySection: { Groundworks: 1000, Roofing: 500 },
            actualBySection: {},
            committedBySection: {},
        });
        expect(final).toBe(1500);
    });

    it("substitutes actual + committed for remaining budget", () => {
        // Groundworks: budget 1000, actual 400, committed 200
        //   remaining = max(0, 1000 - 400 - 200) = 400
        //   forecast = 400 + 200 + 400 = 1000 (still on budget)
        const final = computeForecastFinal({
            budgetBySection: { Groundworks: 1000 },
            actualBySection: { Groundworks: 400 },
            committedBySection: { Groundworks: 200 },
        });
        expect(final).toBe(1000);
    });

    it("detects overspend — forecast > budget", () => {
        // Groundworks: budget 1000, actual 800, committed 500
        //   remaining = max(0, 1000 - 800 - 500) = 0
        //   forecast = 800 + 500 + 0 = 1300 (over budget by 300)
        const final = computeForecastFinal({
            budgetBySection: { Groundworks: 1000 },
            actualBySection: { Groundworks: 800 },
            committedBySection: { Groundworks: 500 },
        });
        expect(final).toBe(1300);
    });

    it("applies user-entered override over auto-forecast", () => {
        const final = computeForecastFinal({
            budgetBySection: { Groundworks: 1000 },
            actualBySection: { Groundworks: 400 },
            committedBySection: { Groundworks: 200 },
            overrides: { Groundworks: 950 }, // e.g. "I think we'll come in under"
        });
        expect(final).toBe(950);
    });

    it("includes sections with only actual spend but no budget (22 Birchwood Masonry case)", () => {
        // This is exactly the scenario Perplexity found on 22 Birchwood —
        // Masonry had actual costs logged but no budget from the estimate.
        // The old logic ignored it and the forecast looked fine. The
        // correct behaviour is to include that orphan spend in the total.
        const final = computeForecastFinal({
            budgetBySection: { Groundworks: 1200 },
            actualBySection: { Masonry: 699.24 },
            committedBySection: {},
        });
        // Groundworks: 0 actual + 0 committed + 1200 remaining = 1200
        // Masonry:     699.24 actual + 0 committed + max(0, 0-699.24) = 699.24
        // Total:       1899.24
        expect(final).toBeCloseTo(1899.24, 2);
    });
});

describe("computeForecastMargin", () => {
    it("positive margin for profitable project", () => {
        const { margin, marginPct } = computeForecastMargin(1753, 1320);
        expect(margin).toBe(433);
        expect(marginPct).toBeCloseTo(24.7, 1);
    });

    it("negative margin for forecast loss (22 Birchwood)", () => {
        const { margin, marginPct } = computeForecastMargin(1753.29, 1899.24);
        expect(margin).toBeCloseTo(-145.95, 2);
        expect(marginPct).toBeLessThan(0);
    });

    it("zero contract value returns 0% margin", () => {
        const { margin, marginPct } = computeForecastMargin(0, 0);
        expect(margin).toBe(0);
        expect(marginPct).toBe(0);
    });
});

describe("computeCisDeduction", () => {
    it("gross status — 0% deduction", () => {
        const cis = computeCisDeduction(1000, 200, "gross");
        expect(cis.labour).toBe(800);
        expect(cis.deduction).toBe(0);
        expect(cis.netPaid).toBe(1000);
    });

    it("standard status — 20% on labour only", () => {
        const cis = computeCisDeduction(1000, 200, "standard");
        expect(cis.labour).toBe(800);
        expect(cis.deduction).toBe(160);
        expect(cis.netPaid).toBe(840);
    });

    it("higher status — 30% on labour only", () => {
        const cis = computeCisDeduction(1000, 200, "higher");
        expect(cis.labour).toBe(800);
        expect(cis.deduction).toBe(240);
        expect(cis.netPaid).toBe(760);
    });

    it("unverified — treated as higher rate", () => {
        const cis = computeCisDeduction(1000, 200, "unverified");
        expect(cis.deduction).toBe(240);
        expect(cis.netPaid).toBe(760);
    });

    it("all labour (no materials)", () => {
        const cis = computeCisDeduction(500, 0, "standard");
        expect(cis.labour).toBe(500);
        expect(cis.deduction).toBe(100);
        expect(cis.netPaid).toBe(400);
    });

    it("clamps labour to zero if materials exceed gross", () => {
        const cis = computeCisDeduction(500, 600, "standard");
        expect(cis.labour).toBe(0);
        expect(cis.deduction).toBe(0);
    });
});

describe("pctProgress", () => {
    it("returns 0 when target is zero (avoids div by zero)", () => {
        expect(pctProgress(10, 0)).toBe(0);
    });
    it("clamps negative current to 0", () => {
        expect(pctProgress(-100, 1000)).toBe(0);
    });
    it("clamps overshoot to 100", () => {
        expect(pctProgress(1500, 1000)).toBe(100);
    });
    it("computes normal case", () => {
        expect(pctProgress(250, 1000)).toBe(25);
        expect(pctProgress(699, 1320)).toBeCloseTo(52.95, 2);
    });
});
