import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
    BOQ_IMPORT_MAX_LINES,
    BOQ_SHEETJS_READ_OPTIONS,
    boqWorkbookImportBlockers,
    extractBoQWorkbook,
    workbookInputFromSheetJS,
    type BoQCellInput,
    type BoQWorkbookExtraction,
    type BoQWorkbookInput,
} from "./boq-workbook";

// Synthetic data only. No real tender names, prices or files.

const HEADER = ["Ref", "Description", "", "", "Quant", "Unit", "Rate", "£"];

/** NRM-style bill: indented descriptions over several rows, values on the last row. */
function nrmBill(): BoQCellInput[][] {
    return [
        ["Pricing document"],
        ["Bill 2 Demolitions"],
        [],
        HEADER,
        [],
        ["", "Generally"],
        [],
        ["", "Remove"],
        [],
        ["A", "", "", "Kiosk; disposal off-site", 2, "nr", 150, 300],
        [],
        ["B", "", "", "Barriers with posts at", null, null, null, null],
        ["", "", "", "1200 centres; remove from site", 40, "m", 5, 200],
        [],
        ["C", "", "", "Desk enclosure complete", 1, "nr", 900, 900],
        ["", "", "", "approximately 12 m long", null, null, null, null],
        ["", "", "", "disposal off-site", null, null, null, null],
        [],
        HEADER,
        ["D", "", "", "Screed 100 thick", 25, "m²", 12, 300],
        [],
        ["", "Total carried to collection", "", "", null, null, null, 1700],
    ];
}

function every(extraction: BoQWorkbookExtraction) {
    const keys = extraction.rows.map((r) => `${r.sheet}!${r.row}`);
    return { keys, unique: new Set(keys).size };
}

describe("extractBoQWorkbook — every tab, every row", () => {
    const input: BoQWorkbookInput = {
        filename: "synthetic.xlsx",
        sheets: [
            { name: "Cover", rows: [["Tender for works"], ["Prepared by a contractor"]] },
            { name: "Bill 2", rows: nrmBill() },
            { name: "Workings", rows: [["scratch", 1, 2], ["more", 3, 4]] },
            { name: "Old bill", hidden: true, rows: [HEADER, ["A", "Old item", "", "", 1, "nr", 1, 1]] },
            { name: "Main Summary", rows: [["Ref", "Description", "£"], ["02", "Demolitions", 1700]] },
            { name: "Blank", rows: [] },
        ],
    };
    const ex = extractBoQWorkbook(input);

    it("reads all six tabs and gives each source row exactly one disposition", () => {
        expect(ex.reconciliation.sheetCount).toBe(6);
        expect(ex.reconciliation.balanced).toBe(true);
        const sourceRows = input.sheets.reduce((n, s) => n + s.rows.length, 0);
        expect(ex.reconciliation.totals.sourceRows).toBe(sourceRows);
        const { keys, unique } = every(ex);
        expect(keys).toHaveLength(sourceRows);
        expect(unique).toBe(sourceRows);
        const t = ex.reconciliation.totals;
        expect(t.itemRows + t.continuationRows + t.headingRows + t.excludedRows + t.unresolvedRows + t.blankRows).toBe(t.sourceRows);
    });

    it("classifies tabs without pretending every non-empty row is an item", () => {
        const status = Object.fromEntries(ex.reconciliation.sheets.map((s) => [s.sheet, [s.status, s.selected]]));
        expect(status).toEqual({
            Cover: ["non_boq", false],
            "Bill 2": ["mapped", true],
            Workings: ["unmapped", false],
            "Old bill": ["mapped", false],
            "Main Summary": ["summary", false],
            Blank: ["empty", false],
        });
        const reasons = (sheet: string) => ex.rows.filter((r) => r.sheet === sheet).map((r) => r.reason ?? r.kind);
        expect(reasons("Cover")).toEqual(["non_boq_sheet", "non_boq_sheet"]);
        expect(reasons("Workings")).toEqual(["no_header_row", "no_header_row"]);
        expect(reasons("Old bill")).toEqual(["repeated_header", "sheet_not_selected"]);
        expect(reasons("Main Summary")).toEqual(["repeated_header", "sheet_not_selected"]);
        expect(ex.reconciliation.totals.unresolvedRows).toBe(2);
    });

    it("joins multi-row NRM descriptions, keeps refs, headings and sheet/row provenance", () => {
        expect(ex.lines.map((l) => [l.client_ref, l.description, l.quantity, l.unit, l.unit_rate, l.line_total, l.source_row, l.source_row_end])).toEqual([
            ["A", "Kiosk; disposal off-site", 2, "nr", 150, 300, 10, 10],
            ["B", "Barriers with posts at 1200 centres; remove from site", 40, "m", 5, 200, 12, 13],
            ["C", "Desk enclosure complete approximately 12 m long disposal off-site", 1, "nr", 900, 900, 15, 17],
            ["D", "Screed 100 thick", 25, "m²", 12, 300, 20, 20],
        ]);
        expect(ex.lines.every((l) => l.source_sheet === "Bill 2")).toBe(true);
        expect(ex.lines[0].heading).toBe("Remove");
        const bill = (row: number) => ex.rows.find((r) => r.sheet === "Bill 2" && r.row === row)!;
        expect(bill(1).reason).toBe("above_header");
        expect(bill(4).reason).toBe("repeated_header");
        expect(bill(19).reason).toBe("repeated_header");
        expect(bill(6).kind).toBe("heading");
        expect(bill(12).kind).toBe("continuation");
        expect(bill(13).kind).toBe("item");
        expect(bill(22).reason).toBe("total_row");
        // One tab contributing: sections come from its headings.
        expect(ex.sections).toEqual(["Remove"]);
        expect(boqWorkbookImportBlockers(ex)).toEqual([]);
    });

    it("imports the tabs the caller selects, naming sections by tab when several contribute", () => {
        const both = extractBoQWorkbook(input, { includeSheets: ["Bill 2", "Old bill"] });
        expect(both.lines).toHaveLength(5);
        expect(both.sections).toEqual(["Bill 2", "Old bill"]);
        expect(both.reconciliation.contributingSheets).toBe(2);
        const none = extractBoQWorkbook(input, { includeSheets: [] });
        expect(none.lines).toHaveLength(0);
        expect(none.reconciliation.balanced).toBe(true);
        expect(boqWorkbookImportBlockers(none)).toContain("No line items were found on the selected tabs.");
    });
});

describe("figures are read, never guessed", () => {
    const sheet = (rows: BoQCellInput[][]) =>
        extractBoQWorkbook({ filename: "f.xlsx", sheets: [{ name: "Bill", rows: [["Ref", "Description", "Qty", "Unit", "Rate", "Total"], ...rows] }] });

    it("keeps TBC as an empty figure with a note, lists Excluded rows, and splits '12.5 m2'", () => {
        const ex = sheet([
            ["A", "Provisional sum for signage", null, "item", null, "TBC"],
            ["B", "Roller shutter", "Excluded", "item", null, null],
            ["C", "Skirting", "12.5 m2", null, 4, 50],
        ]);
        expect(ex.lines.map((l) => [l.client_ref, l.quantity, l.unit, l.line_total, l.value_notes ?? null, l.parse_warnings ?? null])).toEqual([
            ["A", null, "item", 0, ["line_total: TBC"], null],
            ["C", 12.5, "m2", 50, null, null],
        ]);
        expect(ex.rows.find((r) => r.row === 3)?.reason).toBe("marked_excluded");
    });

    it("flags Excel error values and blocks import, and counts formula cells with no saved value", () => {
        const ex = sheet([
            ["A", "Testing", 1, "item", { v: null, w: "#REF!", formula: true, error: true }, { v: null, formula: true }],
            ["", "", null, null, null, 120],
        ]);
        expect(ex.lines[0].parse_warnings).toEqual(["unit_rate", "line_total"]);
        expect(ex.reconciliation.totals).toMatchObject({ errorCells: 1, uncachedFormulaCells: 1, warningRows: 1, unresolvedRows: 1 });
        expect(ex.rows[2]).toMatchObject({ kind: "unresolved", reason: "values_without_description" });
        expect(boqWorkbookImportBlockers(ex)).toContain("1 item(s) have unreadable quantities, rates or totals.");
    });

    it("has no row cap: 5,000 rows are all extracted and the line limit is reported, not applied", () => {
        const rows: BoQCellInput[][] = Array.from({ length: 5000 }, (_, i) => [`${i + 1}`, `Item ${i + 1}`, 1, "nr", 2, 2]);
        const ex = sheet(rows);
        expect(ex.lines).toHaveLength(5000);
        expect(ex.lines.at(-1)?.description).toBe("Item 5000");
        expect(ex.reconciliation.balanced).toBe(true);
        expect(boqWorkbookImportBlockers(ex).join(" ")).toContain(`5000 line items exceed the ${BOQ_IMPORT_MAX_LINES}-line import limit`);
    });
});

describe("text is never cut to fit the import limits", () => {
    it("keeps over-limit ref, description and unit in full, flags them per item and blocks import", () => {
        const part = "x".repeat(400);
        const ex = extractBoQWorkbook({
            filename: "long.xlsx",
            sheets: [{
                name: "Bill",
                rows: [
                    ["Ref", "Description", "Qty", "Unit", "Rate", "Total"],
                    ["A", `Start ${part}`, null, null, null, null],
                    ["", `middle ${part}`, null, null, null, null],
                    ["", `end ${part}`, 3, "nr", 10, 30],
                    ["R".repeat(60), "Short item", 1, "u".repeat(25), 5, 5],
                    ["C", "Fine item", 2, "m", 1, 2],
                ],
            }],
        });
        expect(ex.reconciliation.balanced).toBe(true);
        expect(ex.lines).toHaveLength(3);
        expect(ex.lines[0].description).toBe(`Start ${part} middle ${part} end ${part}`);
        expect(ex.lines[0].description.length).toBeGreaterThan(1000);
        expect(ex.lines[0].over_limit).toEqual([{ field: "description", length: ex.lines[0].description.length, limit: 1000 }]);
        expect(ex.lines[1].client_ref).toHaveLength(60);
        expect(ex.lines[1].unit).toHaveLength(25);
        expect(ex.lines[1].over_limit?.map((o) => o.field)).toEqual(["client_ref", "unit"]);
        expect(ex.lines[2].over_limit).toBeUndefined();
        expect(ex.reconciliation.sheets[0].overLimitRows).toBe(2);
        expect(ex.reconciliation.totals.overLimitRows).toBe(2);
        expect(boqWorkbookImportBlockers(ex).join(" ")).toMatch(/^2 item\(s\) have text longer than the import accepts .*Nothing has been cut/);
    });
});

describe("SheetJS adapter (in-memory workbook, cached values only)", () => {
    it("reads every tab, the hidden flag and the cells actually present", () => {
        const wb = XLSX.utils.book_new();
        const bill = XLSX.utils.aoa_to_sheet([["Ref", "Description", "Qty", "Unit", "Rate", "Total"], ["A", "Brickwork", 10, "m2", 50, 500]]);
        bill["!ref"] = "A1:Z500"; // declared range larger than the cells present
        XLSX.utils.book_append_sheet(wb, bill, "Bill");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Notes only"]]), "Notes");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Ref", "Description", "Qty"], ["Z", "Hidden", 1]]), "Hidden");
        wb.Workbook = { Sheets: [{ Hidden: 0 }, { Hidden: 0 }, { Hidden: 1 }] };
        const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

        const read = XLSX.read(buffer, { type: "buffer", ...BOQ_SHEETJS_READ_OPTIONS });
        const input = workbookInputFromSheetJS("mem.xlsx", read);
        expect(input.sheets.map((s) => [s.name, s.hidden, s.rows.length])).toEqual([
            ["Bill", false, 2],
            ["Notes", false, 1],
            ["Hidden", true, 2],
        ]);
        const ex = extractBoQWorkbook(input);
        expect(ex.reconciliation.sheets[0].usedRange).toBe("A1:F2");
        expect(ex.lines.map((l) => [l.source_sheet, l.source_row, l.description, l.line_total])).toEqual([["Bill", 2, "Brickwork", 500]]);
        expect(ex.reconciliation.sheets.map((s) => s.selected)).toEqual([true, false, false]);
        expect(ex.reconciliation.balanced).toBe(true);
    });

    it("passes formula presence, errors and sparse cells through without evaluating anything", () => {
        const input = workbookInputFromSheetJS("shape.xlsx", {
            SheetNames: ["Bill"],
            Sheets: {
                Bill: {
                    "!ref": "B2:XFD9999",
                    B2: { t: "s", v: "Description" }, D2: { t: "s", v: "Total" },
                    B3: { t: "s", v: "Item" }, D3: { t: "n", f: "1/0" },
                    B4: { t: "s", v: "Other" }, D4: { t: "e", v: 7, w: "#DIV/0!", f: "1/0" },
                },
            },
        });
        expect(input.sheets[0]).toMatchObject({ firstRow: 1, firstCol: 1 });
        const ex = extractBoQWorkbook(input);
        expect(ex.reconciliation.sheets[0]).toMatchObject({ usedRange: "B2:D4", sourceRows: 3, uncachedFormulaCells: 1, errorCells: 1, headerRow: 2 });
        expect(ex.rows.map((r) => r.row)).toEqual([2, 3, 4]);
    });
});

describe("Claude review fixes — uncached formulas, field errors, priced refs, TBC markers", () => {
    const sheet = (rows: BoQCellInput[][]) =>
        extractBoQWorkbook({ filename: "f.xlsx", sheets: [{ name: "Bill", rows: [["Ref", "Description", "Qty", "Unit", "Rate", "Total"], ...rows] }] });

    it("M1/R1: uncached formula (v null) is malformed; cached empty string formula is a valid blank", () => {
        const ex = sheet([
            ["", "Prelim heading", { v: "", formula: true }, "heading", null, null],
            ["B", "Measured area", { v: "", formula: true }, "m2", 5, 50],
            ["C", "Measured works", { v: null, formula: true }, "item", 12, 120],
        ]);
        const area = ex.lines.find((l) => l.client_ref === "B")!;
        expect(area.parse_warnings).toBeUndefined();
        expect(area.quantity).toBeNull();
        expect(area.line_total).toBe(50);
        expect(ex.lines.find((l) => l.client_ref === "C")!.parse_warnings).toContain("quantity");
        expect(boqWorkbookImportBlockers(ex).join(" ")).toMatch(/unreadable/);
    });

    it("M2: Excel errors on ref, description, unit and continuation description warn and skip error text", () => {
        const ex = sheet([
            ["A", "Primary line", 1, "nr", 10, 10],
            ["", { v: null, w: "#REF!", formula: true, error: true }, null, null, null, null],
            [
                { v: null, w: "#REF!", formula: true, error: true },
                { v: null, w: "#REF!", formula: true, error: true },
                2,
                { v: null, w: "#VALUE!", formula: true, error: true },
                5,
                10,
            ],
        ]);
        expect(ex.lines[0].description).toBe("Primary line");
        expect(ex.lines[0].parse_warnings).toEqual(["description"]);
        expect(ex.lines[1].parse_warnings).toEqual(["client_ref", "description", "unit"]);
        expect(ex.lines[1].description).not.toContain("#REF!");
        expect(boqWorkbookImportBlockers(ex).length).toBeGreaterThan(0);
    });

    it("M3/R3: priced Collection/Total items import; phrase totals and bare Collection exclude", () => {
        const ex = sheet([
            ["A2", "Collection and disposal of arisings", null, null, null, 250],
            ["A3", "Total station setting out", null, null, null, 400],
            ["A99", "Total carried to collection", null, null, null, 50],
            ["", "Collection", null, null, null, 50],
            ["", "Total carried to collection", null, null, null, 650],
        ]);
        expect(ex.lines.map((l) => [l.client_ref, l.line_total])).toEqual([
            ["A2", 250],
            ["A3", 400],
        ]);
        const sum = ex.lines.reduce((s, l) => s + l.line_total, 0);
        expect(sum).toBe(650);
        expect(ex.rows.filter((r) => r.reason === "total_row").length).toBeGreaterThanOrEqual(3);
    });

    it("R2: referenced blank description with figures does not emit an empty description line", () => {
        const ex = sheet([
            ["A5", "", 10, "m2", 5, 50],
            ["A4", "", "TBC", "m2", null, null],
        ]);
        expect(ex.lines).toHaveLength(0);
        expect(ex.rows.find((r) => r.preview.startsWith("A5"))).toMatchObject({
            kind: "unresolved",
            reason: "values_without_description",
        });
        expect(ex.rows.find((r) => r.preview.startsWith("A4"))).toMatchObject({
            kind: "unresolved",
            reason: "values_without_description",
        });
    });

    it("L2: marker-only TBC with no description is unresolved, not note text", () => {
        const ex = sheet([
            ["", "", null, null, null, "TBC"],
            ["", "", "TBC", "item", null, null],
        ]);
        expect(ex.rows[1]).toMatchObject({ kind: "unresolved", reason: "item_without_values" });
        expect(ex.rows[2]).toMatchObject({ kind: "unresolved", reason: "item_without_values" });
        expect(ex.lines).toHaveLength(0);
    });
});

describe("the import path has no silent row caps", () => {
    const costs = path.resolve(import.meta.dirname, "../app/dashboard/projects/costs");
    const ui = readFileSync(path.join(costs, "boq-import.tsx"), "utf8");
    const action = readFileSync(path.join(costs, "boq-import-action.ts"), "utf8");

    it("reads the whole workbook in the browser and does not send rows to AI", () => {
        expect(ui).not.toMatch(/rows\.slice\(0,\s*200\)/);
        expect(ui).not.toMatch(/SheetNames\[0\]/);
        expect(ui).toContain("extractBoQWorkbook");
        expect(action).not.toContain("parseBoQFromExcelDataAction");
        expect(action).not.toMatch(/\.slice\(0,\s*150\)/);
    });

    it("checks the saved line count instead of only logging an insert failure", () => {
        expect(action).not.toContain('console.error("Insert BoQ lines error:"');
        expect(action).toContain("importedLines !== linesToInsert.length");
    });
});
