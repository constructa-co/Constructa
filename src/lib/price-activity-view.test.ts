import { describe, expect, it } from "vitest";
import { priceActivityRows } from "./price-activity-view";
import { computeContractSum } from "./financial";

describe("view-only activity decorations", () => {
    it("keeps original references/order, marks repeated blocks and emits each subtotal only once after its last line", () => {
        const lines = Object.freeze([
            Object.freeze({ id: "one", trade_section: "Kitchen", line_total: "100.10" }),
            Object.freeze({ id: "two", trade_section: "Roof", line_total: 20 }),
            Object.freeze({ id: "three", trade_section: "Kitchen", line_total: "0.20" }),
        ]);
        const rows = priceActivityRows(lines);
        expect(rows.map(row => row.line)).toEqual(lines);
        rows.forEach((row, index) => expect(row.line).toBe(lines[index]));
        expect(rows.map(row => row.heading)).toEqual([{ section: "Kitchen", continued: false }, { section: "Roof", continued: false }, { section: "Kitchen", continued: true }]);
        expect(rows.map(row => row.subtotal)).toEqual([null,
            { section: "Roof", lineCount: 1, blocks: 1, amount: 20 },
            { section: "Kitchen", lineCount: 2, blocks: 2, amount: 100.3 },
        ]);
    });
    it("handles contiguous lines, legacy empty activities and prototype names without inventing headings or sorting", () => {
        const names = ["__proto__", "__proto__", "constructor", "toString", null, "", "General", " Kitchen "];
        const rows = priceActivityRows(names.map((trade_section, index) => ({ id: index, trade_section, line_total: 1 })));
        expect(rows.map(row => row.line.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
        expect(rows.filter(row => row.heading).map(row => row.heading!.section)).toEqual(["__proto__", "constructor", "toString", "General", " Kitchen "]);
        expect(rows.filter(row => row.subtotal).map(row => row.subtotal!.amount)).toEqual([2, 1, 1, 3, 1]);
    });
    it.each([null, undefined, "", "   ", "not a number", Infinity, NaN])("does not claim a zero subtotal for missing/invalid stored total %s", line_total => {
        const rows = priceActivityRows([{ trade_section: "Work", line_total: 10 }, { trade_section: "Work", line_total }]);
        expect(rows[1].subtotal).toMatchObject({ amount: null, lineCount: 2 });
    });
    it("preserves actual zero and negative stored totals, rounding only with existing money helper", () => {
        const rows = priceActivityRows([{ trade_section: "Work", line_total: 0 }, { trade_section: "Work", line_total: -10.15 }, { trade_section: "Work", line_total: "0.05" }]);
        expect(rows[2].subtotal!.amount).toBe(-10.1);
        expect(priceActivityRows([{ line_total: 0 }])[0].subtotal!.amount).toBe(0);
    });
    it("does not recalculate prices from quantities/rates or alter Preliminaries/adjustments/contract sum", () => {
        const lines = [{ trade_section: "Preliminaries", quantity: 100, unit_rate: 999, line_total: 30 }, { trade_section: "Kitchen", quantity: 1, unit_rate: 999, line_total: 200 }];
        const estimate = { prelims_pct: 20, overhead_pct: 10, risk_pct: 5, profit_pct: 12, discount_pct: 3 };
        const before = JSON.stringify(lines), money = computeContractSum(estimate, lines), rows = priceActivityRows(lines);
        expect(rows.map(row => row.subtotal!.amount)).toEqual([30, 200]);
        expect(JSON.stringify(lines)).toBe(before); expect(computeContractSum(estimate, lines)).toEqual(money);
        expect(rows.reduce((sum, row) => sum + (row.subtotal?.amount ?? 0), 0)).not.toBe(money.contractSum);
    });
    it("returns no rows for an empty estimate and refuses nonfinite aggregate display", () => {
        expect(priceActivityRows([])).toEqual([]);
        expect(priceActivityRows([{ line_total: Number.MAX_VALUE }, { line_total: Number.MAX_VALUE }])[1].subtotal!.amount).toBeNull();
    });
});
