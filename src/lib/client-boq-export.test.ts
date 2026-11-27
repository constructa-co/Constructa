import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { computeContractSumValue, roundMoney } from "@/lib/financial";
import { vatFor } from "@/lib/proposal-review";
import {
    CLIENT_BOQ_EXPORT_FILENAME,
    CLIENT_BOQ_EXPORT_TITLE,
    CLIENT_BOQ_RATE_PRECISION_NOTE,
    CLIENT_BOQ_ROUNDING_RECONCILIATION_LABEL,
    ClientBoQExportError,
    buildClientBoQWorkbook,
    createClientBoQWorkbook,
    buildClientSafeBoQLines,
    clientBoQDisplayRate,
    clientBoQSummaryRows,
    inspectClientBoQWorkbookForLeaks,
    inspectSerializedClientBoQFile,
    serializeClientBoQWorkbook,
} from "./client-boq-export";
import { boqSummaryRows } from "@/app/dashboard/projects/costs/boq-excel-export";
import type { Estimate, EstimateLine } from "@/app/dashboard/projects/costs/types";

const CONFIDENTIALITY_TEST_SENTINELS = [
    "SENTINEL_INTERNAL_VERSION",
    "SENTINEL_INTERNAL_SUPPLIER_NOTE",
    "SENTINEL_INTERNAL_MARGIN_PCT",
] as const;

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

function estimate(lines: EstimateLine[], over: Partial<Estimate> = {}): Estimate {
    return {
        id: "e",
        project_id: "p",
        version_name: "SENTINEL_INTERNAL_VERSION — margin working",
        client_boq_filename: "SENTINEL_SOURCE_TENDER.xlsx",
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
        ...over,
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

    it("omits internal version, filename and component notes from the workbook and serialized file", () => {
        const e = estimate([
            line({
                notes: "SENTINEL_INTERNAL_SUPPLIER_NOTE: SYNTH-Merchant-99",
                description: "SYNTH visible description only",
                estimate_line_components: [
                    {
                        id: "c1",
                        estimate_line_id: "l",
                        component_type: "labour",
                        description: "SENTINEL_INTERNAL_MARGIN_PCT 42%",
                        quantity: 1,
                        unit: "hr",
                        unit_rate: 50,
                        line_total: 50,
                        manhours_per_unit: 1,
                        total_manhours: 1,
                        sort_order: 0,
                    },
                ],
            }),
        ]);
        const wb = buildClientBoQWorkbook(e);
        const buf = serializeClientBoQWorkbook(wb);
        expect(inspectSerializedClientBoQFile(buf)).toEqual([]);
        const roundTrip = XLSX.read(buf, { type: "array" });
        const sheet = roundTrip.Sheets["Client BoQ"];
        const text = Object.keys(sheet)
            .filter((k) => !k.startsWith("!"))
            .map((k) => String(sheet[k]?.v ?? ""))
            .join("\n");
        for (const sentinel of CONFIDENTIALITY_TEST_SENTINELS) {
            expect(text).not.toContain(sentinel);
        }
        expect(text).toContain(CLIENT_BOQ_RATE_PRECISION_NOTE);
        expect(text).toContain(CLIENT_BOQ_EXPORT_TITLE);
        expect(text).not.toContain(e.version_name!);
        expect(text).not.toContain("SENTINEL_SOURCE_TENDER");
        expect(roundTrip.SheetNames).toEqual(["Client BoQ"]);
        expect(inspectClientBoQWorkbookForLeaks(wb)).toEqual([]);
    });

    it("allows client descriptions that mention overhead words but still flags internal summary labels", () => {
        const e = estimate([
            line({ description: "Overhead (high level) cabling allowance", line_total: 500 }),
        ]);
        expect(() => buildClientBoQWorkbook(e)).not.toThrow();
        expect(inspectClientBoQWorkbookForLeaks(buildClientBoQWorkbook(e))).toEqual([]);

        const tainted = createClientBoQWorkbook([
            ["Ref", "Description", "Qty", "Unit", "Rate (£)", "Total (£)"],
            ["", "", "", "", "Overhead (10%)", "500.00"],
        ]);
        const leaks = inspectClientBoQWorkbookForLeaks(tainted);
        expect(leaks.some((l) => l.includes("internal summary label"))).toBe(true);
    });

    it("rejects serialized files that contain custom workbook metadata (Custprops)", () => {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["SYNTH tainted"]]), "Client BoQ");
        wb.Custprops = { SYNTH_PRIVATE_META: "SENTINEL_INTERNAL_SUPPLIER_NOTE" };
        const bytes = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
        const leaks = inspectSerializedClientBoQFile(bytes);
        expect(leaks.some((l) => l.includes("Custprops"))).toBe(true);
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

    it("clientBoQDisplayRate shows precise all-in rate when qty × rate ties to the penny", () => {
        const fractional = clientBoQDisplayRate(3, 1);
        expect(fractional.unit_rate).not.toBeNull();
        expect(roundMoney(3 * fractional.unit_rate!)).toBe(1);
        expect(fractional.total_authoritative).toBe(false);
        const tidy = clientBoQDisplayRate(3, 1.5);
        expect(tidy.unit_rate).toBe(0.5);
        expect(roundMoney(3 * tidy.unit_rate!)).toBe(1.5);
        const lump = clientBoQDisplayRate(0, 250);
        expect(lump.unit_rate).toBeNull();
        expect(lump.total_authoritative).toBe(true);
    });

    it("exports non-blank all-in rate for qty 3 / £1 face-value line", () => {
        const e = estimate(
            [line({ quantity: 3, line_total: 1, line_type: "pc_sum", description: "SYNTH fractional allowance" })],
            { overhead_pct: 0, profit_pct: 0, risk_pct: 0, prelims_pct: 0 },
        );
        const { exportLines } = buildClientSafeBoQLines(e, e.estimate_lines);
        expect(exportLines).toHaveLength(1);
        expect(exportLines[0].line_total).toBe(1);
        expect(exportLines[0].unit_rate).not.toBeNull();
        expect(roundMoney(3 * exportLines[0].unit_rate!)).toBe(1);
    });

    it("adds an explicit rounding reconciliation line instead of silently adjusting a priced line", () => {
        const e = estimate(
            [
                line({ description: "SYNTH strip out", line_total: 1010.1 }),
                line({ description: "SYNTH fit kitchen", line_total: 1010.1 }),
                line({ line_total: 7500, line_type: "pc_sum", description: "SYNTH PC kitchen" }),
            ],
            { overhead_pct: 10, profit_pct: 15, risk_pct: 0, prelims_pct: 0 },
        );
        const { exportLines } = buildClientSafeBoQLines(e, e.estimate_lines);
        const strip = exportLines.find((l) => l.description.includes("strip out"))!;
        const kitchen = exportLines.find((l) => l.description.includes("fit kitchen"))!;
        const expectedMarked = roundMoney(1010.1 * 1.265);
        expect(strip.line_total).toBe(expectedMarked);
        expect(kitchen.line_total).toBe(expectedMarked);
        expect(exportLines.find((l) => l.line_total === 7500)?.description).toContain("PC");
        const rounding = exportLines.find((l) => l.is_rounding_reconciliation);
        expect(rounding?.description).toBe(CLIENT_BOQ_ROUNDING_RECONCILIATION_LABEL);
        expect(rounding?.line_total).not.toBe(0);
        const sum = exportLines.reduce((s, l) => s + l.line_total, 0);
        expect(sum).toBe(computeContractSumValue(e, e.estimate_lines));
    });

    it("rejects unexplained tie-out gaps beyond rounding tolerance", () => {
        const e = estimate([], { total_cost: 5000, prelims_pct: 10, overhead_pct: 0, profit_pct: 0, risk_pct: 0 });
        expect(() => buildClientSafeBoQLines(e, [])).toThrow(ClientBoQExportError);
    });

    it("uses fixed client filename constant", () => {
        expect(CLIENT_BOQ_EXPORT_FILENAME).toBe("ClientCopy_BoQ.xlsx");
    });

    it("reverse-charge jobs match vatFor and omit VAT money rows", () => {
        const e = estimate([line({ line_total: 1000 })]);
        const rows = clientBoQSummaryRows(e, { is_vat_reverse_charge: true });
        expect(rows.some(([l]) => l.includes("domestic reverse charge"))).toBe(true);
        expect(rows.some(([l]) => l.startsWith("VAT ("))).toBe(false);
    });
});