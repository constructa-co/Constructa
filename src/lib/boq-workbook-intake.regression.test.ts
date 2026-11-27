import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import {
    BOQ_IMPORT_MAX_LINES,
    BOQ_LINE_TEXT_LIMITS,
    BOQ_SHEETJS_READ_OPTIONS,
    boqWorkbookImportBlockers,
    extractBoQWorkbook,
    workbookInputFromSheetJS,
    type BoQCellInput,
    type BoQSheetInput,
    type BoQWorkbookExtraction,
} from "./boq-workbook";
import {
    BOQ_WORKBOOK_CLIENT_ROW_CAP,
    BOQ_WORKBOOK_SERVER_AI_ROW_CAP,
    BOQ_WORKBOOK_SCENARIO_IDS,
    type BoqWorkbookScenarioId,
    encodeBoqWorkbookScenarioToXlsx,
    getBoqWorkbookScenario,
    dataRow,
    headerRow,
    type BoqWorkbookSheet,
    synthRef,
} from "./__fixtures__/boq-workbook";

/** One ledger row per source row (contract from boq-workbook.contract.test). */
function dispositionKeys(extraction: BoQWorkbookExtraction): string[] {
    return extraction.rows.map((r) => `${r.sheet}!${r.row}`);
}

function duplicateLineProvenanceKeys(extraction: BoQWorkbookExtraction): string[] {
    const keys = extraction.lines.map((l) => `${l.source_sheet}:${l.source_row}`);
    return keys.filter((k, i) => keys.indexOf(k) !== i);
}

function gridsToSheetInputs(sheets: BoqWorkbookSheet[]): BoQSheetInput[] {
    return sheets.map((sheet) => ({
        name: sheet.name,
        rows: sheet.rows.map((row) => row.map((cell) => cell)),
        merges: sheet.merges,
    }));
}

function extractGrid(id: BoqWorkbookScenarioId): BoQWorkbookExtraction {
    const fixture = getBoqWorkbookScenario(id);
    return extractBoQWorkbook({
        filename: `SYNTH-${id}.xlsx`,
        sheets: gridsToSheetInputs(fixture.sheets),
    });
}

function extractSheetJS(id: BoqWorkbookScenarioId): BoQWorkbookExtraction {
    const buffer = encodeBoqWorkbookScenarioToXlsx(id);
    const workbook = XLSX.read(buffer, { type: "array", ...BOQ_SHEETJS_READ_OPTIONS });
    const input = workbookInputFromSheetJS(`SYNTH-${id}.xlsx`, workbook);
    return extractBoQWorkbook(input);
}

const SYNTH_NRM_HEADER = ["Ref", "Description", "Qty", "Unit", "Rate", "Total"];

describe("boq-workbook intake — SYNTH fixture regression", () => {
    it.each(BOQ_WORKBOOK_SCENARIO_IDS.filter((id) => id !== "csv-single-tab-baseline"))(
        "scenario %s: all tabs, balanced ledger, grid and SheetJS agree on line count",
        (id) => {
            const fromGrid = extractGrid(id);
            const fromXlsx = extractSheetJS(id);
            const fixture = getBoqWorkbookScenario(id);

            expect(fromGrid.reconciliation.sheetCount).toBe(fixture.sheets.length);
            expect(fromXlsx.reconciliation.sheetCount).toBe(fixture.sheets.length);
            expect(fromGrid.reconciliation.balanced).toBe(true);
            expect(fromXlsx.reconciliation.balanced).toBe(true);

            const keys = dispositionKeys(fromGrid);
            expect(new Set(keys).size, "API defect: duplicate sheet!row dispositions").toBe(keys.length);
            expect(fromGrid.reconciliation.totals.sourceRows).toBe(keys.length);

            const t = fromGrid.reconciliation.totals;
            expect(t.itemRows + t.continuationRows + t.headingRows + t.excludedRows + t.unresolvedRows + t.blankRows).toBe(
                t.sourceRows,
            );

            expect(fromGrid.lines.length).toBe(fromXlsx.lines.length);
            expect(fromGrid.lines.length).toBeGreaterThan(0);
        },
    );

    it("multi-tab-over-200: items beyond legacy 150/200 caps are imported", () => {
        const extraction = extractSheetJS("multi-tab-over-200");
        expect(extraction.lines.length).toBeGreaterThan(BOQ_WORKBOOK_CLIENT_ROW_CAP);
        expect(extraction.reconciliation.totals.itemRows).toBe(extraction.lines.length);

        const marker150 = extraction.lines.find((l) => l.description.includes("MARKER-150"));
        const marker200 = extraction.lines.find((l) => l.description.includes("MARKER-200"));
        expect(marker150, "API defect: MARKER-150 missing").toBeDefined();
        expect(marker200, "API defect: MARKER-200 missing").toBeDefined();
        expect(marker150!.source_row).toBeGreaterThanOrEqual(BOQ_WORKBOOK_SERVER_AI_ROW_CAP);
        expect(marker200!.source_row).toBeGreaterThan(BOQ_WORKBOOK_CLIENT_ROW_CAP);
        expect(extraction.lines.length).toBeLessThanOrEqual(BOQ_IMPORT_MAX_LINES);
        expect(boqWorkbookImportBlockers(extraction)).toEqual([]);
    });

    it("empty-middle-tab: empty worksheet is in reconciliation without breaking balance", () => {
        const extraction = extractGrid("empty-middle-tab");
        const empty = extraction.reconciliation.sheets.find((s) => s.sheet.includes("Empty"));
        expect(empty, "API defect: empty tab missing from reconciliation").toBeDefined();
        expect(empty!.status).toBe("empty");
        expect(empty!.sourceRows).toBe(0);
        expect(extraction.reconciliation.balanced).toBe(true);
        expect(extraction.lines.length).toBeGreaterThan(0);
    });

    it("merged-repeated-headers: repeated header bands are excluded, items still import", () => {
        const extraction = extractGrid("merged-repeated-headers");
        expect(extraction.reconciliation.balanced).toBe(true);
        expect(extraction.reconciliation.totals.excludedRows).toBeGreaterThan(0);
        expect(extraction.rows.some((r) => r.reason === "repeated_header" || r.reason === "above_header")).toBe(true);
        expect(extraction.lines.length).toBeGreaterThanOrEqual(2);
    });

    it("reconciliation-mismatch: line total mismatch is reconciled, not an import blocker", () => {
        const extraction = extractGrid("reconciliation-mismatch");
        expect(extraction.reconciliation.totals.mismatchRows).toBeGreaterThanOrEqual(1);
        const line = extraction.lines[0];
        expect(line.total_mismatch).toMatchObject({ stated: 999, computed: 120 });
        expect(line.line_total).toBe(120);
        expect(boqWorkbookImportBlockers(extraction)).toEqual([]);
        expect(duplicateLineProvenanceKeys(extraction)).toHaveLength(0);
    });

    it("identical description on different source rows stays two lines (no text dedupe)", () => {
        const shared = "SYNTH-BQ repeated line description";
        const sheet: BoqWorkbookSheet = {
            name: "SYNTH-Identical-Text",
            rows: [
                headerRow(),
                dataRow({
                    ref: synthRef(10, 1),
                    section: "SYNTH",
                    description: shared,
                    quantity: "1",
                    unit: "nr",
                    rate: "10",
                    total: "10",
                }),
                dataRow({
                    ref: synthRef(10, 2),
                    section: "SYNTH",
                    description: shared,
                    quantity: "3",
                    unit: "nr",
                    rate: "10",
                    total: "30",
                }),
            ],
        };
        const extraction = extractBoQWorkbook({
            filename: "SYNTH-identical-text.xlsx",
            sheets: gridsToSheetInputs([sheet]),
        });
        const matches = extraction.lines.filter((l) => l.description === shared);
        expect(matches).toHaveLength(2);
        expect(matches[0].source_row).not.toBe(matches[1].source_row);
        expect(duplicateLineProvenanceKeys(extraction)).toHaveLength(0);
        expect(extraction.reconciliation.balanced).toBe(true);
    });

    it("NRM continuation: item disposition on value row, lineIndex spans description rows", () => {
        const rows: BoQCellInput[][] = [
            SYNTH_NRM_HEADER,
            ["A", "Kiosk; disposal off-site", 2, "nr", 150, 300],
            ["B", "Barriers with posts at", null, null, null, null],
            ["", "1200 centres; remove from site", 40, "m", 5, 200],
        ];
        const extraction = extractBoQWorkbook({
            filename: "SYNTH-nrm.xlsx",
            sheets: [{ name: "SYNTH-NRM", rows }],
        });
        expect(extraction.lines).toHaveLength(2);
        const b = extraction.lines[1];
        expect(b.client_ref).toBe("B");
        expect(b.description).toContain("1200 centres");
        expect(b.source_row).toBeLessThan(b.source_row_end);
        const valueRow = extraction.rows.find((r) => r.sheet === "SYNTH-NRM" && r.kind === "item" && r.lineIndex === 1);
        const contRow = extraction.rows.find((r) => r.sheet === "SYNTH-NRM" && r.kind === "continuation" && r.lineIndex === 1);
        expect(valueRow, "API defect: item disposition missing on value row").toBeDefined();
        expect(contRow, "API defect: continuation disposition missing").toBeDefined();
        expect(contRow!.row).toBeLessThan(valueRow!.row);
        if (contRow!.lineIndex != null) {
            expect(extraction.lines[contRow!.lineIndex].source_row).toBe(b.source_row);
            expect(extraction.lines[contRow!.lineIndex].source_row_end).toBe(b.source_row_end);
        }
    });

    it("over-limit text is retained and blocks import via blockers", () => {
        const long = "x".repeat(BOQ_LINE_TEXT_LIMITS.description + 50);
        const extraction = extractBoQWorkbook({
            filename: "SYNTH-over-limit.xlsx",
            sheets: [{
                name: "SYNTH-Long",
                rows: [
                    SYNTH_NRM_HEADER,
                    ["A", long, 1, "nr", 1, 1],
                ],
            }],
        });
        expect(extraction.lines[0].description).toBe(long);
        expect(extraction.lines[0].over_limit?.[0]?.field).toBe("description");
        expect(extraction.reconciliation.totals.overLimitRows).toBe(1);
        expect(boqWorkbookImportBlockers(extraction).join(" ")).toMatch(/longer than the import accepts/);
    });

    it("cached formula without value and Excel errors increment counters and can block", () => {
        const extraction = extractBoQWorkbook({
            filename: "SYNTH-formula.xlsx",
            sheets: [{
                name: "SYNTH-Formula",
                rows: [
                    SYNTH_NRM_HEADER,
                    ["A", "SYNTH unreadable rate", 1, "nr", { v: null, formula: true }, 10],
                    ["B", "SYNTH error cell", 1, "item", { v: null, w: "#REF!", formula: true, error: true }, 5],
                ],
            }],
        });
        expect(extraction.reconciliation.totals.uncachedFormulaCells).toBeGreaterThanOrEqual(1);
        expect(extraction.reconciliation.totals.errorCells).toBeGreaterThanOrEqual(1);
        const blockers = boqWorkbookImportBlockers(extraction);
        expect(blockers.some((b) => b.includes("unreadable"))).toBe(true);
    });

    it("unbalanced ledger would block import (protection via blockers)", () => {
        const extraction = extractGrid("multi-tab-over-200");
        expect(extraction.reconciliation.balanced).toBe(true);
        const faulted: BoQWorkbookExtraction = {
            ...extraction,
            reconciliation: { ...extraction.reconciliation, balanced: false },
        };
        expect(boqWorkbookImportBlockers(faulted)).toContain("Row reconciliation does not balance.");
    });

    it("includeSheets limits contributing tabs", () => {
        const fixture = getBoqWorkbookScenario("multi-tab-over-200");
        const input = {
            filename: "SYNTH-partial.xlsx",
            sheets: gridsToSheetInputs(fixture.sheets),
        };
        const onlyTab3 = extractBoQWorkbook(input, { includeSheets: ["SYNTH-Tab-3"] });
        expect(onlyTab3.lines.every((l) => l.source_sheet === "SYNTH-Tab-3")).toBe(true);
        expect(onlyTab3.reconciliation.contributingSheets).toBe(1);
        expect(onlyTab3.reconciliation.balanced).toBe(true);
    });

    it("no duplicate line provenance keys across SYNTH multi-tab workbook", () => {
        const extraction = extractSheetJS("multi-tab-over-200");
        expect(duplicateLineProvenanceKeys(extraction), "API defect: same source_row on two lines").toHaveLength(0);
    });
});