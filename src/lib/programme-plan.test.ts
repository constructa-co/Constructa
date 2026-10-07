import { describe, expect, it } from "vitest";
import {
    LEGACY_STARTER_PHASES,
    addWorkingDays,
    computeProgrammePlan,
    countWorkingDays,
    formatDateRange,
    formatPlanDate,
    formatWorkingDuration,
    isWorkingDay,
    nextWorkingDayAfter,
    parseIsoDate,
    programmePlanForProject,
    resolveProgrammeSource,
    stageBar,
} from "./programme-plan";

// 12 October 2026 is a Monday.
const MONDAY = "2026-10-12";

describe("working days", () => {
    it("counts Monday to Friday only", () => {
        expect(isWorkingDay(MONDAY)).toBe(true);
        expect(isWorkingDay("2026-10-16")).toBe(true);
        expect(isWorkingDay("2026-10-17")).toBe(false);
        expect(isWorkingDay("2026-10-18")).toBe(false);
        expect(isWorkingDay("not a date")).toBe(false);
    });

    it.each([
        [1, MONDAY, "the start day is day one"],
        [5, "2026-10-16", "one week ends on the Friday"],
        [6, "2026-10-19", "the sixth day is the next Monday"],
        [10, "2026-10-23", "two weeks end on the second Friday"],
        [15, "2026-10-30", "three weeks"],
        [260, "2027-10-08", "a year of working weeks"],
    ])("a start date and %i working days gives one end date", (days, end) => {
        expect(addWorkingDays(MONDAY, days)).toBe(end);
        // The same answer the other way round.
        expect(countWorkingDays(MONDAY, end)).toBe(days);
    });

    it("gives the same end date however the duration is expressed", () => {
        expect(addWorkingDays(MONDAY, 3 * 5)).toBe(addWorkingDays(MONDAY, 15));
    });

    it("starts a mid-week job on its own day and skips the weekend", () => {
        expect(addWorkingDays("2026-10-14", 5)).toBe("2026-10-20");
    });

    it("begins a weekend start on the following Monday", () => {
        expect(addWorkingDays("2026-10-17", 1)).toBe("2026-10-19");
    });

    it("crosses a month end, a year end and a leap day", () => {
        expect(addWorkingDays("2026-12-28", 5)).toBe("2027-01-01");
        expect(addWorkingDays("2028-02-28", 3)).toBe("2028-03-01");
    });

    it("rejects an invalid start or duration", () => {
        expect(addWorkingDays("2026-02-30", 5)).toBeNull();
        expect(addWorkingDays(MONDAY, 0)).toBeNull();
        expect(addWorkingDays(MONDAY, Number.NaN)).toBeNull();
        expect(parseIsoDate("2026-13-01")).toBeNull();
    });

    it("finds the next working day", () => {
        expect(nextWorkingDayAfter("2026-10-16")).toBe("2026-10-19");
        expect(nextWorkingDayAfter(MONDAY)).toBe("2026-10-13");
    });
});

describe("wording", () => {
    it("states whole weeks as weeks and anything else as working days", () => {
        expect(formatWorkingDuration(5)).toBe("1 week");
        expect(formatWorkingDuration(15)).toBe("3 weeks");
        expect(formatWorkingDuration(8)).toBe("8 working days");
        expect(formatWorkingDuration(1)).toBe("1 working day");
    });

    it("formats dates the same way regardless of the machine's time zone", () => {
        expect(formatPlanDate(MONDAY)).toBe("Monday 12 October 2026");
        expect(formatPlanDate(MONDAY, "short")).toBe("12 Oct 2026");
        expect(formatPlanDate(null)).toBe("");
        expect(formatDateRange(MONDAY, "2026-10-23")).toBe("12 Oct to 23 Oct 2026");
        expect(formatDateRange("2026-12-28", "2027-01-01")).toBe("28 Dec 2026 to 1 Jan 2027");
        expect(formatDateRange(MONDAY, MONDAY)).toBe("12 Oct 2026");
    });
});

describe("computeProgrammePlan", () => {
    it("turns a start date and one duration into a start, a finish and a length", () => {
        const plan = computeProgrammePlan(MONDAY, [{ name: "Works on site", calculatedDays: 15, manualDays: 15, startOffset: 0 }]);
        expect(plan).toMatchObject({
            start_date: MONDAY,
            end_date: "2026-10-30",
            working_days: 15,
            calendar_days: 19,
            duration_label: "3 weeks",
        });
        expect(plan?.stages).toHaveLength(1);
    });

    it("prefers the contractor's own duration to the calculated one", () => {
        const plan = computeProgrammePlan(MONDAY, [{ name: "Build", calculatedDays: 20, manualDays: 5, startOffset: 0 }]);
        expect(plan?.end_date).toBe("2026-10-16");
    });

    it("places stages by their offset and measures the whole span, gaps and overlaps included", () => {
        const plan = computeProgrammePlan(MONDAY, [
            { name: "A", calculatedDays: 5, startOffset: 0 },
            { name: "B", calculatedDays: 10, startOffset: 2 },
            { name: "C", calculatedDays: 5, startOffset: 28 },
        ]);
        expect(plan?.stages.map((stage) => [stage.start_date, stage.end_date])).toEqual([
            [MONDAY, "2026-10-16"],
            ["2026-10-14", "2026-10-27"],
            ["2026-11-09", "2026-11-13"],
        ]);
        expect(plan?.start_date).toBe(MONDAY);
        expect(plan?.end_date).toBe("2026-11-13");
        expect(plan?.working_days).toBe(25);
    });

    it("reads the earlier proposal timeline as calendar days from each phase's own start", () => {
        const plan = computeProgrammePlan(null, [
            { name: "Groundworks", start_date: "2026-11-02", duration_days: 14, duration_unit: "Weeks" },
            { name: "Structure", start_date: "2026-11-16", duration_days: 21, duration_unit: "Weeks" },
        ]);
        expect(plan).toMatchObject({ start_date: "2026-11-02", end_date: "2026-12-06", calendar_days: 35 });
    });

    it("leaves out a phase it cannot date rather than guessing", () => {
        expect(computeProgrammePlan(null, [{ name: "Build", calculatedDays: 5, startOffset: 0 }])).toBeNull();
        expect(computeProgrammePlan(MONDAY, [{ name: "Build", calculatedDays: 0 }])).toBeNull();
        expect(computeProgrammePlan(MONDAY, [])).toBeNull();
        expect(computeProgrammePlan(MONDAY, null)).toBeNull();
        expect(computeProgrammePlan(MONDAY, ["nonsense", null, 4])).toBeNull();
        const plan = computeProgrammePlan(MONDAY, [{ name: "Undated", calculatedDays: 0 }, { name: "Build", calculatedDays: 5, startOffset: 0 }]);
        expect(plan?.stages.map((stage) => stage.name)).toEqual(["Build"]);
    });

    it("positions each bar inside the timeline", () => {
        const plan = computeProgrammePlan(MONDAY, [
            { name: "A", calculatedDays: 5, startOffset: 0 },
            { name: "B", calculatedDays: 5, startOffset: 7 },
        ])!;
        const bars = plan.stages.map((stage) => stageBar(plan, stage));
        expect(bars[0].leftPct).toBe(0);
        bars.forEach((bar) => {
            expect(bar.leftPct).toBeGreaterThanOrEqual(0);
            expect(bar.leftPct + bar.widthPct).toBeLessThanOrEqual(100.01);
        });
        expect(bars[1].leftPct).toBeCloseTo((7 / 12) * 100, 1);
    });
});

describe("resolveProgrammeSource", () => {
    const starter = LEGACY_STARTER_PHASES.map((phase) => ({ ...phase, start_date: "2026-11-02" }));

    it("uses the Programme tab when it has anything saved", () => {
        const source = resolveProgrammeSource({
            start_date: MONDAY,
            programme_phases: [{ name: "Build", calculatedDays: 5, startOffset: 0 }],
            gantt_phases: [{ name: "Old", start_date: "2026-01-05", duration_days: 7 }],
        });
        expect(source.origin).toBe("programme");
    });

    it("falls back to a timeline the contractor edited in the earlier editor", () => {
        const edited = starter.map((phase, index) => (index === 0 ? { ...phase, duration_days: 7 } : phase));
        expect(resolveProgrammeSource({ start_date: "2026-11-02", programme_phases: [], gantt_phases: edited }).origin).toBe("legacy_timeline");
        expect(programmePlanForProject({ start_date: "2026-11-02", programme_phases: [], gantt_phases: edited })).not.toBeNull();
    });

    it("never treats the untouched starter template as a programme", () => {
        expect(resolveProgrammeSource({ start_date: "2026-11-02", programme_phases: null, gantt_phases: starter }).origin).toBe("none");
        expect(programmePlanForProject({ start_date: "2026-11-02", gantt_phases: starter })).toBeNull();
        expect(resolveProgrammeSource({}).origin).toBe("none");
    });
});
