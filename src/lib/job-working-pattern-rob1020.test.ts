import { beforeEach, describe, expect, it } from "vitest";
import {
    addJobWorkingDays, clearJobWorkingPatternCachesForTests, DEFAULT_JOB_WORKING_PATTERN,
    jobWorkloadStartIso,
} from "./job-working-pattern";
import { clearLocalTimeCachesForTests } from "./job-working-local";
import { computeDisplayProgramme } from "./relative-programme";
import { computeProgrammePlan } from "./programme-plan";
import { buildProgrammePhases } from "./simple-programme";

const monFriNightShift = {
    version: 2 as const,
    timezone: "Europe/London",
    weekdays: [1, 2, 3, 4, 5, 6],
    intervals: [1, 2, 3, 4, 5].map(weekday => ({ weekday, startMinute: 22 * 60, endMinute: 6 * 60 })),
    standardMinutesPerDay: 480,
    productivityPct: 100,
};

function monFriShift(startHour: number, endHour: number, standardMinutesPerDay: number) {
    return {
        version: 2 as const,
        timezone: "Europe/London",
        weekdays: [1, 2, 3, 4, 5],
        intervals: [1, 2, 3, 4, 5].map(weekday => ({ weekday, startMinute: startHour * 60, endMinute: endHour * 60 })),
        standardMinutesPerDay,
        productivityPct: 100,
    };
}

describe("ROB1020 actual phase dates and plan workload span", () => {
    beforeEach(() => {
        clearLocalTimeCachesForTests();
        clearJobWorkingPatternCachesForTests();
    });

    it("five Mon–Fri night programme days end Sat 2026-10-24; phase starts on programme origin", () => {
        const start = "2026-10-19";
        const pattern = monFriNightShift;
        expect(addJobWorkingDays(start, 5, pattern)).toBe("2026-10-24");
        expect(jobWorkloadStartIso(start, 0, pattern)).toBe("2026-10-19");
        const built = buildProgrammePhases({
            startDate: start,
            stages: [{ name: "Nights", workingDays: 5, unit: "days" as const, source: null }],
            workingPattern: pattern,
        }, []);
        const plan = computeDisplayProgramme(start, built, pattern)!;
        expect(plan.end_date).toBe("2026-10-24");
        expect(plan.working_days).toBe(5);
        expect(plan.stages[0]?.start_date).toBe("2026-10-19");
        expect(plan.stages[0]?.working_days).toBe(5);
    });

    it("five programme days at 4h wall / 480 std: Oct 19–Oct 30, not Oct 21–Nov 2", () => {
        const start = "2026-10-19";
        const pattern = monFriShift(8, 12, 480);
        expect(addJobWorkingDays(start, 5, pattern)).toBe("2026-10-30");
        const built = buildProgrammePhases({
            startDate: start,
            stages: [{ name: "Half days", workingDays: 5, unit: "days" as const, source: null }],
            workingPattern: pattern,
        }, []);
        const plan = computeDisplayProgramme(start, built, pattern)!;
        expect(plan.start_date).toBe("2026-10-19");
        expect(plan.end_date).toBe("2026-10-30");
        expect(plan.working_days).toBe(5);
    });

    it("partition invariance: one 5-day vs five 1-day vs 2+3 night stages share finish and total", () => {
        const start = "2026-10-19";
        const pattern = monFriNightShift;
        const one = buildProgrammePhases({
            startDate: start,
            stages: [{ name: "All", workingDays: 5, unit: "days" as const, source: null }],
            workingPattern: pattern,
        }, []);
        const five = buildProgrammePhases({
            startDate: start,
            stages: [1, 2, 3, 4, 5].map(n => ({ name: `D${n}`, workingDays: 1, unit: "days" as const, source: null })),
            workingPattern: pattern,
        }, []);
        const split = buildProgrammePhases({
            startDate: start,
            stages: [
                { name: "A", workingDays: 2, unit: "days" as const, source: null },
                { name: "B", workingDays: 3, unit: "days" as const, source: null },
            ],
            workingPattern: pattern,
        }, []);
        const expectedEnd = "2026-10-24";
        for (const phases of [one, five, split]) {
            const plan = computeProgrammePlan(start, phases, pattern)!;
            expect(plan.end_date).toBe(expectedEnd);
            expect(plan.working_days).toBe(5);
        }
        expect(split[1]?.workingDayOffset).toBe(2);
        expect(jobWorkloadStartIso(start, 2, pattern)).toBe(planStartAfterTwoNights(start, pattern));
    });

    it("Mon–Fri 10h/day: stage working_days stay requested; partitions share overall end", () => {
        const start = "2026-10-19";
        const pattern = monFriShift(7, 17, 600);
        const four = buildProgrammePhases({
            startDate: start,
            stages: [{ name: "Works", workingDays: 4, unit: "days" as const, source: null }],
            workingPattern: pattern,
        }, []);
        const plan = computeDisplayProgramme(start, four, pattern)!;
        expect(plan.working_days).toBe(4);
        expect(plan.stages[0]?.working_days).toBe(4);
        expect(plan.end_date).toBe(addJobWorkingDays(start, 4, pattern));
    });

    it("parallel 2×10 programme days → total 10; gapped 2×5 → total 20", () => {
        const pattern = monFriShift(8, 16, 480);
        const start = "2026-10-19";
        const parallel = [
            { name: "A", manualDays: 10, startOffset: 0, workingDayOffset: 0 },
            { name: "B", manualDays: 10, startOffset: 0, workingDayOffset: 0 },
        ];
        const gapped = [
            { name: "A", manualDays: 5, startOffset: 0, workingDayOffset: 0 },
            { name: "B", manualDays: 5, startOffset: 15, workingDayOffset: 15 },
        ];
        const parPlan = computeProgrammePlan(start, parallel, pattern)!;
        const gapPlan = computeProgrammePlan(start, gapped, pattern)!;
        expect(parPlan.working_days).toBe(10);
        expect(parPlan.duration_label).toBe("2 weeks");
        expect(gapPlan.working_days).toBe(20);
        expect(gapPlan.working_days).toBeGreaterThan(parPlan.working_days);
    });

    it("legacy v1 parallel phases unchanged", () => {
        const start = "2026-10-19";
        const phases = [
            { name: "A", manualDays: 10, startOffset: 0 },
            { name: "B", manualDays: 10, startOffset: 0 },
        ];
        const plan = computeProgrammePlan(start, phases, DEFAULT_JOB_WORKING_PATTERN)!;
        expect(plan.working_days).toBe(10);
    });
});

function planStartAfterTwoNights(start: string, pattern: typeof monFriNightShift): string {
    const built = buildProgrammePhases({
        startDate: start,
        stages: [
            { name: "A", workingDays: 2, unit: "days" as const, source: null },
            { name: "B", workingDays: 1, unit: "days" as const, source: null },
        ],
        workingPattern: pattern,
    }, []);
    return computeProgrammePlan(start, built, pattern)!.stages[1]!.start_date;
}
