import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { computeProgrammePlan, stageBar } from "@/lib/programme-plan";
import { computeRelativeProgramme, programmeStageBar } from "@/lib/relative-programme";
import ProgrammeOverview from "./programme-overview";

describe("proportional short activities in the simple overview", () => {
    it.each([false, true])("does not inflate a dated one-day activity to one percent, dark=%s", isDark => {
        const plan = computeProgrammePlan("2026-10-19", [{ name: "Long activity", manualDays: 1000, startOffset: 0 }, { name: "One-day inspection", manualDays: 1, startOffset: 7 }])!;
        const before = JSON.stringify(plan), html = renderToStaticMarkup(<ProgrammeOverview plan={plan} isDark={isDark} />);
        const bar = programmeStageBar(plan, 1, 0);
        expect(bar.widthPct).toBeLessThan(1); expect(bar.widthPct).toBeCloseTo(100 / plan.calendar_days, 2);
        expect(html).toContain(`inset-inline-start:${bar.leftPct}%;width:${bar.widthPct}%`);
        expect(html).toContain("data-short-activity-marker"); expect(html).toContain("marker does not show their length");
        expect(html).toContain("One-day inspection"); expect(html).toContain("1 working day");
        expect(JSON.stringify(plan)).toBe(before);
        expect(stageBar(plan, plan.stages[1]).widthPct).toBe(1);
    });
    it("uses the relative working-day axis without inventing dates or stretching the final day", () => {
        const plan = computeRelativeProgramme([
            { name: "Main work", timeBasis: "relative_working_days", workingDayOffset: 0, manualDays: 999 },
            { name: "Last day", timeBasis: "relative_working_days", workingDayOffset: 999, manualDays: 1 },
        ])!;
        expect(plan).not.toBeNull();
        expect(programmeStageBar(plan, 1, 0)).toEqual({ leftPct: 99.9, widthPct: 0.1 });
        const html = renderToStaticMarkup(<ProgrammeOverview plan={plan} isDark />);
        expect(html).toContain("Day 1000"); expect(html).toContain("width:0.1%"); expect(html).not.toContain("October");
        expect(programmeStageBar(plan, 0)).toEqual(programmeStageBar(plan, 0, 0));
    });
    it("retains ordinary one-day full-width programmes and does not add unnecessary markers", () => {
        const plan = computeProgrammePlan("2026-10-19", [{ name: "Door", manualDays: 1, startOffset: 0 }])!;
        const html = renderToStaticMarkup(<ProgrammeOverview plan={plan} isDark={false} />);
        expect(html).toContain("width:100%"); expect(html).not.toContain("data-short-activity-marker");
    });
});
