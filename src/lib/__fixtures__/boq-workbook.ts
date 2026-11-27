import * as XLSX from "xlsx";

/** Matches current client cap in `boq-import.tsx` (documentation for tests). */
export const BOQ_WORKBOOK_CLIENT_ROW_CAP = 200;

/** Matches current server slice in `parseBoQFromExcelDataAction` (documentation for tests). */
export const BOQ_WORKBOOK_SERVER_AI_ROW_CAP = 150;

export const BOQ_WORKBOOK_SCENARIO_IDS = [
    "multi-tab-over-200",
    "empty-middle-tab",
    "merged-repeated-headers",
    "reconciliation-mismatch",
    "csv-single-tab-baseline",
] as const;

export type BoqWorkbookScenarioId = (typeof BOQ_WORKBOOK_SCENARIO_IDS)[number];

export type BoqWorkbookColumn =
    | "ref"
    | "section"
    | "description"
    | "quantity"
    | "unit"
    | "rate"
    | "total";

export const BOQ_WORKBOOK_HEADER_LABELS: Record<BoqWorkbookColumn, string> = {
    ref: "Ref",
    section: "Section",
    description: "Description",
    quantity: "Qty",
    unit: "Unit",
    rate: "Rate",
    total: "Total",
};

/** One worksheet as a row-major string grid (row 0 = headers unless noted in scenario). */
export type BoqWorkbookSheet = {
    name: string;
    rows: string[][];
    /** Optional SheetJS merge ranges for XLSX encoding only. */
    merges?: XLSX.Range[];
};

export type BoqWorkbookExpectedMarker = {
    /** 1-based data row index on named sheet (including header as row 1 when header row present). */
    sheet: string;
    row1Based: number;
    token: string;
};

export type BoqWorkbookExpectedMismatch = {
    sheet: string;
    ref: string;
    statedTotal: number;
    computedTotal: number;
};

export type BoqWorkbookFixture = {
    id: BoqWorkbookScenarioId;
    summary: string;
    sheets: BoqWorkbookSheet[];
    /** Total data rows across all non-empty sheets (excludes header-only rows). */
    totalDataRows: number;
    markers: BoqWorkbookExpectedMarker[];
    mismatches: BoqWorkbookExpectedMismatch[];
    emptySheetNames: string[];
    csvText?: string;
};

const SYNTH_PREFIX = "SYNTH-BQ";

export function synthRef(tabIndex: number, rowIndex: number): string {
    return `${SYNTH_PREFIX}-${tabIndex}.${rowIndex}`;
}

export function markerDescription(token: "MARKER-150" | "MARKER-200"): string {
    return `${SYNTH_PREFIX}-${token} boundary row for intake tests`;
}

export function headerRow(): string[] {
    return [
        BOQ_WORKBOOK_HEADER_LABELS.ref,
        BOQ_WORKBOOK_HEADER_LABELS.section,
        BOQ_WORKBOOK_HEADER_LABELS.description,
        BOQ_WORKBOOK_HEADER_LABELS.quantity,
        BOQ_WORKBOOK_HEADER_LABELS.unit,
        BOQ_WORKBOOK_HEADER_LABELS.rate,
        BOQ_WORKBOOK_HEADER_LABELS.total,
    ];
}

export function dataRow(args: {
    ref: string;
    section: string;
    description: string;
    quantity: string;
    unit: string;
    rate: string;
    total: string;
}): string[] {
    return [args.ref, args.section, args.description, args.quantity, args.unit, args.rate, args.total];
}

function countDataRows(sheets: BoqWorkbookSheet[]): number {
    let n = 0;
    for (const sheet of sheets) {
        if (!sheet.rows.length) continue;
        const start = looksLikeHeader(sheet.rows[0]) ? 1 : 0;
        for (let i = start; i < sheet.rows.length; i++) {
            const row = sheet.rows[i];
            if (row.some((c) => String(c ?? "").trim())) n++;
        }
    }
    return n;
}

function looksLikeHeader(row: string[]): boolean {
    const joined = row.map((c) => String(c ?? "").trim().toLowerCase()).join("|");
    return joined.includes("description") && joined.includes("qty");
}

/** Build primary tab with `dataRowCount` synthetic priced lines plus optional boundary markers. */
export function buildSyntheticPrimaryTab(
    tabIndex: number,
    dataRowCount: number,
    options?: { insertMarkersAt?: { row150?: boolean; row200?: boolean } },
): BoqWorkbookSheet {
    const rows: string[][] = [headerRow()];
    const section = `SYNTH Section ${tabIndex}`;

    for (let i = 1; i <= dataRowCount; i++) {
        if (options?.insertMarkersAt?.row150 && i === 150) {
            rows.push(
                dataRow({
                    ref: synthRef(tabIndex, i),
                    section,
                    description: markerDescription("MARKER-150"),
                    quantity: "10",
                    unit: "nr",
                    rate: "5",
                    total: "50",
                }),
            );
            continue;
        }
        if (options?.insertMarkersAt?.row200 && i === 200) {
            rows.push(
                dataRow({
                    ref: synthRef(tabIndex, i),
                    section,
                    description: markerDescription("MARKER-200"),
                    quantity: "4",
                    unit: "m",
                    rate: "25",
                    total: "100",
                }),
            );
            continue;
        }
        const qty = String((i % 12) + 1);
        const rate = String(10 + (i % 7));
        const q = Number(qty);
        const r = Number(rate);
        rows.push(
            dataRow({
                ref: synthRef(tabIndex, i),
                section,
                description: `${SYNTH_PREFIX} line ${i} generic allowance`,
                quantity: qty,
                unit: i % 3 === 0 ? "m2" : "nr",
                rate,
                total: String(q * r),
            }),
        );
    }

    return {
        name: `SYNTH-Tab-${tabIndex}`,
        rows,
    };
}

function extractMarkers(sheet: BoqWorkbookSheet): BoqWorkbookExpectedMarker[] {
    const markers: BoqWorkbookExpectedMarker[] = [];
    sheet.rows.forEach((row, idx) => {
        const desc = row[2] ?? "";
        if (desc.includes("MARKER-150")) {
            markers.push({ sheet: sheet.name, row1Based: idx + 1, token: "MARKER-150" });
        }
        if (desc.includes("MARKER-200")) {
            markers.push({ sheet: sheet.name, row1Based: idx + 1, token: "MARKER-200" });
        }
    });
    return markers;
}

function buildMultiTabOver200(): BoqWorkbookFixture {
    const tab1 = buildSyntheticPrimaryTab(1, 215, {
        insertMarkersAt: { row150: true, row200: true },
    });
    const tab2 = buildSyntheticPrimaryTab(2, 24);
    const tab3 = buildSyntheticPrimaryTab(3, 12);
    const sheets = [tab1, tab2, tab3];
    return {
        id: "multi-tab-over-200",
        summary: "Three tabs; tab 1 has 215 data rows with markers at rows 150 and 200.",
        sheets,
        totalDataRows: countDataRows(sheets),
        markers: [
            ...extractMarkers(tab1),
            ...extractMarkers(tab2),
            ...extractMarkers(tab3),
        ],
        mismatches: [],
        emptySheetNames: [],
    };
}

function buildEmptyMiddleTab(): BoqWorkbookFixture {
    const tab1 = buildSyntheticPrimaryTab(1, 18);
    const empty: BoqWorkbookSheet = { name: "SYNTH-Empty-Tab", rows: [] };
    const tab3 = buildSyntheticPrimaryTab(3, 9);
    const sheets = [tab1, empty, tab3];
    return {
        id: "empty-middle-tab",
        summary: "Workbook with a deliberately empty middle worksheet.",
        sheets,
        totalDataRows: countDataRows(sheets),
        markers: [],
        mismatches: [],
        emptySheetNames: [empty.name],
    };
}

function buildMergedRepeatedHeaders(): BoqWorkbookFixture {
    const titleRow = ["SYNTH BOQ — fixture workbook", "", "", "", "", "", ""];
    const header = headerRow();
    const repeatedHeader = header.map((h) => h.toUpperCase());
    const lines = [
        dataRow({
            ref: synthRef(4, 1),
            section: "SYNTH Preliminaries",
            description: `${SYNTH_PREFIX} site setup`,
            quantity: "1",
            unit: "item",
            rate: "1200",
            total: "1200",
        }),
        dataRow({
            ref: synthRef(4, 2),
            section: "SYNTH Preliminaries",
            description: `${SYNTH_PREFIX} welfare unit`,
            quantity: "8",
            unit: "wk",
            rate: "95",
            total: "760",
        }),
    ];
    const rows = [titleRow, header, ...lines, repeatedHeader, ...lines];
    const sheet: BoqWorkbookSheet = {
        name: "SYNTH-Merged-Headers",
        rows,
        merges: [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }],
    };
    return {
        id: "merged-repeated-headers",
        summary: "Title merge, standard header, duplicate header band mid-sheet.",
        sheets: [sheet],
        totalDataRows: countDataRows([sheet]),
        markers: [],
        mismatches: [],
        emptySheetNames: [],
    };
}

function buildReconciliationMismatch(): BoqWorkbookFixture {
    const stated = 999;
    const computed = 120;
    const row = dataRow({
        ref: synthRef(5, 1),
        section: "SYNTH Groundworks",
        description: `${SYNTH_PREFIX} paving repair allowance`,
        quantity: "10",
        unit: "m2",
        rate: "12",
        total: String(stated),
    });
    const sheet: BoqWorkbookSheet = {
        name: "SYNTH-Mismatch",
        rows: [headerRow(), row],
    };
    return {
        id: "reconciliation-mismatch",
        summary: "Single line where stated total disagrees with qty × rate (10 × 12 = 120).",
        sheets: [sheet],
        totalDataRows: 1,
        markers: [],
        mismatches: [
            {
                sheet: sheet.name,
                ref: synthRef(5, 1),
                statedTotal: stated,
                computedTotal: computed,
            },
        ],
        emptySheetNames: [],
    };
}

function buildCsvBaseline(): BoqWorkbookFixture {
    const sheet = buildSyntheticPrimaryTab(6, 8);
    const csvText = sheetRowsToCsv(sheet.rows);
    return {
        id: "csv-single-tab-baseline",
        summary: "CSV bytes for the same header shape as XLSX tabs (deterministic path).",
        sheets: [sheet],
        totalDataRows: countDataRows([sheet]),
        markers: [],
        mismatches: [],
        emptySheetNames: [],
        csvText,
    };
}

const FIXTURE_BUILDERS: Record<BoqWorkbookScenarioId, () => BoqWorkbookFixture> = {
    "multi-tab-over-200": buildMultiTabOver200,
    "empty-middle-tab": buildEmptyMiddleTab,
    "merged-repeated-headers": buildMergedRepeatedHeaders,
    "reconciliation-mismatch": buildReconciliationMismatch,
    "csv-single-tab-baseline": buildCsvBaseline,
};

export function getBoqWorkbookScenario(id: BoqWorkbookScenarioId): BoqWorkbookFixture {
    const build = FIXTURE_BUILDERS[id];
    if (!build) throw new Error(`Unknown BOQ workbook scenario: ${id}`);
    return build();
}

export function listBoqWorkbookScenarios(): BoqWorkbookFixture[] {
    return BOQ_WORKBOOK_SCENARIO_IDS.map((id) => getBoqWorkbookScenario(id));
}

/** Encode sheets to an in-memory XLSX workbook (for Vitest file inputs). */
export function encodeBoqWorkbookToXlsx(sheets: BoqWorkbookSheet[]): ArrayBuffer {
    const wb = XLSX.utils.book_new();
    for (const sheet of sheets) {
        const ws = XLSX.utils.aoa_to_sheet(sheet.rows.length ? sheet.rows : [[""]]);
        if (sheet.merges?.length) ws["!merges"] = sheet.merges;
        XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
    }
    const out = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    return out;
}

export function encodeBoqWorkbookScenarioToXlsx(id: BoqWorkbookScenarioId): ArrayBuffer {
    const fixture = getBoqWorkbookScenario(id);
    return encodeBoqWorkbookToXlsx(fixture.sheets);
}

/** Simple RFC-style CSV from row grid (first row = headers). */
export function sheetRowsToCsv(rows: string[][]): string {
    return rows
        .map((row) =>
            row
                .map((cell) => {
                    const s = String(cell ?? "");
                    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
                    return s;
                })
                .join(","),
        )
        .join("\n");
}

/** Read back sheet names and row counts from XLSX bytes (fixture smoke). */
export function readBoqWorkbookSheetSummaries(buffer: ArrayBuffer): { name: string; rowCount: number }[] {
    const wb = XLSX.read(buffer, { type: "array" });
    return wb.SheetNames.map((name) => {
        const ws = wb.Sheets[name];
        const ref = ws["!ref"];
        if (!ref) return { name, rowCount: 0 };
        const range = XLSX.utils.decode_range(ref);
        return { name, rowCount: range.e.r - range.s.r + 1 };
    });
}