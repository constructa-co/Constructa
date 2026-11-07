import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { computeProgrammePlan, formatDateRange, PROGRAMME_BASIS_NOTE } from "@/lib/programme-plan";
import { computeRelativeProgramme, programmeStageBar, RELATIVE_PROGRAMME_NOTE } from "@/lib/relative-programme";
import ProgrammeOverview from "./programme-overview";

describe("A060 continuous calendar presentation", () => {
    it.each([false, true])("distinguishes three working weeks from their calendar span without moving bars, dark=%s", isDark => {
        const plan = computeProgrammePlan("2026-10-19", [
            { name: "Strip out", manualDays: 5, startOffset: 0 },
            { name: "Install", manualDays: 5, startOffset: 7 },
            { name: "Finish", manualDays: 5, startOffset: 14 },
        ])!;
        const before = JSON.stringify(plan);
        const html = renderToStaticMarkup(<ProgrammeOverview plan={plan} isDark={isDark} />);
        expect(html).toContain("3 weeks");
        expect(html).toContain("Calendar span: 19 calendar days");
        expect(html).toContain("15 working days");
        expect(html).toContain('data-calendar-axis="true"');
        expect(html).toContain("Calendar time stays continuous across weeks.");
        expect(html).toContain("including any weekends within an activity; gaps can include weekends or unscheduled time.");
        expect(html).toContain(PROGRAMME_BASIS_NOTE);
        expect(html).toContain('aria-label="Programme activities"');
        expect(html.match(/data-overview-stage=/g)).toHaveLength(3);
        for (const [index, stage] of plan.stages.entries()) {
            const bar = programmeStageBar(plan, index, 0);
            expect(html).toContain(stage.name);
            expect(html).toContain(formatDateRange(stage.start_date, stage.end_date));
            expect(html).toContain(`inset-inline-start:${bar.leftPct}%;width:${bar.widthPct}%`);
        }
        expect(html).not.toContain("<button");
        expect(JSON.stringify(plan)).toBe(before);
    });

    it.each([false, true])("keeps a working Wednesday and its weekend-spanning activity unchanged, dark=%s", isDark => {
        const plan = computeProgrammePlan("2026-10-21", [{ name: "Fit out", manualDays: 5, startOffset: 0 }])!;
        const before = JSON.stringify(plan);
        const html = renderToStaticMarkup(<ProgrammeOverview plan={plan} isDark={isDark} />);
        expect(plan.start_date).toBe("2026-10-21");
        expect(plan.end_date).toBe("2026-10-27");
        expect(html).toContain("21 Oct to 27 Oct 2026");
        expect(html).toContain("Calendar span: 7 calendar days");
        expect(html).toContain("5 working days");
        expect(html).toContain("inset-inline-start:0%;width:100%");
        expect(JSON.stringify(plan)).toBe(before);
    });

    it("keeps single-day calendar and working-day wording singular", () => {
        const plan = computeProgrammePlan("2026-10-21", [{ name: "Inspect", manualDays: 1, startOffset: 0 }])!;
        const html = renderToStaticMarkup(<ProgrammeOverview plan={plan} isDark={false} />);
        expect(html).toContain("Calendar span: 1 calendar day");
        expect(html).toContain("1 working day.");
        expect(html).toContain("inset-inline-start:0%;width:100%");
        expect(html).not.toContain("data-short-activity-marker");
    });

    it("does not invent weekends or calendar spans for an undated working-day plan", () => {
        const plan = computeRelativeProgramme([
            { name: "Prepare", timeBasis: "relative_working_days", workingDayOffset: 0, manualDays: 3 },
            { name: "Install", timeBasis: "relative_working_days", workingDayOffset: 3, manualDays: 5 },
        ])!;
        const before = JSON.stringify(plan);
        const html = renderToStaticMarkup(<ProgrammeOverview plan={plan} isDark />);
        expect(html).toContain("Start date not agreed");
        expect(html).toContain("Day 1 to Day 3");
        expect(html).toContain("Day 4 to Day 8");
        expect(html).toContain(RELATIVE_PROGRAMME_NOTE);
        expect(html).toContain("inset-inline-start:37.5%;width:62.5%");
        expect(html).not.toContain("Calendar span:");
        expect(html).not.toContain("data-calendar-axis");
        expect(html).not.toContain("data-programme-calendar-span");
        expect(html).not.toContain("weekends");
        expect(JSON.stringify(plan)).toBe(before);
    });
});
