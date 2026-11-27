/**
 * R1 Claude API snapshot for draft intake regression tests (D120).
 * Remove this file once `boq-workbook.ts` ships with its own exports.
 */
import type * as XLSX from "xlsx";

export type BoQCellObject = {
    v?: string | number | boolean | null;
    w?: string;
    formula?: string;
    error?: string;
};

export type BoQCellInput = string | number | boolean | null | BoQCellObject;

export type BoQSheetInput = {
    name: string;
    hidden?: boolean;
    rows: BoQCellInput[][];
    firstRow?: number;
    firstCol?: number;
    merges?: XLSX.Range[];
};

export type BoQWorkbookInput = {
    filename: string;
    sheets: BoQSheetInput[];
};

/** Minimal SheetJS workbook shape accepted by `workbookInputFromSheetJS`. */
export type SheetJSWorkbookLike = {
    SheetNames: string[];
    Sheets: Record<string, XLSX.WorkSheet>;
    Workbook?: XLSX.WorkBook["Workbook"];
};

export type BoQImportedLine = {
    source_sheet: string;
    source_row: number;
    client_ref?: string;
    section?: string;
    description?: string;
    quantity?: number | null;
    unit?: string;
    unit_rate?: number;
    line_total?: number;
    [key: string]: unknown;
};

export type BoQRowDispositionKind = "item" | "heading" | "excluded" | "unresolved" | "blank";

export type BoQSourceRowDisposition = {
    sheet: string;
    row: number;
    kind: BoQRowDispositionKind;
    reason?: string;
    lineIndex?: number;
};

export type BoQSheetReconciliation = {
    name: string;
    sourceRows: number;
    blankRows: number;
    itemRows: number;
    headingRows: number;
    excludedRows: number;
    unresolvedRows: number;
    warningRows: number;
    mismatchRows: number;
    uncachedFormulaCells: number;
    errorCells: number;
    balanced: boolean;
    status: string;
};

export type BoQWorkbookReconciliation = {
    sheetCount: number;
    sheets: BoQSheetReconciliation[];
    totals: {
        sourceRows: number;
        itemRows: number;
        headingRows: number;
        blankRows: number;
        excludedRows: number;
        unresolvedRows: number;
        warningRows: number;
        mismatchRows: number;
        importedLines: number;
    };
    balanced: boolean;
};

export type BoQWorkbookExtraction = {
    filename: string;
    lines: BoQImportedLine[];
    sections: string[];
    rows: BoQSourceRowDisposition[];
    reconciliation: BoQWorkbookReconciliation;
};

export function extractBoQWorkbook(input: BoQWorkbookInput): BoQWorkbookExtraction;

export function workbookInputFromSheetJS(
    filename: string,
    workbook: SheetJSWorkbookLike,
): BoQWorkbookInput;

export function boqWorkbookImportBlockers(extraction: BoQWorkbookExtraction, maxLines?: number): string[];