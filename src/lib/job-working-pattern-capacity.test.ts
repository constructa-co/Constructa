import { describe, expect, it } from "vitest";
import { computeDisplayProgramme } from "./relative-programme";
import {
    addJobWorkingDays, DEFAULT_JOB_WORKING_PATTERN, effectiveLocalDayMinutes, intervalMinutesOnLocalDay,
    isJobWorkingDay, resolveJobWorkingPattern,
} from "./job-working-pattern";

const nightShift = () => ({
    version: 2 as const,
    timezone: "Europe/London",
    weekdays: [1, 2, 3, 4, 5],
    intervals: [{ weekday: 1, startMinute: 22 * 60, endMinute: 6 * 60 }],
    standardMinutesPerDay: 480,
    productivityPct: 100,
});

describe("explicit timezone intervals and capacity (v2)", () => {
    it("RED counterexample: one programme day can span two civil days when overnight capacity exceeds standard minutes", () => {
        const pattern = nightShift();
        expect(resolveJobWorkingPattern(pattern)).not.toBeNull();
        expect(intervalMinutesOnLocalDay(pattern, 1)).toBe(120);
        expect(effectiveLocalDayMinutes(pattern, 2)).toBe(360);
        const end = addJobWorkingDays("2026-10-19", 1, pattern);
        expect(end).toBe("2026-10-20");
        expect(addJobWorkingDays("2026-10-19", 1, DEFAULT_JOB_WORKING_PATTERN)).toBe("2026-10-19");
        const phases = [{ name: "Works", calculatedDays: 1, manualDays: 1, startOffset: 0 }];
        expect(computeDisplayProgramme("2026-10-19", phases, pattern)?.end_date).toBe("2026-10-20");
        expect(computeDisplayProgramme("2026-10-19", phases, DEFAULT_JOB_WORKING_PATTERN)?.end_date).toBe("2026-10-19");
    });

    it("rejects partial v2 payloads, overlapping intervals and unknown keys", () => {
        for (const value of [
            { version: 2, weekdays: [1, 2, 3, 4, 5] },
            { version: 2, timezone: "Europe/London", weekdays: [1], intervals: [], standardMinutesPerDay: 480, productivityPct: 100 },
            { version: 2, timezone: "Not/AZone", weekdays: [1], intervals: [{ weekday: 1, startMinute: 480, endMinute: 960 }], standardMinutesPerDay: 480, productivityPct: 100 },
            { version: 2, timezone: "Europe/London", weekdays: [1], intervals: [{ weekday: 1, startMinute: 480, endMinute: 600 }], standardMinutesPerDay: 480, productivityPct: 100, premium: 1 },
            { version: 2, timezone: "Europe/London", weekdays: [2], intervals: [{ weekday: 1, startMinute: 480, endMinute: 600 }], standardMinutesPerDay: 480, productivityPct: 100 },
            { version: 2, timezone: "Europe/London", weekdays: [1], intervals: [
                { weekday: 1, startMinute: 480, endMinute: 720 },
                { weekday: 1, startMinute: 660, endMinute: 780 },
            ], standardMinutesPerDay: 480, productivityPct: 100 },
        ]) {
            expect(resolveJobWorkingPattern(value)).toBeNull();
            expect(addJobWorkingDays("2026-10-19", 1, value)).toBeNull();
        }
    });

    it("applies explicit productivity to capacity without inventing defaults", () => {
        const pattern = {
            version: 2 as const,
            timezone: "Europe/London",
            weekdays: [1],
            intervals: [{ weekday: 1, startMinute: 8 * 60, endMinute: 16 * 60 }],
            standardMinutesPerDay: 240,
            productivityPct: 50,
        };
        expect(effectiveLocalDayMinutes(pattern, 1)).toBe(240);
        expect(addJobWorkingDays("2026-10-19", 1, pattern)).toBe("2026-10-19");
        expect(addJobWorkingDays("2026-10-19", 2, pattern)).toBe("2026-10-26");
    });

    it("keeps legacy v1 resolution and civil weekday behaviour unchanged", () => {
        expect(resolveJobWorkingPattern(undefined)).toBe(DEFAULT_JOB_WORKING_PATTERN);
        expect(isJobWorkingDay("2026-10-19", undefined)).toBe(true);
        expect(isJobWorkingDay("2026-10-18", undefined)).toBe(false);
    });
});
