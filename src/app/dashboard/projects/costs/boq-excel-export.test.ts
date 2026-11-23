import { describe, expect, it } from "vitest";
import { computeContractSumValue } from "@/lib/financial";
import { boqSummaryRows } from "./boq-excel-export";
import type { Estimate, EstimateLine } from "./types";

// The priced Excel export must show the same contract sum and VAT the proposal
// publication states. These cases pin it to the canonical helper for the
// situations the old inline arithmetic got wrong.

function line(over: Partial<EstimateLine>): EstimateLine {
    return {
        id: "l", estimate_id: "e", description: "Item", quantity: 1, unit: "item", unit_rate: 0, line_total: 0,
        trade_section: "General", line_type: "standard", pricing_mode: "simple", estimate_line_components: [],
        ...over,
    };
}

function estimate(lines: EstimateLine[]): Estimate {
    return {
        id: "e", project_id: "p", version_name: "v1", overhead_pct: 10, profit_pct: 10, risk_pct: 0, prelims_pct: 10,
        discount_pct: 0, discount_reason: "", total_cost: 0, is_active: true, estimate_lines: lines,
    };
}

const value = (rows: [string, string][], label: string) => rows.find(([l]) => l === label)?.[1];

describe("priced BoQ Excel summary", () => {
    it("carries PC and provisional sums at face value, outside the mark-up", () => {
        const e = estimate([
            line({ line_total: 1000 }),
            line({ line_total: 500, line_type: "pc_sum" }),
            line({ line_total: 250, line_type: "provisional_sum" }),
        ]);
        const rows = boqSummaryRows(e);
        expect(value(rows, "Direct Construction Cost")).toBe("1,000.00");
        expect(value(rows, "Total Construction Cost")).toBe("1,100.00");
        expect(value(rows, "Prime cost / provisional sums (at face value)")).toBe("750.00");
        expect(value(rows, "CONTRACT SUM (exc. VAT)")).toBe("2,081.00");
        expect(computeContractSumValue(e, e.estimate_lines)).toBe(2081);
    });

    it("applies the percentage prelims when the only Preliminaries line is a blank placeholder", () => {
        const rows = boqSummaryRows(estimate([line({ line_total: 1000 }), line({ trade_section: "Preliminaries", line_total: 0 })]));
        expect(value(rows, "Preliminaries")).toBe("100.00");
        expect(value(rows, "CONTRACT SUM (exc. VAT)")).toBe("1,331.00");
    });

    it("lets a credit line reduce the totals", () => {
        const rows = boqSummaryRows(estimate([line({ line_total: 1000 }), line({ line_total: -200 })]));
        expect(value(rows, "Direct Construction Cost")).toBe("800.00");
        expect(value(rows, "CONTRACT SUM (exc. VAT)")).toBe("1,064.80");
        expect(value(rows, "VAT (20%)")).toBe("212.96");
        expect(value(rows, "TOTAL inc. VAT")).toBe("1,277.76");
    });

    it("charges standard VAT by default and when the job is not reverse charge", () => {
        const e = estimate([line({ line_total: 1000 })]);
        for (const project of [undefined, { is_vat_reverse_charge: false }]) {
            const rows = boqSummaryRows(e, project);
            expect(value(rows, "VAT (20%)")).toBe("266.20");
            expect(value(rows, "TOTAL inc. VAT")).toBe("1,597.20");
        }
    });

    it("states reverse charge and charges no VAT when the job is reverse charge", () => {
        const rows = boqSummaryRows(estimate([line({ line_total: 1000 })]), { is_vat_reverse_charge: true });
        expect(value(rows, "CONTRACT SUM (exc. VAT)")).toBe("1,331.00");
        expect(rows.some(([label]) => label.startsWith("VAT ("))).toBe(false);
        expect(rows.some(([label]) => label === "TOTAL inc. VAT")).toBe(false);
        expect(rows.some(([label]) => label.includes("domestic reverse charge"))).toBe(true);
    });
});
