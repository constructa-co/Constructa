import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
    addJobWorkingDays, clearJobWorkingPatternCachesForTests, DEFAULT_JOB_WORKING_PATTERN,
    resolveJobWorkingPattern,
} from "./job-working-pattern";
import { clearLocalTimeCachesForTests } from "./job-working-local";
import { computeDisplayProgramme } from "./relative-programme";
import { buildProgrammePhases } from "./simple-programme";
import { canonicalWorkingPatternComparable, workingPatternsEquivalent } from "./working-pattern-canonical";

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

function resetCaches() {
    clearLocalTimeCachesForTests();
    clearJobWorkingPatternCachesForTests();
}

describe("ROB0942 recheck counterexamples (post a538272)", () => {
    beforeEach(resetCaches);

    it("N1: plain per-date add matches legacy v1 for Mon–Fri 08:00–16:00", () => {
        const pattern = monFriShift(8, 16, 480);
        const start = "2026-10-19";
        expect(addJobWorkingDays(start, 12, pattern)).toBe(addJobWorkingDays(start, 12, DEFAULT_JOB_WORKING_PATTERN));
        expect(addJobWorkingDays(start, 12, pattern)).toBe("2026-11-03");
        expect(addJobWorkingDays(start, 10, pattern)).toBe("2026-10-30");
        expect(addJobWorkingDays(start, 30, pattern)).toBe("2026-11-27");
        expect(addJobWorkingDays(start, 60, pattern)).toBe("2027-01-08");
    });

    it("N1: refuses add when planned range hits unsupported DST capacity (daily 00:30–03:00)", () => {
        const pattern = {
            version: 2 as const,
            timezone: "Europe/London",
            weekdays: [0, 1, 2, 3, 4, 5, 6],
            intervals: [0, 1, 2, 3, 4, 5, 6].map(weekday => ({ weekday, startMinute: 30, endMinute: 180 })),
            standardMinutesPerDay: 150,
            productivityPct: 100,
        };
        expect(resolveJobWorkingPattern(pattern)).not.toBeNull();
        expect(addJobWorkingDays("2026-03-16", 20, pattern)).toBeNull();
    });

    it("P2-1: one Mon–Fri day-shift week is five programme days and matches plain add end date", () => {
        const pattern = monFriShift(8, 16, 480);
        const start = "2026-10-19";
        const expectedEnd = addJobWorkingDays(start, 5, pattern);
        const built = buildProgrammePhases({
            startDate: start,
            stages: [{ name: "Works", workingDays: 5, unit: "days" as const, source: null }],
            workingPattern: pattern,
        }, []);
        const plan = computeDisplayProgramme(start, built, pattern);
        expect(plan?.working_days).toBe(5);
        expect(plan?.end_date).toBe(expectedEnd);
        expect(plan?.duration_label).toBe("1 week");
    });

    it("P2-2: display keeps explicit four programme days at ten hours/day (not capacity-derived five)", () => {
        const pattern = monFriShift(7, 17, 600);
        const start = "2026-10-19";
        const expectedEnd = addJobWorkingDays(start, 4, pattern);
        const built = buildProgrammePhases({
            startDate: start,
            stages: [{ name: "Works", workingDays: 4, unit: "days" as const, source: null }],
            workingPattern: pattern,
        }, []);
        const plan = computeDisplayProgramme(start, built, pattern);
        expect(plan?.working_days).toBe(4);
        expect(plan?.duration_label).toBe("4 working days");
        expect(plan?.end_date).toBe(expectedEnd);
        expect(expectedEnd).toBe("2026-10-22");
    });

    it("N2: canonical compare has no node:util import in source graph module", () => {
        const source = readFileSync(join(process.cwd(), "src/lib/working-pattern-canonical.ts"), "utf8");
        expect(source).not.toContain("node:util");
        expect(workingPatternsEquivalent(
            { version: 1, weekdays: [1, 2, 3, 4, 5] },
            { version: 1, weekdays: [1, 2, 3, 4, 5] },
        )).toBe(true);
        expect(canonicalWorkingPatternComparable({ version: 2, timezone: "Europe/London", weekdays: [1], intervals: [{ weekday: 1, startMinute: 0, endMinute: 0 }], standardMinutesPerDay: 0, productivityPct: 0 }))
            .not.toEqual(canonicalWorkingPatternComparable({ version: 2, timezone: "Europe/London", weekdays: [1], intervals: [{ weekday: 1, startMinute: 0, endMinute: 0 }], standardMinutesPerDay: 0, productivityPct: 50 }));
    });

    it("SQL: interval objects require weekday/startMinute/endMinute keys before casts", () => {
        const sql = readFileSync(join(process.cwd(), "supabase/migrations/20261029103000_project_working_pattern_v2.sql"), "utf8");
        expect(sql).toContain("NOT (raw ? 'weekday' AND raw ? 'startMinute' AND raw ? 'endMinute')");
    });
});
