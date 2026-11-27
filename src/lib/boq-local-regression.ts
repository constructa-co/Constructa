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
    type BoQWorkbookExtraction,
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
    nonempty_rows?: number;
    row_coverage_balanced?: boolean;
    selected?: boolean;
    expected_item_rows?: number;
    hidden?: boolean;
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
    /** Required for `file` sources; optional for `fixture` when pinning encoded bytes. */
    sha256?: string;
    tab_count: number;
    include_sheets?: string[];
    sheets: BoqLocalSheetExpectation[];
    expectations?: {
        reconciliation_balanced?: boolean;
        total_item_rows?: number;
        lines?: BoqLocalLineExpectation[];
        blocker_reason_categories?: string[];
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
    | "source_rows"
    | "used_range"
    | "balanced"
    | "ledger_unique"
    | "item_rows"
    | "line_count"
    | "line_ref"
    | "line_qty"
    | "line_unit"
    | "line_total"
    | "blockers";

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

export function sha256Buffer(data: ArrayBuffer | Buffer): string {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    return createHash("sha256").update(buf).digest("hex");
}

export function loadBoqLocalManifest(path: string): BoqLocalManifest {
    const raw = JSON.parse(readFileSync(path, "utf8")) as BoqLocalManifest;
    if (raw.schema_version !== 1) throw new Error(`Unsupported manifest schema_version: ${(raw as BoqLocalManifest).schema_version}`);
    if (!Array.isArray(raw.workbooks) || !raw.workbooks.length) throw new Error("Manifest has no workbooks");
    return raw;
}

function resolveWorkbookBytes(
    entry: BoqLocalWorkbookEntry,
): { bytes: Buffer; filename: string; mtime_unchanged: boolean | null } {
    if (entry.source.kind === "fixture") {
        const buf = Buffer.from(encodeBoqWorkbookScenarioToXlsx(entry.source.scenario_id));
        return { bytes: buf, filename: `SYNTH-${entry.source.scenario_id}.xlsx`, mtime_unchanged: null };
    }
    const path = entry.source.path;
    const statBefore = statSync(path);
    const bytes = readFileSync(path);
    const statAfter = statSync(path);
    const mtime_unchanged = statBefore.mtimeMs === statAfter.mtimeMs;
    const name = path.split(/[/\\]/).pop() ?? "workbook.xlsx";
    return { bytes, filename: name, mtime_unchanged };
}

function coerceNum(a: number | null | undefined, b: number | null | undefined): boolean {
    if (a === undefined) return true;
    return (a ?? null) === (b ?? null);
}

function checkWorkbook(entry: BoqLocalWorkbookEntry): BoqWorkbookCheckResult {
    const failed = new Set<BoqCheckCode>();
    const { bytes, filename, mtime_unchanged } = resolveWorkbookBytes(entry);

    if (entry.source.kind === "file") {
        if (!entry.sha256) failed.add("sha256");
        else if (sha256Buffer(bytes) !== entry.sha256.toLowerCase()) failed.add("sha256");
        if (mtime_unchanged === false) failed.add("mtime");
    } else if (entry.sha256 && sha256Buffer(bytes) !== entry.sha256.toLowerCase()) {
        failed.add("sha256");
    }

    const workbook = XLSX.read(bytes, { type: "buffer", ...BOQ_SHEETJS_READ_OPTIONS });
    const input = workbookInputFromSheetJS(filename, workbook);
    const options = entry.include_sheets?.length ? { includeSheets: entry.include_sheets } : {};
    const extraction: BoQWorkbookExtraction = extractBoQWorkbook(input, options);

    const ledgerKeys = extraction.rows.map((r) => `${r.sheet}!${r.row}`);
    if (new Set(ledgerKeys).size !== ledgerKeys.length) failed.add("ledger_unique");

    if (extraction.reconciliation.sheetCount !== entry.tab_count) failed.add("tab_count");

    const byName = new Map(extraction.reconciliation.sheets.map((s) => [s.sheet, s]));
    for (const exp of entry.sheets) {
        const actual = byName.get(exp.name);
        if (!actual) {
            failed.add("source_rows");
            continue;
        }
        if (exp.source_rows !== undefined && actual.sourceRows !== exp.source_rows) failed.add("source_rows");
        if (exp.used_range !== undefined && actual.usedRange !== exp.used_range) failed.add("used_range");
        if (exp.row_coverage_balanced !== undefined && actual.balanced !== exp.row_coverage_balanced) failed.add("balanced");
        if (exp.selected !== undefined && actual.selected !== exp.selected) failed.add("source_rows");
        if (exp.expected_item_rows !== undefined && actual.itemRows !== exp.expected_item_rows) failed.add("item_rows");
        if (exp.hidden !== undefined && actual.hidden !== exp.hidden) failed.add("source_rows");
    }

    const wantBalanced = entry.expectations?.reconciliation_balanced;
    if (wantBalanced !== undefined && extraction.reconciliation.balanced !== wantBalanced) failed.add("balanced");

    if (entry.expectations?.total_item_rows !== undefined && extraction.lines.length !== entry.expectations.total_item_rows) {
        failed.add("line_count");
    }

    const blockers = boqWorkbookImportBlockers(extraction);
    if (entry.expectations?.blocker_reason_categories !== undefined) {
        const hasBlockers = blockers.length > 0;
        const want = entry.expectations.blocker_reason_categories.length > 0;
        if (hasBlockers !== want) failed.add("blockers");
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

/** Grid row count independent of the parser (fixture metadata). */
export function synthManifestSheetRowsFromFixture(scenarioId: BoqWorkbookScenarioId): {
    tab_count: number;
    sheets: BoqLocalSheetExpectation[];
} {
    const fixture = getBoqWorkbookScenario(scenarioId);
    return {
        tab_count: fixture.sheets.length,
        sheets: fixture.sheets.map((s) => ({
            name: s.name,
            source_rows: s.rows.length,
        })),
    };
}