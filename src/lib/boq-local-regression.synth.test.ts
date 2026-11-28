import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { BoQCellInput } from "./boq-workbook";
import { extractBoQWorkbook } from "./boq-workbook";
import {
    assertBoqLocalRegression,
    fileManifestExpectationGaps,
    loadBoqLocalManifest,
    numericCellsDigestForSheet,
    runBoqLocalRegression,
    sha256Buffer,
    synthManifestSheetRowsFromFixture,
    type BoqLocalManifest,
} from "./boq-local-regression";
import { encodeBoqWorkbookScenarioToXlsx } from "./__fixtures__/boq-workbook";

const SYNTH_EXAMPLE = path.join(import.meta.dirname, "__fixtures__/boq-local-manifest.synth.example.json");

/** Pinned by `numericCellsDigestForSheet` contract (firstRow 4, firstCol 1, values 9.5 and 3). */
export const KNOWN_NUMERIC_DIGEST_SHA256 =
    "e772431dc274fe5a37ff43cd5efc809605a64c272879d0697dc6ecd6f5553cf0";

function sheet(rows: BoQCellInput[][]) {
    return extractBoQWorkbook({
        filename: "SYNTH-edge.xlsx",
        sheets: [{ name: "SYNTH-Edge", rows: [["Ref", "Description", "Qty", "Unit", "Rate", "Total"], ...rows] }],
    });
}

describe("D122 — BOQ local regression SYNTH controls (CI)", () => {
    it("loads the committed SYNTH example manifest and passes all checks", () => {
        const manifest = loadBoqLocalManifest(SYNTH_EXAMPLE) as BoqLocalManifest;
        const results = runBoqLocalRegression(manifest);
        expect(results.every((r) => r.ok)).toBe(true);
        expect(results.map((r) => r.codes_failed).flat()).toEqual([]);
        assertBoqLocalRegression(results);
    });

    it("pins fixture grid row counts independently of parser totals", () => {
        const baseline = synthManifestSheetRowsFromFixture("csv-single-tab-baseline");
        expect(baseline.tab_count).toBe(1);
        expect(baseline.sheets[0].source_rows).toBe(9);
    });

    it("example JSON matches fixture-derived tab names and row counts", () => {
        const manifest = JSON.parse(readFileSync(SYNTH_EXAMPLE, "utf8")) as BoqLocalManifest;
        for (const wb of manifest.workbooks) {
            if (wb.source.kind !== "fixture") continue;
            const grid = synthManifestSheetRowsFromFixture(wb.source.scenario_id);
            expect(wb.tab_count).toBe(grid.tab_count);
            expect(wb.sheets.map((s) => s.name)).toEqual(grid.sheets.map((s) => s.name));
            expect(wb.sheets.map((s) => s.source_rows)).toEqual(grid.sheets.map((s) => s.source_rows));
            expect(wb.sheets.map((s) => s.nonempty_rows)).toEqual(grid.sheets.map((s) => s.nonempty_rows));
            expect(wb.sheets.map((s) => s.numeric_cell_count)).toEqual(grid.sheets.map((s) => s.numeric_cell_count));
            expect(wb.sheets.map((s) => s.numeric_cells_sha256)).toEqual(grid.sheets.map((s) => s.numeric_cells_sha256));
        }
    });

    it("numeric digest contract: abs 1-based row/col, BE double hex, sorted, no trailing newline", () => {
        const sheet = {
            name: "SYNTH-Numeric",
            firstRow: 4,
            firstCol: 1,
            rows: [[9.5, 3]],
        };
        const a = numericCellsDigestForSheet(sheet);
        const b = numericCellsDigestForSheet(sheet);
        expect(a.sha256).toBe(b.sha256);
        expect(a.count).toBe(2);
        expect(a.sha256).toBe(KNOWN_NUMERIC_DIGEST_SHA256);
    });

    it("fixture bytes get sha256; mismatch scenario passes SYNTH manifest checks", () => {
        const buf = encodeBoqWorkbookScenarioToXlsx("reconciliation-mismatch");
        expect(sha256Buffer(buf)).toHaveLength(64);
        const manifest = loadBoqLocalManifest(SYNTH_EXAMPLE) as BoqLocalManifest;
        const mismatchOnly: BoqLocalManifest = {
            schema_version: 1,
            workbooks: manifest.workbooks.filter((w) => w.id === "synth-reconciliation-mismatch"),
        };
        const [result] = runBoqLocalRegression(mismatchOnly);
        expect(result.ok).toBe(true);
        expect(result.summary.item_rows).toBe(1);
    });

    it("edge controls: whitespace row, cached empty formula, uncached formula, error cell", () => {
        const ex = sheet([
            ["A", "  SYNTH padded description  ", 1, "nr", 5, 5],
            ["B", "Blank qty cache", { v: "", formula: true }, "m2", 5, 50],
            ["C", "Uncached qty", { v: null, formula: true }, "nr", 1, 1],
            ["D", "Error rate", 1, "nr", { v: null, w: "#REF!", formula: true, error: true }, 10],
        ]);
        expect(ex.lines.find((l) => l.client_ref === "A")?.description).toBe("SYNTH padded description");
        expect(ex.lines.find((l) => l.client_ref === "B")?.parse_warnings).toBeUndefined();
        expect(ex.lines.find((l) => l.client_ref === "C")?.parse_warnings).toContain("quantity");
        expect(ex.lines.find((l) => l.client_ref === "D")?.parse_warnings).toContain("unit_rate");
        expect(ex.reconciliation.totals.uncachedFormulaCells).toBeGreaterThan(0);
        expect(ex.reconciliation.totals.errorCells).toBe(1);
        expect(ex.reconciliation.balanced).toBe(true);
    });

    it("negative: omitted tab, wrong nonempty_rows, and wrong expected_has_blockers fail", () => {
        const grid = synthManifestSheetRowsFromFixture("multi-tab-over-200");
        const [rOmmit] = runBoqLocalRegression({
            schema_version: 1,
            workbooks: [
                {
                    id: "synth-omit-tab",
                    source: { kind: "fixture", scenario_id: "multi-tab-over-200" },
                    tab_count: 3,
                    sheets: grid.sheets.slice(0, 2),
                },
            ],
        });
        expect(rOmmit.ok).toBe(false);
        expect(rOmmit.codes_failed).toContain("tab_coverage");

        const [rNonempty] = runBoqLocalRegression({
            schema_version: 1,
            workbooks: [
                {
                    id: "synth-wrong-nonempty",
                    source: { kind: "fixture", scenario_id: "csv-single-tab-baseline" },
                    tab_count: 1,
                    sheets: [{ name: "SYNTH-Tab-6", source_rows: 9, nonempty_rows: 1 }],
                },
            ],
        });
        expect(rNonempty.ok).toBe(false);
        expect(rNonempty.codes_failed).toContain("nonempty_rows");

        const [rBlocker] = runBoqLocalRegression({
            schema_version: 1,
            workbooks: [
                {
                    id: "synth-wrong-blockers",
                    source: { kind: "fixture", scenario_id: "csv-single-tab-baseline" },
                    tab_count: 1,
                    sheets: [{ name: "SYNTH-Tab-6", source_rows: 9 }],
                    expectations: { expected_has_blockers: true },
                },
            ],
        });
        expect(rBlocker.ok).toBe(false);
        expect(rBlocker.codes_failed).toContain("blockers");
    });

    it("negative: FILE tab with invalid digest or negative count fails expectation_missing", () => {
        const entry = {
            id: "bad-file-shape",
            source: { kind: "file" as const, path: "/private/does-not-matter.xlsx" },
            sha256: "00".repeat(32),
            tab_count: 1,
            sheets: [
                {
                    name: "Tab1",
                    source_rows: 1,
                    nonempty_rows: 1,
                    numeric_cell_count: -1,
                    numeric_cells_sha256: "not-hex",
                },
            ],
        };
        expect(fileManifestExpectationGaps(entry)).toBe(true);
        const [result] = runBoqLocalRegression({ schema_version: 1, workbooks: [entry] });
        expect(result.codes_failed).toContain("expectation_missing");
    });

    it("negative: thin FILE manifest (name-only tab) fails expectation_missing before IO", () => {
        const entry = {
            id: "thin-file",
            source: { kind: "file" as const, path: "/private/does-not-matter.xlsx" },
            sha256: "00".repeat(32),
            tab_count: 1,
            sheets: [{ name: "Some-Tab" }],
        };
        expect(fileManifestExpectationGaps(entry)).toBe(true);
        const [result] = runBoqLocalRegression({ schema_version: 1, workbooks: [entry] });
        expect(result.ok).toBe(false);
        expect(result.codes_failed).toContain("expectation_missing");
    });

    it("negative: wrong numeric_cells_sha256 and numeric_cell_count fail dedicated codes", () => {
        const grid = synthManifestSheetRowsFromFixture("csv-single-tab-baseline");
        const sh = { ...grid.sheets[0], numeric_cells_sha256: "f".repeat(64), numeric_cell_count: 99 };
        const [r] = runBoqLocalRegression({
            schema_version: 1,
            workbooks: [
                {
                    id: "wrong-digest",
                    source: { kind: "fixture", scenario_id: "csv-single-tab-baseline" },
                    tab_count: 1,
                    sheets: [sh],
                },
            ],
        });
        expect(r.ok).toBe(false);
        expect(r.codes_failed).toContain("numeric_digest");
        expect(r.codes_failed).toContain("numeric_count");
    });

    it("negative: wrong selected_line_total_sum_cents fails line_total_sum_cents", () => {
        const grid = synthManifestSheetRowsFromFixture("csv-single-tab-baseline");
        const [r] = runBoqLocalRegression({
            schema_version: 1,
            workbooks: [
                {
                    id: "wrong-sum",
                    source: { kind: "fixture", scenario_id: "csv-single-tab-baseline" },
                    tab_count: 1,
                    sheets: grid.sheets,
                    expectations: { selected_line_total_sum_cents: 1 },
                },
            ],
        });
        expect(r.ok).toBe(false);
        expect(r.codes_failed).toContain("line_total_sum_cents");
    });

    it("negative: loadBoqLocalManifest throws when path is missing on disk", () => {
        expect(() => loadBoqLocalManifest(path.join(import.meta.dirname, "no-such-manifest.json"))).toThrow(/not found/i);
    });
});