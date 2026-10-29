import { beforeEach, describe, expect, it, vi } from "vitest";
import { performance } from "node:perf_hooks";
import {
    addJobWorkingDays, clearJobWorkingPatternCachesForTests, DEFAULT_JOB_WORKING_PATTERN,
    effectiveLocalDayMinutesOnDate, validateWorkingPatternForProgramme,
} from "./job-working-pattern";
import { clearLocalTimeCachesForTests, elapsedLocalMinutes } from "./job-working-local";
import { computeProgrammePlan } from "./programme-plan";
import { computeDisplayProgramme } from "./relative-programme";
import { buildProgrammePhases, emptyProgrammeDraft, initialProgrammeState, programmeReducer, saveProgramme } from "./simple-programme";

const monFriNightShift = {
    version: 2 as const,
    timezone: "Europe/London",
    weekdays: [1, 2, 3, 4, 5, 6],
    intervals: [1, 2, 3, 4, 5].map(weekday => ({ weekday, startMinute: 22 * 60, endMinute: 6 * 60 })),
    standardMinutesPerDay: 480,
    productivityPct: 100,
};

function monFri0800() {
    return {
        version: 2 as const,
        timezone: "Europe/London",
        weekdays: [1, 2, 3, 4, 5],
        intervals: [1, 2, 3, 4, 5].map(weekday => ({ weekday, startMinute: 8 * 60, endMinute: 16 * 60 })),
        standardMinutesPerDay: 480,
        productivityPct: 100,
    };
}

describe("ROB1002 engineering closure", () => {
    beforeEach(() => {
        clearLocalTimeCachesForTests();
        clearJobWorkingPatternCachesForTests();
    });

    it("R1: parallel v2 stages use span working_days like v1 (10 not 20)", () => {
        const pattern = monFri0800();
        const start = "2026-10-19";
        const phases = [
            { name: "A", manualDays: 10, startOffset: 0 },
            { name: "B", manualDays: 10, startOffset: 0 },
        ];
        const v2 = computeProgrammePlan(start, phases, pattern)!;
        const v1 = computeProgrammePlan(start, phases, DEFAULT_JOB_WORKING_PATTERN)!;
        expect(v2.working_days).toBe(10);
        expect(v2.duration_label).toBe("2 weeks");
        expect(v1.working_days).toBe(10);
        expect(v2.stages[0]?.working_days).toBe(10);
        expect(v2.stages[1]?.working_days).toBe(10);
    });

    it("R1: separated v2 stages count working span across gap (20 not 10)", () => {
        const pattern = monFri0800();
        const start = "2026-10-19";
        const phases = [
            { name: "A", manualDays: 5, startOffset: 0 },
            { name: "B", manualDays: 5, startOffset: 15 },
        ];
        const v2 = computeProgrammePlan(start, phases, pattern)!;
        const v1 = computeProgrammePlan(start, phases, DEFAULT_JOB_WORKING_PATTERN)!;
        expect(v2.working_days).toBe(v1.working_days);
        expect(v2.working_days).toBeGreaterThan(10);
        expect(v2.duration_label).toBe(v1.duration_label);
    });

    it("R2: validateWorkingPatternForProgramme walks only through computed finish (~60 civil days)", () => {
        const pattern = monFri0800();
        const start = "2026-10-19";
        const t0 = performance.now();
        const errors = validateWorkingPatternForProgramme(pattern, start, 60);
        const elapsed = performance.now() - t0;
        expect(errors.workingPattern).toBeUndefined();
        expect(elapsed).toBeLessThan(1200);
    });

    it("phase-split invariance: one 2-day stage vs two 1-day night stages end Wed 2026-10-21", () => {
        const start = "2026-10-19";
        const one = buildProgrammePhases({
            startDate: start,
            stages: [{ name: "All", workingDays: 2, unit: "days" as const, source: null }],
            workingPattern: monFriNightShift,
        }, []);
        const split = buildProgrammePhases({
            startDate: start,
            stages: [
                { name: "A", workingDays: 1, unit: "days" as const, source: null },
                { name: "B", workingDays: 1, unit: "days" as const, source: null },
            ],
            workingPattern: monFriNightShift,
        }, []);
        expect(addJobWorkingDays(start, 2, monFriNightShift)).toBe("2026-10-21");
        const endOne = computeDisplayProgramme(start, one, monFriNightShift)?.end_date;
        const endSplit = computeDisplayProgramme(start, split, monFriNightShift)?.end_date;
        expect(endOne).toBe("2026-10-21");
        expect(endSplit).toBe("2026-10-21");
        expect(endSplit).toBe(endOne);
    });

    it("restored clock: spring gap elapsed 90 not wall 150; transition day capacity refused", () => {
        const springGap = elapsedLocalMinutes("2026-03-29", 30, "2026-03-29", 180, "Europe/London");
        expect(springGap).toBe(90);
        expect(springGap).not.toBe(150);
        const pattern = {
            version: 2 as const,
            timezone: "Europe/London",
            weekdays: [0],
            intervals: [{ weekday: 0, startMinute: 30, endMinute: 180 }],
            standardMinutesPerDay: 90,
            productivityPct: 100,
        };
        expect(effectiveLocalDayMinutesOnDate("2026-03-29", pattern)).toBeNull();
    });

    it("P1-4: saveProgramme calls server when draft valid", async () => {
        const base = monFri0800();
        let state = initialProgrammeState({
            ...emptyProgrammeDraft("2026-10-19"),
            duration: "1",
            unit: "weeks",
            workingPattern: base,
        }, false);
        const store = {
            getState: () => state,
            dispatch: (action: Parameters<typeof programmeReducer>[1]) => { state = programmeReducer(state, action); },
        };
        const save = vi.fn().mockResolvedValue({ success: true, confirmedProject: { programme_working_pattern: base } });
        await expect(saveProgramme(store, save)).resolves.toBe("saved");
        expect(save).toHaveBeenCalledTimes(1);
    });
});
