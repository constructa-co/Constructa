import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { BoQCellInput } from "./boq-workbook";
import { extractBoQWorkbook } from "./boq-workbook";
import {
    assertBoqLocalRegression,
    loadBoqLocalManifest,
    numericCellsDigestForSheet,
    runBoqLocalRegression,
    sha256Buffer,
    synthManifestSheetRowsFromFixture,
    type BoqLocalManifest,
} from "./boq-local-regression";
import { encodeBoqWorkbookScenarioToXlsx } from "./__fixtures__/boq-workbook";

const SYNTH_EXAMPLE = path.join(import.meta.dirname, "__fixtures__/boq-local-manifest.synth.example.json");

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
});