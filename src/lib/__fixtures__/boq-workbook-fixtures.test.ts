import { describe, expect, it } from "vitest";
import {
    BOQ_WORKBOOK_SCENARIO_IDS,
    BOQ_WORKBOOK_CLIENT_ROW_CAP,
    BOQ_WORKBOOK_SERVER_AI_ROW_CAP,
    encodeBoqWorkbookScenarioToXlsx,
    getBoqWorkbookScenario,
    listBoqWorkbookScenarios,
    readBoqWorkbookSheetSummaries,
} from "./boq-workbook";

describe("BOQ workbook synthetic fixtures", () => {
    it("exposes capture limits matching current production caps", () => {
        expect(BOQ_WORKBOOK_CLIENT_ROW_CAP).toBe(200);
        expect(BOQ_WORKBOOK_SERVER_AI_ROW_CAP).toBe(150);
    });

    it.each(BOQ_WORKBOOK_SCENARIO_IDS)("builds scenario %s with consistent metadata", (id) => {
        const fixture = getBoqWorkbookScenario(id);
        expect(fixture.id).toBe(id);
        expect(fixture.sheets.length).toBeGreaterThan(0);
        expect(fixture.summary.length).toBeGreaterThan(10);
        for (const sheet of fixture.sheets) {
            expect(sheet.name.startsWith("SYNTH")).toBe(true);
        }
    });

    it("multi-tab-over-200 exceeds client cap and includes boundary markers", () => {
        const f = getBoqWorkbookScenario("multi-tab-over-200");
        expect(f.totalDataRows).toBeGreaterThan(BOQ_WORKBOOK_CLIENT_ROW_CAP);
        expect(f.markers.some((m) => m.token === "MARKER-150")).toBe(true);
        expect(f.markers.some((m) => m.token === "MARKER-200")).toBe(true);
        expect(f.sheets).toHaveLength(3);
    });

    it("empty-middle-tab names the empty worksheet", () => {
        const f = getBoqWorkbookScenario("empty-middle-tab");
        expect(f.emptySheetNames).toEqual(["SYNTH-Empty-Tab"]);
        expect(f.sheets[1].rows).toHaveLength(0);
    });

    it("reconciliation-mismatch fixture records stated vs computed totals", () => {
        const f = getBoqWorkbookScenario("reconciliation-mismatch");
        expect(f.mismatches).toHaveLength(1);
        expect(f.mismatches[0]).toMatchObject({ statedTotal: 999, computedTotal: 120 });
    });

    it("round-trips XLSX for every scenario with sheet counts preserved", () => {
        for (const fixture of listBoqWorkbookScenarios()) {
            if (fixture.id === "csv-single-tab-baseline") continue;
            const buf = encodeBoqWorkbookScenarioToXlsx(fixture.id);
            const summaries = readBoqWorkbookSheetSummaries(buf);
            expect(summaries).toHaveLength(fixture.sheets.length);
            const empty = fixture.emptySheetNames;
            for (const sheet of fixture.sheets) {
                const summary = summaries.find((s) => s.name === sheet.name.slice(0, 31));
                expect(summary, `sheet ${sheet.name}`).toBeDefined();
                if (empty.includes(sheet.name)) {
                    expect(summary!.rowCount).toBeLessThanOrEqual(1);
                } else {
                    expect(summary!.rowCount).toBeGreaterThanOrEqual(sheet.rows.length);
                }
            }
        }
    });
});