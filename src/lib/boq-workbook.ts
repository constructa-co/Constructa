/**
 * Deterministic, all-tab client BoQ workbook extraction (no AI, no network).
 *
 * Every row of every sheet's used range gets exactly one disposition:
 *   item | continuation | heading | excluded | unresolved | blank
 * and the per-sheet and workbook reconciliation proves
 *   sourceRows === item + continuation + heading + excluded + unresolved + blank.
 *
 * Only `item` rows create estimate lines (one line per item row). A
 * `continuation` row carries more of that item's description, written on the
 * rows before or after the row holding its values, as NRM-style bills do.
 * Headings name the part of the bill the items sit under. Totals,
 * carried/brought-forward rows, repeated page headers and title blocks are
 * excluded but listed. Rows the extractor cannot place safely (values without a
 * description, a referenced item that never gets a quantity, unit, rate or
 * total, rows on visible tabs with no column header) are unresolved: never
 * imported and never dropped silently.
 *
 * Tabs are read in workbook order. By default every visible tab with a column
 * header is selected; the caller may choose another set (`includeSheets`), and
 * the rows of a tab left out are listed as excluded `sheet_not_selected`.
 *
 * Values are the cached values saved in the file. Nothing here evaluates
 * formulas or runs macros; a formula cell saved without a cached value reads
 * as empty and is counted in `uncachedFormulaCells`. Excel error values such as
 * #REF! are counted in `errorCells` and make the cell unreadable.
 */
import type { ClientBoQLine } from "@/app/dashboard/projects/costs/boq-import-action";
import { parseBoQNumberCell, reconcileBoQLineTotal, type BoQNumberCell } from "./boq-number";

// ─── Input contract ──────────────────────────────────────────────────────────

/** One cell. Plain primitives are enough for synthetic fixtures. */
export type BoQCellInput =
    | string
    | number
    | boolean
    | null
    | undefined
    | {
          /** Cached value (SheetJS `v`). `undefined`/`null` on a formula cell = no cached value. */
          v?: string | number | boolean | null;
          /** Formatted text as displayed (SheetJS `w`); preferred for refs and descriptions. */
          w?: string;
          /** True when the cell holds a formula (never evaluated). */
          formula?: boolean;
          /** True for an Excel error value such as #REF!. */
          error?: boolean;
      };

/** Zero-based inclusive merged range, as SheetJS `!merges`. Coordinates are absolute. */
export type BoQMergeInput = { s: { r: number; c: number }; e: { r: number; c: number } };

export interface BoQSheetInput {
    name: string;
    hidden?: boolean;
    /**
     * Rows of the sheet's used range, top to bottom. `rows[0]` is absolute
     * spreadsheet row `firstRow` (zero-based, default 0) and `rows[i][0]` is
     * absolute column `firstCol` (default 0). Ragged and sparse rows are fine.
     */
    rows: BoQCellInput[][];
    firstRow?: number;
    firstCol?: number;
    merges?: BoQMergeInput[];
}

export interface BoQWorkbookInput {
    filename: string;
    sheets: BoQSheetInput[];
}

export interface BoQWorkbookOptions {
    /**
     * Names of the tabs whose items are imported. Default: every visible tab
     * with a column header that is not a summary/collection tab.
     */
    includeSheets?: readonly string[];
}

// ─── Output contract ─────────────────────────────────────────────────────────

export type BoQColumnRole = "ref" | "description" | "quantity" | "unit" | "rate" | "total";

export type BoQRowKind = "item" | "continuation" | "heading" | "excluded" | "unresolved" | "blank";

export type BoQRowReason =
    // excluded
    | "above_header"
    | "repeated_header"
    | "total_row"
    | "note_text"
    | "merged_continuation"
    | "sheet_not_selected"
    | "hidden_sheet"
    | "non_boq_sheet"
    | "marked_excluded"
    // unresolved
    | "no_header_row"
    | "values_without_description"
    | "item_without_values";

export const BOQ_ROW_REASON_LABEL: Record<BoQRowReason, string> = {
    above_header: "Title rows above the column header",
    repeated_header: "Column header row",
    total_row: "Total / carried / brought-forward row",
    note_text: "Note or specification text",
    merged_continuation: "Merged-cell continuation",
    sheet_not_selected: "Tab not selected for import",
    hidden_sheet: "Hidden tab with no column header",
    non_boq_sheet: "Cover, notes or contents tab",
    marked_excluded: "Marked Excluded / Not used / By others in the file",
    no_header_row: "Tab has no recognisable column header",
    values_without_description: "Figures with no description",
    item_without_values: "Referenced item with no quantity, unit, rate or total",
};

export interface BoQRowDisposition {
    sheet: string;
    /** 1-based spreadsheet row number as Excel shows it. */
    row: number;
    kind: BoQRowKind;
    reason?: BoQRowReason;
    /** Short text preview of the row (max 160 chars). */
    preview: string;
    /** Index into `lines` for kind "item" and "continuation". */
    lineIndex?: number;
}

export type BoQSheetStatus = "mapped" | "summary" | "unmapped" | "non_boq" | "empty";

export interface BoQRowCounts {
    sourceRows: number;
    blankRows: number;
    itemRows: number;
    continuationRows: number;
    headingRows: number;
    excludedRows: number;
    unresolvedRows: number;
    /** Item rows with an unreadable quantity, rate or total (they block import). */
    warningRows: number;
    /** Item rows whose stated total ≠ qty × rate (imports at qty × rate). */
    mismatchRows: number;
    /** Items whose ref, section, description or unit is longer than the import accepts (they block import; text is never cut). */
    overLimitRows: number;
    uncachedFormulaCells: number;
    errorCells: number;
}

export interface BoQSheetReconciliation extends BoQRowCounts {
    sheet: string;
    /** Zero-based tab order. */
    index: number;
    hidden: boolean;
    status: BoQSheetStatus;
    /** Whether this tab's items are imported. */
    selected: boolean;
    /** 1-based header row, null when none was found. */
    headerRow: number | null;
    /** Column letter used for each role. */
    columns: Partial<Record<BoQColumnRole, string>>;
    /** Header cells naming a role already taken by an earlier column (not used), e.g. "G:rate". */
    ignoredColumns: string[];
    /** A1-style range of the cells present, null for an empty sheet. */
    usedRange: string | null;
    /** True when every source row has exactly one disposition. */
    balanced: boolean;
}

export interface BoQWorkbookReconciliation {
    sheetCount: number;
    sheets: BoQSheetReconciliation[];
    totals: BoQRowCounts;
    /** Number of tabs that contributed at least one item. */
    contributingSheets: number;
    balanced: boolean;
}

export interface BoQImportLine extends ClientBoQLine {
    source_sheet: string;
    /** 1-based first and last spreadsheet rows of the item (description and values). */
    source_row: number;
    source_row_end: number;
    /** Nearest heading above the item on its tab, if any. */
    heading?: string;
    /** Text markers read instead of a figure, e.g. "line_total: TBC". The figure is left empty, never guessed. */
    value_notes?: string[];
    /** Text longer than the import accepts. The full source text is kept here, never cut; import is blocked. */
    over_limit?: BoQOverLimit[];
}

/** The estimate-line text limits the import accepts (mirrors BoQLineSchema in src/lib/validation/schemas.ts). */
export const BOQ_LINE_TEXT_LIMITS = { client_ref: 50, section: 200, description: 1000, unit: 20 } as const;
export type BoQOverLimit = { field: keyof typeof BOQ_LINE_TEXT_LIMITS; length: number; limit: number };

export interface BoQWorkbookExtraction {
    filename: string;
    /** One line per item, in workbook order (tab order, then row order). */
    lines: BoQImportLine[];
    /** Section names in first-seen order. */
    sections: string[];
    /** One entry per source row of every sheet, blank rows included. */
    rows: BoQRowDisposition[];
    reconciliation: BoQWorkbookReconciliation;
}

// ─── Cell helpers ────────────────────────────────────────────────────────────

type Cell = { value: string | number | boolean | null; text: string; formula: boolean; error: boolean };
const EMPTY_CELL: Cell = { value: null, text: "", formula: false, error: false };

function readCell(input: BoQCellInput): Cell {
    if (input === null || input === undefined) return EMPTY_CELL;
    if (typeof input !== "object") {
        return { value: input, text: typeof input === "string" ? input.trim() : String(input), formula: false, error: false };
    }
    const value = input.v ?? null;
    const text = (input.w ?? (value === null ? "" : String(value))).trim();
    return { value, text, formula: Boolean(input.formula), error: Boolean(input.error) };
}

function isEmpty(cell: Cell): boolean {
    return !cell.text && (cell.value === null || cell.value === "");
}

export function columnLetter(index: number): string {
    let n = index + 1;
    let out = "";
    while (n > 0) {
        const rem = (n - 1) % 26;
        out = String.fromCharCode(65 + rem) + out;
        n = Math.floor((n - 1) / 26);
    }
    return out;
}

function norm(text: string): string {
    return text.toLowerCase().replace(/[£$€]/g, " £ ").replace(/[^a-z0-9£]+/g, " ").trim().replace(/\s+/g, " ");
}

const ROLE_NAMES: Record<BoQColumnRole, string[]> = {
    description: ["description", "item description", "description of work", "description of works", "work description", "details", "particulars", "work", "works", "scope"],
    ref: ["ref", "ref no", "reference", "item", "item no", "item ref", "item number", "no", "code", "clause", "bill ref", "item reference"],
    quantity: ["qty", "quantity", "quant", "qnty", "qty no"],
    unit: ["unit", "units", "uom", "unit of measure"],
    rate: ["rate", "rate £", "£ rate", "unit rate", "unit rate £", "price", "unit price", "unit cost", "rate per unit", "net rate", "net rate £", "all in rate", "all in rate £", "sell rate", "rate £ ex vat", "rate ex vat"],
    total: ["total", "total £", "£ total", "amount", "amount £", "£ amount", "sum", "line total", "extension", "value", "total cost", "net total", "net total £", "£"],
};
const ROLE_ORDER: BoQColumnRole[] = ["description", "quantity", "unit", "rate", "total", "ref"];

function roleOf(text: string): BoQColumnRole | null {
    const key = norm(text);
    if (!key) return null;
    for (const role of ROLE_ORDER) if (ROLE_NAMES[role].includes(key)) return role;
    return null;
}

type ColumnMap = Partial<Record<BoQColumnRole, number>>;
type HeaderHit = { map: ColumnMap; ignored: { col: number; role: BoQColumnRole }[] };

/** A header row names a description column and at least one of qty/unit/rate/total. */
function headerHit(cells: Cell[]): HeaderHit | null {
    const map: ColumnMap = {};
    const ignored: HeaderHit["ignored"] = [];
    cells.forEach((cell, col) => {
        if (typeof cell.value === "number") return;
        const role = roleOf(cell.text);
        if (!role) return;
        if (map[role] === undefined) map[role] = col;
        else ignored.push({ col, role });
    });
    if (map.description === undefined) return null;
    const valueRoles = (["quantity", "unit", "rate", "total"] as const).filter((r) => map[r] !== undefined).length;
    return valueRoles ? { map, ignored } : null;
}

function sameMap(a: ColumnMap, b: ColumnMap): boolean {
    return ROLE_ORDER.every((r) => a[r] === b[r]);
}

/** Subtotal phrases — always a total row, even when a ref column is populated. */
const TOTAL_PHRASE_ALWAYS =
    /\b(carried (forward|to|over)|brought forward|to collection|to (main )?summary|total carried|total brought)\b/i;
/** Leading patterns that are totals unless the row is a priced line item (ref + amount). */
const TOTAL_LEADING_STRICT =
    /^(sub[\s-]*total|grand total|page total|section total|carried\b|brought\b|c\s*\/\s*f\b|b\s*\/\s*f\b|vat\b)/i;

function isPricedReferencedRow(row: RowInfo): boolean {
    return (
        Boolean(row.ref) &&
        (row.total.value !== null || row.rate.value !== null || row.qty.value !== null)
    );
}

/** Total / collection row (excluded), not a priced bill item. */
function isTotalDispositionRow(row: RowInfo): boolean {
    if (row.unit || row.qty.value !== null) return false;
    const text = (row.description || row.lead).trim();
    if (!text) return false;
    if (TOTAL_PHRASE_ALWAYS.test(text)) return true;
    if (TOTAL_LEADING_STRICT.test(text)) return true;
    if (!row.ref && /^collection$/i.test(text)) return true;
    if (!row.ref && /^total$/i.test(text)) return true;
    if (isPricedReferencedRow(row)) return false;
    if (/^(total|collection)\b/i.test(text)) return true;
    if (!row.ref && /\btotal\b/i.test(text) && row.rate.value === null) return true;
    return false;
}
/** Words that mean "no figure here" in a quantity, rate or total cell. */
const NOTE_MARKER = /^(tbc|tba|to be confirmed|to be advised|incl\.?|included|inc\.?|n\/?a|nil|rate only|provisional|ps|pc)$/i;
const EXCLUDED_MARKER = /^(excluded|excl\.?|not used|not required|by others|omitted|omit)$/i;
/** Bullet characters used in place of a reference on note paragraphs. */
const BULLET_REF = /^[•·▪●◦*\-–—]+$/;
const SUMMARY_SHEET = /\b(summary|collection|form of tender)\b/i;
const NON_BOQ_SHEET = /\b(cover|notes?|contents|index|instructions?|preambles?|read ?me|front sheet|title)\b/i;
const HEADING_UNITS = new Set(["heading", "section", "header"]);
const MAX_HEADING_LENGTH = 120;
/** "80.00 m", "12 nr", "1,250 m²" — a quantity written with its unit in one cell. */
const QTY_WITH_UNIT = /^(-?[\d,]*\.?\d+)\s*([A-Za-z][A-Za-z0-9²³/.]{0,9})$/;

function numberCell(cell: Cell): BoQNumberCell {
    if (cell.error) return { value: null, malformed: true };
    if (cell.formula && cell.value === null) {
        return { value: null, malformed: true };
    }
    if (typeof cell.value === "number") {
        return Number.isFinite(cell.value) ? { value: cell.value, malformed: false } : { value: null, malformed: true };
    }
    if (cell.value === null || cell.value === "") return { value: null, malformed: false };
    return parseBoQNumberCell(typeof cell.value === "string" ? cell.value : cell.text);
}

function previewOf(cells: Cell[]): string {
    const text = cells.map((c) => c.text).filter(Boolean).join(" | ");
    return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}

const ZERO_COUNTS = (): BoQRowCounts => ({
    sourceRows: 0,
    blankRows: 0,
    itemRows: 0,
    continuationRows: 0,
    headingRows: 0,
    excludedRows: 0,
    unresolvedRows: 0,
    warningRows: 0,
    mismatchRows: 0,
    overLimitRows: 0,
    uncachedFormulaCells: 0,
    errorCells: 0,
});

// ─── Row reading ─────────────────────────────────────────────────────────────

type RowInfo = {
    blank: boolean;
    /** First non-empty text anywhere on the row. */
    lead: string;
    notes: string[];
    markedExcluded: boolean;
    hasNumber: boolean;
    ref: string;
    /** Text across the description span (description column up to the next mapped column). */
    description: string;
    /** Offset of the first non-empty description cell within the span (indent level). */
    depth: number;
    unit: string;
    qty: BoQNumberCell;
    rate: BoQNumberCell;
    total: BoQNumberCell;
    hasValues: boolean;
    refError: boolean;
    descriptionError: boolean;
    unitError: boolean;
};

function readRow(cells: Cell[], map: ColumnMap, width: number): RowInfo {
    const at = (role: BoQColumnRole): Cell => {
        const col = map[role];
        return col === undefined ? EMPTY_CELL : (cells[col] ?? EMPTY_CELL);
    };
    const descCol = map.description!;
    const nextMapped = Object.values(map).filter((c) => (c as number) > descCol).reduce((m, c) => Math.min(m, c as number), width);
    const parts: string[] = [];
    let depth = -1;
    let descriptionError = false;
    for (let c = descCol; c < nextMapped; c++) {
        const cell = cells[c] ?? EMPTY_CELL;
        if (cell.error) {
            descriptionError = true;
            continue;
        }
        const text = cell.text;
        if (!text) continue;
        if (depth < 0) depth = c - descCol;
        parts.push(text);
    }
    const description = parts.join(" ").replace(/\s+/g, " ").trim();
    const refCell = at("ref");
    const unitCell = at("unit");

    const notes: string[] = [];
    let markedExcluded = false;
    const valueOf = (role: "quantity" | "rate" | "total", label: string): BoQNumberCell => {
        const cell = at(role);
        if (!cell.error && typeof cell.value === "string") {
            if (EXCLUDED_MARKER.test(cell.text)) { markedExcluded = true; notes.push(`${label}: ${cell.text}`); return { value: null, malformed: false }; }
            if (NOTE_MARKER.test(cell.text)) { notes.push(`${label}: ${cell.text}`); return { value: null, malformed: false }; }
        }
        return numberCell(cell);
    };
    let unit = at("unit").text;
    let qty = valueOf("quantity", "quantity");
    const qtyCell = at("quantity");
    if (qty.malformed && !qtyCell.error && typeof qtyCell.value === "string") {
        const m = QTY_WITH_UNIT.exec(qtyCell.text);
        if (m && (!unit || unit.toLowerCase() === m[2].toLowerCase())) {
            const parsed = parseBoQNumberCell(m[1]);
            if (!parsed.malformed && parsed.value !== null) {
                qty = parsed;
                unit = unit || m[2];
            }
        }
    }
    const rate = valueOf("rate", "unit_rate");
    const total = valueOf("total", "line_total");
    const hasNumber = qty.value !== null || rate.value !== null || total.value !== null;
    const hasValues = hasNumber || qty.malformed || rate.malformed || total.malformed || Boolean(unit) || notes.length > 0;
    return {
        blank: !cells.some((c) => c && !isEmpty(c)),
        lead: cells.find((c) => c && c.text)?.text ?? "",
        notes,
        markedExcluded,
        hasNumber,
        ref: at("ref").text,
        description,
        depth: Math.max(depth, 0),
        unit,
        qty,
        rate,
        total,
        hasValues,
        refError: refCell.error,
        descriptionError,
        unitError: unitCell.error,
    };
}

// ─── Extraction ──────────────────────────────────────────────────────────────

export function extractBoQWorkbook(input: BoQWorkbookInput, options: BoQWorkbookOptions = {}): BoQWorkbookExtraction {
    const lines: BoQImportLine[] = [];
    const rows: BoQRowDisposition[] = [];
    const sheetsOut: BoQSheetReconciliation[] = [];
    const chosen = options.includeSheets ? new Set(options.includeSheets) : null;

    input.sheets.forEach((sheet, index) => {
        const firstRow = sheet.firstRow ?? 0;
        const firstCol = sheet.firstCol ?? 0;
        // Array.from, not map: sparse rows must read holes as empty cells.
        const grid: Cell[][] = Array.from(sheet.rows ?? [], (r) => Array.from(r ?? [], readCell));
        const width = grid.reduce((w, r) => Math.max(w, r.length), 0);
        const hidden = Boolean(sheet.hidden);
        const counts = ZERO_COUNTS();
        counts.sourceRows = grid.length;
        for (const r of grid) {
            for (const c of r) {
                if (c.formula && c.value === null && !c.error) counts.uncachedFormulaCells++;
                if (c.error) counts.errorCells++;
            }
        }

        const coveredFromAbove = new Set<string>();
        for (const m of sheet.merges ?? []) {
            for (let r = m.s.r + 1; r <= m.e.r; r++) for (let c = m.s.c; c <= m.e.c; c++) coveredFromAbove.add(`${r}:${c}`);
        }

        let headerIndex = -1;
        let hit: HeaderHit | null = null;
        for (let i = 0; i < grid.length; i++) {
            const found = headerHit(grid[i]);
            if (found) {
                headerIndex = i;
                hit = found;
                break;
            }
        }

        const nonBlank = grid.some((r) => r.some((c) => !isEmpty(c)));
        const status: BoQSheetStatus = !nonBlank
            ? "empty"
            : !hit
              ? NON_BOQ_SHEET.test(sheet.name) ? "non_boq" : "unmapped"
              : SUMMARY_SHEET.test(sheet.name) ? "summary" : "mapped";
        const selected = Boolean(hit) && (chosen ? chosen.has(sheet.name) : status === "mapped" && !hidden);

        // Dispositions are decided per row; items may span rows, so fill by index.
        const disp: { kind: BoQRowKind; reason?: BoQRowReason; lineIndex?: number }[] = new Array(grid.length);
        const set = (i: number, kind: BoQRowKind, reason?: BoQRowReason, lineIndex?: number) => {
            disp[i] = { kind, ...(reason ? { reason } : {}), ...(lineIndex !== undefined ? { lineIndex } : {}) };
        };

        const sheetLabel = sheet.name.trim() || `Sheet ${index + 1}`;
        let heading: string | undefined;
        let headingRow = -2;

        type Open = {
            rows: number[];
            ref: string;
            texts: string[];
            depth: number;
            values?: RowInfo;
            valueRow?: number;
            lastRow: number;
            refError?: boolean;
            descriptionError?: boolean;
            unitError?: boolean;
        };
        let open: Open | null = null;
        /** A bulleted note paragraph: its following text rows are note text, not headings. */
        let noteDepth: number | null = null;

        const finishHeading = (i: number, text: string) => {
            heading = headingRow === i - 1 && heading ? `${heading} ${text}` : text;
            headingRow = i;
            set(i, "heading");
        };

        const close = () => {
            if (!open) return;
            const o = open;
            open = null;
            if (!o.values) {
                // A referenced row that never gets figures: a numbered heading if short, else unresolved.
                const text = o.texts.join(" ");
                if (o.rows.length === 1 && text.length <= MAX_HEADING_LENGTH) finishHeading(o.rows[0], text);
                else for (const r of o.rows) set(r, "unresolved", "item_without_values");
                return;
            }
            const v = o.values;
            if (v.markedExcluded) {
                for (const r of o.rows) set(r, "excluded", "marked_excluded");
                return;
            }
            const finalDescription = o.texts.join(" ").replace(/\s+/g, " ").trim();
            const descriptionBlocked = Boolean(o.descriptionError || v.descriptionError);
            if (!finalDescription && !descriptionBlocked) {
                const reason: BoQRowReason =
                    v.hasNumber || Boolean(o.ref) ? "values_without_description" : "item_without_values";
                for (const r of o.rows) set(r, "unresolved", reason);
                return;
            }
            const parse_warnings: string[] = [];
            if (o.refError || v.refError) parse_warnings.push("client_ref");
            if (o.descriptionError || v.descriptionError) parse_warnings.push("description");
            if (o.unitError || v.unitError) parse_warnings.push("unit");
            if (v.qty.malformed) parse_warnings.push("quantity");
            if (v.rate.malformed) parse_warnings.push("unit_rate");
            if (v.total.malformed) parse_warnings.push("line_total");
            const quantity = v.qty.malformed ? null : v.qty.value;
            const unit_rate = v.rate.malformed ? 0 : (v.rate.value ?? 0);
            const stated = v.total.malformed ? null : v.total.value;
            const { line_total, total_mismatch } = reconcileBoQLineTotal(quantity, unit_rate, stated);
            if (parse_warnings.length) counts.warningRows++;
            if (total_mismatch) counts.mismatchRows++;
            const lineIndex = lines.length;
            lines.push({
                client_ref: o.ref,
                section: sheetLabel,
                description: finalDescription,
                quantity,
                unit: v.unit || "item",
                unit_rate,
                line_total,
                ...(parse_warnings.length ? { parse_warnings } : {}),
                ...(total_mismatch ? { total_mismatch } : {}),
                source_sheet: sheet.name,
                source_row: firstRow + o.rows[0] + 1,
                source_row_end: firstRow + o.rows[o.rows.length - 1] + 1,
                ...(heading ? { heading } : {}),
                ...(v.notes.length ? { value_notes: v.notes } : {}),
            });
            for (const r of o.rows) set(r, r === o.valueRow ? "item" : "continuation", undefined, lineIndex);
        };

        let map = hit?.map ?? {};
        let lastBlank = true;

        for (let i = 0; i < grid.length; i++) {
            const cells = grid[i];
            const blank = !cells.some((c) => !isEmpty(c));
            if (blank) {
                close();
                noteDepth = null;
                set(i, "blank");
                lastBlank = true;
                continue;
            }
            if (!hit) {
                if (hidden) set(i, "excluded", "hidden_sheet");
                else if (status === "non_boq") set(i, "excluded", "non_boq_sheet");
                else set(i, "unresolved", "no_header_row");
                continue;
            }
            if (i < headerIndex) { set(i, "excluded", "above_header"); continue; }
            if (i === headerIndex) { set(i, "excluded", "repeated_header"); continue; }
            if (!selected) { set(i, "excluded", "sheet_not_selected"); continue; }

            const again = headerHit(cells);
            if (again) {
                close();
                if (!sameMap(again.map, map)) map = again.map;
                set(i, "excluded", "repeated_header");
                lastBlank = false;
                continue;
            }

            const row = readRow(cells, map, width);
            const wasBlank = lastBlank;
            lastBlank = false;

            if (isTotalDispositionRow(row)) {
                close();
                noteDepth = null;
                set(i, "excluded", "total_row");
                continue;
            }

            const bullet = BULLET_REF.test(row.ref);
            if (bullet && row.description && !row.hasNumber) {
                close();
                noteDepth = row.depth;
                set(i, "excluded", "note_text");
                continue;
            }
            if (noteDepth !== null && row.description && !row.ref && !row.hasValues && row.depth >= noteDepth) {
                set(i, "excluded", "note_text");
                continue;
            }
            noteDepth = null;

            if (!row.description && !row.ref) {
                if (open?.values && row.descriptionError) {
                    open.descriptionError = true;
                    open.rows.push(i);
                    open.lastRow = i;
                    continue;
                }
                if (row.hasValues && open && !open.values) {
                    open.values = row;
                    open.valueRow = i;
                    open.rows.push(i);
                    open.lastRow = i;
                    continue;
                }
                close();
                const descAbs = `${firstRow + i}:${firstCol + map.description!}`;
                const markerOnlyNoDesc = row.notes.length > 0 && !row.hasNumber;
                if (row.hasNumber) set(i, "unresolved", "values_without_description");
                else if (markerOnlyNoDesc) set(i, "unresolved", "item_without_values");
                else if (coveredFromAbove.has(descAbs)) set(i, "excluded", "merged_continuation");
                else set(i, "excluded", "note_text");
                continue;
            }

            const headingUnit = HEADING_UNITS.has(row.unit.toLowerCase());
            const values = row.hasValues && !headingUnit;

            if (row.ref) {
                close();
                open = {
                    rows: [i],
                    ref: row.ref,
                    texts: [row.description],
                    depth: row.depth,
                    lastRow: i,
                    ...(row.refError ? { refError: true } : {}),
                    ...(row.descriptionError ? { descriptionError: true } : {}),
                    ...(row.unitError ? { unitError: true } : {}),
                };
                if (values) { open.values = row; open.valueRow = i; }
                continue;
            }

            // Unreferenced text: more of the open item's description, or a new unreferenced item, heading or note.
            if (open && !open.values && row.depth >= open.depth) {
                open.texts.push(row.description);
                open.rows.push(i);
                open.lastRow = i;
                if (values) { open.values = row; open.valueRow = i; }
                continue;
            }
            if (open && open.values && !values && !wasBlank && row.depth >= open.depth && row.depth > 0) {
                if (row.descriptionError) open.descriptionError = true;
                if (row.description) open.texts.push(row.description);
                open.rows.push(i);
                open.lastRow = i;
                continue;
            }
            close();
            if (values) {
                open = { rows: [i], ref: "", texts: [row.description], depth: row.depth, values: row, valueRow: i, lastRow: i };
                continue;
            }
            if (row.description.length <= MAX_HEADING_LENGTH) finishHeading(i, row.description);
            else set(i, "excluded", "note_text");
        }
        close();

        for (let i = 0; i < grid.length; i++) {
            const d = disp[i];
            rows.push({
                sheet: sheet.name,
                row: firstRow + i + 1,
                kind: d.kind,
                ...(d.reason ? { reason: d.reason } : {}),
                preview: previewOf(grid[i]),
                ...(d.lineIndex !== undefined ? { lineIndex: d.lineIndex } : {}),
            });
            if (d.kind === "item") counts.itemRows++;
            else if (d.kind === "continuation") counts.continuationRows++;
            else if (d.kind === "heading") counts.headingRows++;
            else if (d.kind === "excluded") counts.excludedRows++;
            else if (d.kind === "unresolved") counts.unresolvedRows++;
            else counts.blankRows++;
        }

        const usedRange = grid.length && width
            ? `${columnLetter(firstCol)}${firstRow + 1}:${columnLetter(firstCol + width - 1)}${firstRow + grid.length}`
            : null;
        const columns: Partial<Record<BoQColumnRole, string>> = {};
        if (hit) for (const [role, col] of Object.entries(hit.map)) columns[role as BoQColumnRole] = columnLetter(firstCol + (col as number));
        const accounted = counts.itemRows + counts.continuationRows + counts.headingRows + counts.excludedRows + counts.unresolvedRows + counts.blankRows;
        sheetsOut.push({
            sheet: sheet.name,
            index,
            hidden,
            status,
            selected,
            headerRow: hit ? firstRow + headerIndex + 1 : null,
            columns,
            ignoredColumns: hit ? hit.ignored.map((g) => `${columnLetter(firstCol + g.col)}:${g.role}`) : [],
            usedRange,
            ...counts,
            balanced: accounted === counts.sourceRows && disp.filter(Boolean).length === grid.length,
        });
    });

    // One tab contributing: name sections by its headings. Several: by tab (the bill).
    const contributing = new Set(lines.map((l) => l.source_sheet));
    if (contributing.size === 1) {
        for (const line of lines) if (line.heading) line.section = line.heading;
    }

    // Text is never cut to fit: an over-limit field is flagged on the line and blocks import.
    const sheetByName = new Map(sheetsOut.map((s) => [s.sheet, s]));
    for (const line of lines) {
        const over: BoQOverLimit[] = [];
        for (const field of Object.keys(BOQ_LINE_TEXT_LIMITS) as (keyof typeof BOQ_LINE_TEXT_LIMITS)[]) {
            const length = line[field].length;
            const limit = BOQ_LINE_TEXT_LIMITS[field];
            if (length > limit) over.push({ field, length, limit });
        }
        if (over.length) {
            line.over_limit = over;
            sheetByName.get(line.source_sheet)!.overLimitRows++;
        }
    }

    const totals = ZERO_COUNTS();
    for (const s of sheetsOut) for (const key of Object.keys(totals) as (keyof BoQRowCounts)[]) totals[key] += s[key];
    const sections: string[] = [];
    const seen = new Set<string>();
    for (const line of lines) {
        if (!seen.has(line.section)) {
            seen.add(line.section);
            sections.push(line.section);
        }
    }
    const itemRowsMatchLines = totals.itemRows === lines.length;

    return {
        filename: input.filename,
        lines,
        sections,
        rows,
        reconciliation: {
            sheetCount: sheetsOut.length,
            sheets: sheetsOut,
            totals,
            contributingSheets: contributing.size,
            balanced: sheetsOut.every((s) => s.balanced) && rows.length === totals.sourceRows && itemRowsMatchLines,
        },
    };
}

export const BOQ_IMPORT_MAX_LINES = 2000;
export const BOQ_IMPORT_MAX_SECTIONS = 100;

/** Why the extraction cannot be imported as it stands; empty when it can. Nothing is ever cut to fit. */
export function boqWorkbookImportBlockers(extraction: BoQWorkbookExtraction): string[] {
    const blockers: string[] = [];
    const { totals, balanced } = extraction.reconciliation;
    if (!balanced) blockers.push("Row reconciliation does not balance.");
    if (!extraction.lines.length) blockers.push("No line items were found on the selected tabs.");
    if (extraction.lines.length > BOQ_IMPORT_MAX_LINES) {
        blockers.push(`${extraction.lines.length} line items exceed the ${BOQ_IMPORT_MAX_LINES}-line import limit. Select fewer tabs; nothing has been cut.`);
    }
    if (extraction.sections.length > BOQ_IMPORT_MAX_SECTIONS) {
        blockers.push(`${extraction.sections.length} sections exceed the ${BOQ_IMPORT_MAX_SECTIONS}-section import limit. Select fewer tabs; nothing has been cut.`);
    }
    if (totals.warningRows) blockers.push(`${totals.warningRows} item(s) have unreadable quantities, rates or totals.`);
    if (totals.overLimitRows) {
        const l = BOQ_LINE_TEXT_LIMITS;
        blockers.push(
            `${totals.overLimitRows} item(s) have text longer than the import accepts (ref ${l.client_ref}, section ${l.section}, description ${l.description}, unit ${l.unit} characters). Nothing has been cut — shorten or split them in the file, or untick their tab.`,
        );
    }
    return blockers;
}

// ─── SheetJS adapter ─────────────────────────────────────────────────────────

/** Minimal structural view of a SheetJS workbook (avoids a type import of `xlsx`). */
type SheetJSCell = { v?: unknown; w?: string; t?: string; f?: string };
type SheetJSSheet = Record<string, unknown> & { "!merges"?: BoQMergeInput[] };
export type SheetJSWorkbookLike = {
    SheetNames: string[];
    Sheets: Record<string, SheetJSSheet>;
    Workbook?: { Sheets?: { Hidden?: number }[] };
};

function decodeAddress(address: string): { r: number; c: number } | null {
    const m = /^([A-Z]+)(\d+)$/.exec(address);
    if (!m) return null;
    let c = 0;
    for (const ch of m[1]) c = c * 26 + (ch.charCodeAt(0) - 64);
    return { r: Number(m[2]) - 1, c: c - 1 };
}

/** SheetJS read options for client BoQs: cached values, formula presence only, no VBA, no styles. */
export const BOQ_SHEETJS_READ_OPTIONS = { cellFormula: true, cellStyles: false, cellHTML: false, bookVBA: false } as const;

/**
 * Converts a workbook read by SheetJS (`XLSX.read(data, BOQ_SHEETJS_READ_OPTIONS)`)
 * into the extractor input. The used range is taken from the cells actually
 * present, not the declared `!ref`, so formatting-only ranges cannot inflate it.
 */
export function workbookInputFromSheetJS(filename: string, workbook: SheetJSWorkbookLike): BoQWorkbookInput {
    const sheets: BoQSheetInput[] = workbook.SheetNames.map((name, index) => {
        const ws = workbook.Sheets[name] ?? {};
        const hidden = (workbook.Workbook?.Sheets?.[index]?.Hidden ?? 0) !== 0;
        const merges = ws["!merges"] ?? [];
        const cells: { r: number; c: number; cell: SheetJSCell }[] = [];
        for (const key of Object.keys(ws)) {
            if (key.startsWith("!")) continue;
            const pos = decodeAddress(key);
            if (pos) cells.push({ ...pos, cell: ws[key] as SheetJSCell });
        }
        if (!cells.length) return { name, hidden, rows: [], merges };
        let minR = Infinity, maxR = -1, minC = Infinity, maxC = -1;
        for (const { r, c } of cells) {
            minR = Math.min(minR, r); maxR = Math.max(maxR, r);
            minC = Math.min(minC, c); maxC = Math.max(maxC, c);
        }
        const rows: BoQCellInput[][] = Array.from({ length: maxR - minR + 1 }, () => []);
        for (const { r, c, cell } of cells) {
            const v = cell.v;
            const error = cell.t === "e";
            rows[r - minR][c - minC] = {
                v: error ? null : typeof v === "string" || typeof v === "number" || typeof v === "boolean" ? v : v instanceof Date ? v.toISOString() : null,
                ...(typeof cell.w === "string" ? { w: cell.w } : {}),
                ...(cell.f ? { formula: true } : {}),
                ...(error ? { error: true } : {}),
            };
        }
        return { name, hidden, rows, firstRow: minR, firstCol: minC, merges };
    });
    return { filename, sheets };
}
