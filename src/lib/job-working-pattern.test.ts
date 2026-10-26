import { describe, expect, it } from "vitest";
import { addWorkingDays, countWorkingDays, isWorkingDay, nextWorkingDayAfter } from "./programme-plan";
import {
    addJobWorkingDays, countJobWorkingDays, DEFAULT_JOB_WORKING_PATTERN, isJobWorkingDay,
    jobCalendarOffset, nextJobWorkingDayAfter, resolveJobWorkingPattern,
} from "./job-working-pattern";

describe("job working-pattern calendar foundation", () => {
    it("retains the legacy missing/null Monday-Friday contract without mutable shared state", () => {
        expect(resolveJobWorkingPattern(undefined)).toBe(DEFAULT_JOB_WORKING_PATTERN);
        expect(resolveJobWorkingPattern(null)).toBe(DEFAULT_JOB_WORKING_PATTERN);
        expect(DEFAULT_JOB_WORKING_PATTERN).toEqual({ version: 1, weekdays: [1, 2, 3, 4, 5] });
        expect(Object.isFrozen(DEFAULT_JOB_WORKING_PATTERN.weekdays)).toBe(true);
        const input = { version: 1, weekdays: [1, 6] };
        const pattern = resolveJobWorkingPattern(input)!;
        input.weekdays.push(0);
        expect(pattern.weekdays).toEqual([1, 6]);
        expect(Object.isFrozen(pattern)).toBe(true);
    });

    it("matches the actual legacy helpers across weekdays, rounding, leap and year boundaries", () => {
        for (const start of ["2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2028-02-28", "2026-12-31"]) {
            expect(isJobWorkingDay(start)).toBe(isWorkingDay(start));
            expect(nextJobWorkingDayAfter(start)).toBe(nextWorkingDayAfter(start));
            for (const days of [1, 1.4, 1.5, 5, 12, 2600]) {
                const end = addWorkingDays(start, days)!;
                expect(addJobWorkingDays(start, days)).toBe(end);
                expect(countJobWorkingDays(start, end)).toBe(countWorkingDays(start, end));
            }
        }
    });

    it("counts a working start as day one and only enables explicitly selected weekend days", () => {
        const saturday = { version: 1, weekdays: [1, 2, 3, 4, 5, 6] };
        expect(addJobWorkingDays("2026-10-23", 2)).toBe("2026-10-26");
        expect(addJobWorkingDays("2026-10-23", 2, saturday)).toBe("2026-10-24");
        expect(addJobWorkingDays("2026-10-25", 1, saturday)).toBe("2026-10-26");
        expect(isJobWorkingDay("2026-10-24", saturday)).toBe(true);
        expect(isJobWorkingDay("2026-10-25", saturday)).toBe(false);
        expect(countJobWorkingDays("2026-10-23", "2026-10-26", saturday)).toBe(3);
        expect(nextJobWorkingDayAfter("2026-10-23", saturday)).toBe("2026-10-24");
    });

    it("supports explicit seven-day and single-weekday patterns without assuming hour capacity", () => {
        const all = { version: 1, weekdays: [0, 1, 2, 3, 4, 5, 6] };
        expect(addJobWorkingDays("2026-10-23", 8, all)).toBe("2026-10-30");
        expect(countJobWorkingDays("2026-10-23", "2026-10-30", all)).toBe(8);
        const sunday = { version: 1, weekdays: [0] };
        expect(addJobWorkingDays("2026-10-23", 2, sunday)).toBe("2026-11-01");
        expect(countJobWorkingDays("2026-10-23", "2026-11-01", sunday)).toBe(2);
        expect(nextJobWorkingDayAfter("2026-10-25", sunday)).toBe("2026-11-01");
    });

    it("rejects malformed explicit patterns rather than coercing or silently dropping fields", () => {
        for (const value of [false, 5, [], {}, { version: 1, weekdays: Array(1) }, { version: 2, weekdays: [1] }, { version: 1, weekdays: [] },
            { version: 1, weekdays: [1, 1] }, { version: 1, weekdays: ["1"] }, { version: 1, weekdays: [-1] },
            { version: 1, weekdays: [7] }, { version: 1, weekdays: [1.5] }, { version: 1, weekdays: [1], shifts: [] }]) {
            expect(resolveJobWorkingPattern(value)).toBeNull();
            expect(addJobWorkingDays("2026-10-26", 1, value)).toBeNull();
            expect(nextJobWorkingDayAfter("2026-10-26", value)).toBeNull();
            expect(isJobWorkingDay("2026-10-26", value)).toBe(false);
            expect(countJobWorkingDays("2026-10-26", "2026-10-30", value)).toBe(0);
        }
    });

    it("refuses a finite duration whose remainder crosses the JavaScript date limit", () => {
        const all = { version: 1, weekdays: [0, 1, 2, 3, 4, 5, 6] };
        expect(addJobWorkingDays("1970-01-01", 100_000_002, all)).toBeNull();
    });

    it("preserves invalid-duration/date refusals and civil calendar offsets without timezone conversion", () => {
        for (const days of [0, -1, 0.5, NaN, Infinity, Number.MAX_VALUE]) expect(addJobWorkingDays("2026-10-26", days)).toBeNull();
        for (const iso of ["", "invalid", "2026-02-29"]) {
            expect(addJobWorkingDays(iso, 1)).toBeNull();
            expect(nextJobWorkingDayAfter(iso)).toBeNull();
            expect(countJobWorkingDays(iso, "2026-10-26")).toBe(0);
            expect(jobCalendarOffset(iso, "2026-10-26")).toBeNull();
        }
        expect(countJobWorkingDays("2026-10-26", "2026-10-23")).toBe(0);
        expect(jobCalendarOffset("2026-10-23", "2026-10-26")).toBe(3);
        expect(jobCalendarOffset("2026-10-26", "2026-10-23")).toBe(-3);
        expect(jobCalendarOffset("2028-02-28", "2028-03-01")).toBe(2);
        expect(addJobWorkingDays("9999-12-31", 2)).toBeNull();
    });
});
