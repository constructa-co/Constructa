import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import * as XLSX from "xlsx";
import type { BoqWorkbookScenarioId } from "./__fixtures__/boq-workbook";
import { encodeBoqWorkbookScenarioToXlsx, getBoqWorkbookScenario } from "./__fixtures__/boq-workbook";
import {
    BOQ_SHEETJS_READ_OPTIONS,
    boqWorkbookImportBlockers,
    extractBoQWorkbook,
    workbookInputFromSheetJS,
    type BoQCellInput,
    type BoQSheetInput,
    type BoQWorkbookExtraction,
    type BoQWorkbookInput,
} from "./boq-workbook";

/** Set on Rob’s machine to a private manifest JSON path; unset in CI. */
export const BOQ_LOCAL_MANIFEST_ENV = "BOQ_LOCAL_MANIFEST_PATH";

export type BoqWorkbookSource =
    | { kind: "fixture"; scenario_id: BoqWorkbookScenarioId }
    | { kind: "file"; path: string };

export interface BoqLocalSheetExpectation {
    name: string;
    source_rows?: number;
    used_range?: string;
    /** Rows with at least one non-empty source cell (formulas/errors/text/zero/false count; not parser blankRows). */
    nonempty_rows?: number;
    row_coverage_balanced?: boolean;
    selected?: boolean;
    expected_item_rows?: number;
    hidden?: boolean;
    /** Cached finite numeric cells on this tab (independent XML inventory). */
    numeric_cell_count?: number;
    /** Canonical digest of all finite numeric `v` values — see `numericCellsDigestForSheet`. */
    numeric_cells_sha256?: string;
}

export interface BoqLocalLineExpectation {
    client_ref?: string;
    source_sheet: string;
    source_row: number;
    quantity?: number | null;
    unit?: string;
    line_total?: number;
}

export interface BoqLocalWorkbookEntry {
    id: string;
    source: BoqWorkbookSource;
    sha256?: string;
    tab_count: number;
    /** When true (default), manifest `sheets` must list every adapter tab exactly once — no omissions. */
    require_all_tabs_listed?: boolean;
    include_sheets?: string[];
    sheets: BoqLocalSheetExpectation[];
    expectations?: {
        reconciliation_balanced?: boolean;
        total_item_rows?: number;
        /** True when import blockers are expected; false when a clean import is expected. */
        expected_has_blockers?: boolean;
        /** Sum of imported line totals in pence (independent bill); code `line_total_sum_cents` on mismatch. */
        selected_line_total_sum_cents?: number;
        lines?: BoqLocalLineExpectation[];
    };
}

export interface BoqLocalManifest {
    schema_version: 1;
    workbooks: BoqLocalWorkbookEntry[];
}

export type BoqCheckCode =
    | "sha256"
    | "mtime"
    | "tab_count"
    | "tab_coverage"
    | "source_rows"
    | "nonempty_rows"
    | "used_range"
    | "balanced"
    | "ledger_unique"
    | "item_rows"
    | "line_count"
    | "line_ref"
    | "line_qty"
    | "line_unit"
    | "line_total"
    | "line_total_sum_cents"
    | "blockers"
    | "numeric_count"
    | "numeric_digest";

export interface BoqWorkbookCheckResult {
    workbook_id: string;
    ok: boolean;
    codes_failed: BoqCheckCode[];
    summary: {
        tab_count: number;
        source_rows_total: number;
        item_rows: number;
        unresolved_rows: number;
        warning_rows: number;
        uncached_formula_cells: number;
        error_cells: number;
        blocker_count: number;
    };
}

export function sha256Buffer(data: ArrayBuffer | Buffer | string): string {
    if (typeof data === "string") return createHash("sha256").update(data, "utf8").digest("hex");
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    return createHash("sha256").update(buf).digest("hex");
}

export function loadBoqLocalManifest(path: string): BoqLocalManifest {
    const raw = JSON.parse(readFileSync(path, "utf8")) as BoqLocalManifest;
    if (raw.schema_version !== 1) throw new Error(`Unsupported manifest schema_version: ${(raw as BoqLocalManifest).schema_version}`);
    if (!Array.isArray(raw.workbooks) || !raw.workbooks.length) throw new Error("Manifest has no workbooks");
    return raw;
}

function isNonemptySourceCell(cell: BoQCellInput | undefined): boolean {
    if (cell === null || cell === undefined) return false;
    if (typeof cell !== "object") {
        if (typeof cell === "number") return true;
        if (typeof cell === "boolean") return true;
        return String(cell).trim() !== "";
    }
    if (cell.error) return true;
    if (cell.formula) return true;
    if (typeof cell.v === "number" || typeof cell.v === "boolean") return true;
    if (cell.v !== null && cell.v !== undefined && String(cell.v).trim() !== "") return true;
    if (cell.w?.trim()) return true;
    return false;
}

/** Source rows with any non-empty cell (independent of parser blank disposition). */
export function countNonemptySourceRows(sheet: BoQSheetInput): number {
    return sheet.rows.filter((row) => row?.some(isNonemptySourceCell)).length;
}

function finiteNumericFromCell(cell: BoQCellInput | undefined): number | null {
    if (cell === null || cell === undefined) return null;
    let v: unknown;
    if (typeof cell === "number") v = cell;
    else if (typeof cell === "object" && "v" in cell) v = cell.v;
    else return null;
    if (typeof v !== "number" || !Number.isFinite(v)) return null;
    return v;
}

/**
 * Canonical numeric digest for R1 XML cross-check:
 * For each finite numeric cell: `{absRow}:{absCol}:{ieee754_be_hex}` (16 hex),
 * sorted by row then column; `sha256` of `tokens.join("\n")` with **no** trailing newline.
 * `firstRow` / `firstCol` are zero-based absolute offsets on the sheet.
 */
export function numericCellsDigestForSheet(sheet: BoQSheetInput): { count: number; sha256: string } {
    const firstRow = sheet.firstRow ?? 0;
    const firstCol = sheet.firstCol ?? 0;
    const tokens: string[] = [];
    for (let r = 0; r < sheet.rows.length; r++) {
        const row = sheet.rows[r] ?? [];
        for (let c = 0; c < row.length; c++) {
            const n = finiteNumericFromCell(row[c]);
            if (n === null) continue;
            const absR = firstRow + r + 1;
            const absC = firstCol + c + 1;
            const buf = Buffer.alloc(8);
            buf.writeDoubleBE(n, 0);
            tokens.push(`${absR}:${absC}:${buf.toString("hex")}`);
        }
    }
    tokens.sort((a, b) => {
        const [ar, ac] = a.split(":").map(Number);
        const [br, bc] = b.split(":").map(Number);
        return ar - br || ac - bc;
    });
    const joined = tokens.join("\n");
    return { count: tokens.length, sha256: sha256Buffer(joined) };
}

function resolveWorkbookBytes(
    entry: BoqLocalWorkbookEntry,
): { bytes: Buffer; filename: string; mtimeMsBefore: number | null; filePath: string | null } {
    if (entry.source.kind === "fixture") {
        const buf = Buffer.from(encodeBoqWorkbookScenarioToXlsx(entry.source.scenario_id));
        return { bytes: buf, filename: `SYNTH-${entry.source.scenario_id}.xlsx`, mtimeMsBefore: null, filePath: null };
    }
    const path = entry.source.path;
    const mtimeMsBefore = statSync(path).mtimeMs;
    const bytes = readFileSync(path);
    const name = path.split(/[/\\]/).pop() ?? "workbook.xlsx";
    return { bytes, filename: name, mtimeMsBefore, filePath: path };
}

function coerceNum(a: number | null | undefined, b: number | null | undefined): boolean {
    if (a === undefined) return true;
    return (a ?? null) === (b ?? null);
}

function assertAllTabsListed(
    input: BoQWorkbookInput,
    entry: BoqLocalWorkbookEntry,
    failed: Set<BoqCheckCode>,
): Map<string, BoQSheetInput> {
    const byName = new Map(input.sheets.map((s) => [s.name, s]));
    const requireAll = entry.require_all_tabs_listed !== false;
    if (!requireAll) return byName;

    if (entry.sheets.length !== input.sheets.length || entry.tab_count !== input.sheets.length) {
        failed.add("tab_coverage");
    }
    const manifestNames = new Set(entry.sheets.map((s) => s.name));
    const actualNames = new Set(input.sheets.map((s) => s.name));
    if (manifestNames.size !== entry.sheets.length) failed.add("tab_coverage");
    for (const name of actualNames) {
        if (!manifestNames.has(name)) failed.add("tab_coverage");
    }
    for (const name of manifestNames) {
        if (!actualNames.has(name)) failed.add("tab_coverage");
    }
    return byName;
}

function checkWorkbook(entry: BoqLocalWorkbookEntry): BoqWorkbookCheckResult {
    const failed = new Set<BoqCheckCode>();
    const { bytes, filename, mtimeMsBefore, filePath } = resolveWorkbookBytes(entry);

    if (entry.source.kind === "file") {
        if (!entry.sha256) failed.add("sha256");
        else if (sha256Buffer(bytes) !== entry.sha256.toLowerCase()) failed.add("sha256");
    } else if (entry.sha256 && sha256Buffer(bytes) !== entry.sha256.toLowerCase()) {
        failed.add("sha256");
    }

    const workbook = XLSX.read(bytes, { type: "buffer", ...BOQ_SHEETJS_READ_OPTIONS });
    const input = workbookInputFromSheetJS(filename, workbook);
    const inputByName = assertAllTabsListed(input, entry, failed);

    const options = entry.include_sheets?.length ? { includeSheets: entry.include_sheets } : {};
    const extraction: BoQWorkbookExtraction = extractBoQWorkbook(input, options);

    if (filePath !== null && mtimeMsBefore !== null && statSync(filePath).mtimeMs !== mtimeMsBefore) {
        failed.add("mtime");
    }

    const ledgerKeys = extraction.rows.map((r) => `${r.sheet}!${r.row}`);
    if (new Set(ledgerKeys).size !== ledgerKeys.length) failed.add("ledger_unique");

    if (extraction.reconciliation.sheetCount !== entry.tab_count) failed.add("tab_count");

    const reconByName = new Map(extraction.reconciliation.sheets.map((s) => [s.sheet, s]));
    for (const exp of entry.sheets) {
        const actual = reconByName.get(exp.name);
        const srcSheet = inputByName.get(exp.name);
        if (!actual || !srcSheet) {
            failed.add("tab_coverage");
            continue;
        }
        if (exp.source_rows !== undefined && actual.sourceRows !== exp.source_rows) failed.add("source_rows");
        if (exp.nonempty_rows !== undefined) {
            const nonempty = countNonemptySourceRows(srcSheet);
            if (nonempty !== exp.nonempty_rows) failed.add("nonempty_rows");
        }
        if (exp.used_range !== undefined && actual.usedRange !== exp.used_range) failed.add("used_range");
        if (exp.row_coverage_balanced !== undefined && actual.balanced !== exp.row_coverage_balanced) failed.add("balanced");
        if (exp.selected !== undefined && actual.selected !== exp.selected) failed.add("source_rows");
        if (exp.expected_item_rows !== undefined && actual.itemRows !== exp.expected_item_rows) failed.add("item_rows");
        if (exp.hidden !== undefined && actual.hidden !== exp.hidden) failed.add("source_rows");
        if (exp.numeric_cell_count !== undefined || exp.numeric_cells_sha256 !== undefined) {
            const digest = numericCellsDigestForSheet(srcSheet);
            if (exp.numeric_cell_count !== undefined && digest.count !== exp.numeric_cell_count) failed.add("numeric_count");
            if (exp.numeric_cells_sha256 !== undefined && digest.sha256 !== exp.numeric_cells_sha256.toLowerCase()) {
                failed.add("numeric_digest");
            }
        }
    }

    const wantBalanced = entry.expectations?.reconciliation_balanced;
    if (wantBalanced !== undefined && extraction.reconciliation.balanced !== wantBalanced) failed.add("balanced");

    if (entry.expectations?.total_item_rows !== undefined && extraction.lines.length !== entry.expectations.total_item_rows) {
        failed.add("line_count");
    }

    const blockers = boqWorkbookImportBlockers(extraction);
    if (entry.expectations?.expected_has_blockers !== undefined) {
        const hasBlockers = blockers.length > 0;
        if (hasBlockers !== entry.expectations.expected_has_blockers) failed.add("blockers");
    }

    if (entry.expectations?.selected_line_total_sum_cents !== undefined) {
        const cents = Math.round(extraction.lines.reduce((s, l) => s + l.line_total, 0) * 100);
        if (cents !== entry.expectations.selected_line_total_sum_cents) failed.add("line_total_sum_cents");
    }

    for (const lineExp of entry.expectations?.lines ?? []) {
        const line = extraction.lines.find(
            (l) =>
                l.source_sheet === lineExp.source_sheet &&
                l.source_row === lineExp.source_row &&
                (lineExp.client_ref === undefined || l.client_ref === lineExp.client_ref),
        );
        if (!line) {
            failed.add("line_ref");
            continue;
        }
        if (lineExp.client_ref !== undefined && line.client_ref !== lineExp.client_ref) failed.add("line_ref");
        if (lineExp.quantity !== undefined && !coerceNum(lineExp.quantity, line.quantity)) failed.add("line_qty");
        if (lineExp.unit !== undefined && line.unit !== lineExp.unit) failed.add("line_unit");
        if (lineExp.line_total !== undefined && line.line_total !== lineExp.line_total) failed.add("line_total");
    }

    const t = extraction.reconciliation.totals;
    return {
        workbook_id: entry.id,
        ok: failed.size === 0,
        codes_failed: [...failed],
        summary: {
            tab_count: extraction.reconciliation.sheetCount,
            source_rows_total: t.sourceRows,
            item_rows: t.itemRows,
            unresolved_rows: t.unresolvedRows,
            warning_rows: t.warningRows,
            uncached_formula_cells: t.uncachedFormulaCells,
            error_cells: t.errorCells,
            blocker_count: blockers.length,
        },
    };
}

export function runBoqLocalRegression(manifest: BoqLocalManifest): BoqWorkbookCheckResult[] {
    return manifest.workbooks.map(checkWorkbook);
}

export function assertBoqLocalRegression(results: BoqWorkbookCheckResult[]): void {
    const bad = results.filter((r) => !r.ok);
    if (bad.length) {
        const msg = bad.map((r) => `${r.workbook_id}:${r.codes_failed.join(",")}`).join("; ");
        throw new Error(`BoQ local regression failed: ${msg}`);
    }
}

export function synthManifestSheetRowsFromFixture(scenarioId: BoqWorkbookScenarioId): {
    tab_count: number;
    sheets: BoqLocalSheetExpectation[];
} {
    const fixture = getBoqWorkbookScenario(scenarioId);
    const buffer = encodeBoqWorkbookScenarioToXlsx(scenarioId);
    const wb = XLSX.read(buffer, { type: "array", ...BOQ_SHEETJS_READ_OPTIONS });
    const input = workbookInputFromSheetJS(`SYNTH-${scenarioId}.xlsx`, wb);
    return {
        tab_count: fixture.sheets.length,
        sheets: input.sheets.map((s) => {
            const digest = numericCellsDigestForSheet(s);
            return {
                name: s.name,
                source_rows: s.rows.length,
                nonempty_rows: countNonemptySourceRows(s),
                numeric_cell_count: digest.count,
                numeric_cells_sha256: digest.sha256,
            };
        }),
    };
}