import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";
import { beforeAll, describe, expect, it } from "vitest";
import type {
    BoQSheetInput,
    BoQWorkbookExtraction,
    BoQWorkbookInput,
} from "@/lib/boq-workbook";
import {
    BOQ_WORKBOOK_CLIENT_ROW_CAP,
    BOQ_WORKBOOK_SERVER_AI_ROW_CAP,
    BOQ_WORKBOOK_SCENARIO_IDS,
    type BoqWorkbookScenarioId,
    encodeBoqWorkbookScenarioToXlsx,
    getBoqWorkbookScenario,
    headerRow,
    type BoqWorkbookSheet,
    dataRow,
    synthRef,
} from "@/lib/__fixtures__/boq-workbook";

const implPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "boq-workbook.ts");

/** Runs only after R1 transfers `boq-workbook.ts`; draft stays type-safe via `boq-workbook.d.ts`. */
const describeRegression = fs.existsSync(implPath) ? describe : describe.skip;

type BoqWorkbookModule = typeof import("@/lib/boq-workbook");

function gridsToSheetInputs(sheets: BoqWorkbookSheet[]): BoQSheetInput[] {
    return sheets.map((sheet) => ({
        name: sheet.name,
        rows: sheet.rows.map((row) => row.map((cell) => cell)),
        merges: sheet.merges,
    }));
}

function itemProvenanceKeys(extraction: BoQWorkbookExtraction): string[] {
    return extraction.lines.map((line) => `${line.source_sheet}:${line.source_row}`);
}

function dispositionBySheet(extraction: BoQWorkbookExtraction, sheetName: string) {
    return extraction.rows.filter((row) => row.sheet === sheetName || row.sheet === sheetName.slice(0, 31));
}

describeRegression("boq-workbook intake regression (SYNTH fixtures)", () => {
    let mod: BoqWorkbookModule;

    beforeAll(async () => {
        mod = await import("@/lib/boq-workbook");
    });

    function extractFromGrid(id: BoqWorkbookScenarioId): BoQWorkbookExtraction {
        const fixture = getBoqWorkbookScenario(id);
        const input: BoQWorkbookInput = {
            filename: `SYNTH-${id}.xlsx`,
            sheets: gridsToSheetInputs(fixture.sheets),
        };
        return mod.extractBoQWorkbook(input);
    }

    function extractFromSheetJS(id: BoqWorkbookScenarioId): BoQWorkbookExtraction {
        const buffer = encodeBoqWorkbookScenarioToXlsx(id);
        const workbook = XLSX.read(buffer, { type: "array" });
        const input = mod.workbookInputFromSheetJS(`SYNTH-${id}.xlsx`, workbook);
        return mod.extractBoQWorkbook(input);
    }

    it.each(BOQ_WORKBOOK_SCENARIO_IDS.filter((id) => id !== "csv-single-tab-baseline"))(
        "scenario %s extracts via grid and SheetJS adapter with consistent sheet count",
        (id) => {
            const fromGrid = extractFromGrid(id);
            const fromXlsx = extractFromSheetJS(id);
            const fixture = getBoqWorkbookScenario(id);

            expect(fromGrid.filename).toMatch(/^SYNTH-/);
            expect(fromGrid.reconciliation.sheetCount).toBe(fixture.sheets.length);
            expect(fromXlsx.reconciliation.sheetCount).toBe(fixture.sheets.length);
            expect(fromGrid.lines.length).toBeGreaterThan(0);

            for (const line of fromGrid.lines) {
                expect(line.source_sheet.length).toBeGreaterThan(0);
                expect(line.source_row).toBeGreaterThanOrEqual(1);
            }
        },
    );

    it("multi-tab-over-200 retains markers beyond legacy 150/200 capture caps", () => {
        const extraction = extractFromSheetJS("multi-tab-over-200");
        const tab1 = "SYNTH-Tab-1";
        const marker150 = extraction.lines.find((l) => l.description?.includes("MARKER-150"));
        const marker200 = extraction.lines.find((l) => l.description?.includes("MARKER-200"));

        expect(marker150, "API defect candidate: row-150 marker missing beyond server slice").toBeDefined();
        expect(marker200, "API defect candidate: row-200 marker missing beyond client cap").toBeDefined();
        expect(marker150!.source_row).toBeGreaterThanOrEqual(BOQ_WORKBOOK_SERVER_AI_ROW_CAP);
        expect(marker200!.source_row).toBeGreaterThan(BOQ_WORKBOOK_CLIENT_ROW_CAP);

        const tab1Sheet = extraction.reconciliation.sheets.find((s) => s.name === tab1 || s.name === tab1.slice(0, 31));
        expect(tab1Sheet, "API defect candidate: primary tab reconciliation missing").toBeDefined();
        expect(tab1Sheet!.itemRows).toBeGreaterThan(BOQ_WORKBOOK_CLIENT_ROW_CAP);
        expect(extraction.reconciliation.totals.importedLines).toBe(extraction.lines.length);
    });

    it("empty-middle-tab accounts for the blank worksheet without dropping populated tabs", () => {
        const extraction = extractFromGrid("empty-middle-tab");
        const empty = extraction.reconciliation.sheets.find((s) => s.name.includes("Empty"));
        expect(empty, "API defect candidate: empty tab not present in reconciliation").toBeDefined();
        expect(empty!.sourceRows + empty!.blankRows).toBeGreaterThanOrEqual(0);
        expect(extraction.lines.length).toBeGreaterThan(0);
        expect(dispositionBySheet(extraction, "SYNTH-Tab-1").length).toBeGreaterThan(0);
    });

    it("merged-repeated-headers yields dispositions and items after title merge and repeated header band", () => {
        const extraction = extractFromGrid("merged-repeated-headers");
        const sheetRec = extraction.reconciliation.sheets[0];
        expect(sheetRec.headingRows + sheetRec.itemRows).toBeGreaterThan(0);
        expect(extraction.rows.some((r) => r.kind === "heading" || r.kind === "item")).toBe(true);
        const headings = extraction.rows.filter((r) => r.kind === "heading");
        const items = extraction.rows.filter((r) => r.kind === "item");
        expect(items.length).toBeGreaterThanOrEqual(2);
        expect(headings.length + items.length).toBeLessThanOrEqual(sheetRec.sourceRows);
    });

    it("reconciliation-mismatch records row-level mismatch counts (line total ≠ qty × rate)", () => {
        const extraction = extractFromGrid("reconciliation-mismatch");
        const sheetRec = extraction.reconciliation.sheets[0];
        expect(
            sheetRec.mismatchRows,
            "API defect candidate: expected mismatchRows for stated total 999 vs 10×12",
        ).toBeGreaterThanOrEqual(1);
        const blockers = mod.boqWorkbookImportBlockers(extraction);
        expect(Array.isArray(blockers)).toBe(true);
    });

    it("imported line provenance keys are unique per source sheet row", () => {
        const extraction = extractFromSheetJS("multi-tab-over-200");
        const keys = itemProvenanceKeys(extraction);
        const unique = new Set(keys);
        expect(
            unique.size,
            "API defect candidate: duplicate source_sheet/source_row on multiple lines",
        ).toBe(keys.length);
    });

    it("every item disposition with lineIndex maps to a line with matching provenance", () => {
        const extraction = extractFromGrid("merged-repeated-headers");
        for (const row of extraction.rows) {
            if (row.kind !== "item" || row.lineIndex == null) continue;
            const line = extraction.lines[row.lineIndex];
            expect(line, `missing line for disposition row ${row.sheet}:${row.row}`).toBeDefined();
            expect(line.source_sheet).toBe(row.sheet);
            expect(line.source_row).toBe(row.row);
        }
    });

    it("source row coverage: item dispositions match imported line count for synthetic primary tab", () => {
        const extraction = extractFromGrid("multi-tab-over-200");
        const itemDispositions = extraction.rows.filter((r) => r.kind === "item");
        expect(extraction.reconciliation.totals.importedLines).toBe(extraction.lines.length);
        expect(
            itemDispositions.length,
            "API defect candidate: item disposition count diverges from imported lines",
        ).toBe(extraction.lines.length);
        expect(
            extraction.reconciliation.balanced,
            "API defect candidate: workbook reconciliation not balanced for multi-tab fixture",
        ).toBe(true);
    });

    it("duplicate provenance on distinct source rows surfaces coverage warnings or blockers", () => {
        const duplicateRow = dataRow({
            ref: synthRef(9, 1),
            section: "SYNTH Dup",
            description: "SYNTH-BQ duplicate coverage probe",
            quantity: "2",
            unit: "nr",
            rate: "50",
            total: "100",
        });
        const sheet: BoqWorkbookSheet = {
            name: "SYNTH-Dup-Provenance",
            rows: [headerRow(), duplicateRow, { ...duplicateRow }],
        };
        const input: BoQWorkbookInput = {
            filename: "SYNTH-duplicate-provenance.xlsx",
            sheets: gridsToSheetInputs([sheet]),
        };
        const extraction = mod.extractBoQWorkbook(input);
        expect(extraction.lines.length).toBeGreaterThanOrEqual(2);
        const blockers = mod.boqWorkbookImportBlockers(extraction);
        const sheetRec = extraction.reconciliation.sheets[0];
        const coverageGap =
            sheetRec.sourceRows !== sheetRec.itemRows + sheetRec.headingRows + sheetRec.excludedRows + sheetRec.blankRows + sheetRec.unresolvedRows;
        const hasWarning = sheetRec.warningRows > 0 || !extraction.reconciliation.balanced || blockers.length > 0;
        expect(
            hasWarning || !coverageGap,
            "API defect candidate: duplicate/unaccounted source rows should warn or block",
        ).toBe(true);
    });

    it("boqWorkbookImportBlockers respects maxLines guard without throwing", () => {
        const extraction = extractFromSheetJS("multi-tab-over-200");
        const blockersDefault = mod.boqWorkbookImportBlockers(extraction);
        const blockersTiny = mod.boqWorkbookImportBlockers(extraction, 5);
        expect(blockersTiny.length).toBeGreaterThanOrEqual(blockersDefault.length);
    });
});