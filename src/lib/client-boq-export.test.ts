import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { computeContractSumValue } from "@/lib/financial";
import { vatFor } from "@/lib/proposal-review";
import {
    buildClientBoQWorkbook,
    buildClientSafeBoQLines,
    clientBoQSummaryRows,
    inspectClientBoQWorkbookForLeaks,
} from "./client-boq-export";
import { boqSummaryRows } from "@/app/dashboard/projects/costs/boq-excel-export";
import type { Estimate, EstimateLine } from "@/app/dashboard/projects/costs/types";

function line(over: Partial<EstimateLine>): EstimateLine {
    return {
        id: "l",
        estimate_id: "e",
        description: "SYNTH allowance item",
        quantity: 1,
        unit: "nr",
        unit_rate: 100,
        line_total: 1000,
        trade_section: "General",
        line_type: "standard",
        pricing_mode: "simple",
        estimate_line_components: [],
        ...over,
    };
}

function estimate(lines: EstimateLine[]): Estimate {
    return {
        id: "e",
        project_id: "p",
        version_name: "SYNTH v1",
        overhead_pct: 10,
        profit_pct: 15,
        risk_pct: 5,
        prelims_pct: 10,
        discount_pct: 0,
        discount_reason: "",
        total_cost: 0,
        is_active: true,
        is_client_boq: true,
        estimate_lines: lines,
    };
}

const summaryValue = (rows: [string, string][], label: string) => rows.find(([l]) => l === label)?.[1];

describe("client-safe BoQ export", () => {
    it("ties Σ all-in line totals to the approved contract sum to the penny", () => {
        const e = estimate([
            line({ line_total: 1000 }),
            line({ line_total: 500, line_type: "pc_sum", description: "SYNTH PC sum" }),
        ]);
        const { exportLines, contractSum } = buildClientSafeBoQLines(e, e.estimate_lines);
        const sum = exportLines.reduce((s, l) => s + l.line_total, 0);
        expect(contractSum).toBe(computeContractSumValue(e, e.estimate_lines));
        expect(Math.round(sum * 100) / 100).toBe(contractSum);
    });

    it("does not surface internal notes or margin summary labels in the workbook", () => {
        const e = estimate([
            line({
                notes: "INTERNAL_SUPPLIER: SYNTH-Merchant-99",
                description: "SYNTH visible description only",
            }),
        ]);
        const wb = buildClientBoQWorkbook(e);
        const leaks = inspectClientBoQWorkbookForLeaks(wb);
        expect(leaks).toEqual([]);
        const sheet = wb.Sheets["Client BoQ"];
        const text = Object.keys(sheet)
            .filter((k) => !k.startsWith("!"))
            .map((k) => String(sheet[k]?.v ?? ""))
            .join(" ");
        expect(text).not.toMatch(/INTERNAL_SUPPLIER|Overhead \(|Profit \(|Risk \(/);
        expect(text).toContain("SYNTH visible description only");
        expect(wb.SheetNames).toEqual(["Client BoQ"]);
    });

    it("client summary shows contract sum and VAT only; internal export still shows margins", () => {
        const e = estimate([line({ line_total: 1000 })]);
        const clientRows = clientBoQSummaryRows(e);
        const internalRows = boqSummaryRows(e);
        expect(summaryValue(clientRows, "CONTRACT SUM (exc. VAT)")).toBe(
            summaryValue(internalRows, "CONTRACT SUM (exc. VAT)"),
        );
        expect(clientRows.some(([l]) => /^Overhead \(/i.test(l))).toBe(false);
        expect(internalRows.some(([l]) => /^Overhead \(/i.test(l))).toBe(true);
        const { vatRate } = vatFor({});
        if (vatRate > 0) {
            expect(summaryValue(clientRows, `VAT (${vatRate}%)`)).toBe(summaryValue(internalRows, `VAT (${vatRate}%)`));
        }
    });

    it("produces a single visible sheet with no comments in the serialized file", () => {
        const wb = buildClientBoQWorkbook(estimate([line({ line_total: 2000 })]));
        const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
        const roundTrip = XLSX.read(buf, { type: "array" });
        expect(roundTrip.SheetNames).toEqual(["Client BoQ"]);
        expect(inspectClientBoQWorkbookForLeaks(roundTrip)).toEqual([]);
    });

    it("reverse-charge jobs match vatFor and omit VAT money rows", () => {
        const e = estimate([line({ line_total: 1000 })]);
        const rows = clientBoQSummaryRows(e, { is_vat_reverse_charge: true });
        expect(rows.some(([l]) => l.includes("domestic reverse charge"))).toBe(true);
        expect(rows.some(([l]) => l.startsWith("VAT ("))).toBe(false);
    });
});