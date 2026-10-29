import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import {
    addJobWorkingDays, clearJobWorkingPatternCachesForTests, countJobWorkingDays,
    effectiveLocalDayMinutesOnDate, programmeWeekUnitCount, resolveJobWorkingPattern,
} from "./job-working-pattern";
import { clearLocalTimeCachesForTests, elapsedLocalMinutes } from "./job-working-local";
import {
    buildSimpleProgramme, continueToProposal, emptyProgrammeDraft, initialProgrammeState,
    isProgrammeDirty, programmeReducer,
} from "./simple-programme";
import { canonicalWorkingPatternComparable } from "./working-pattern-canonical";
import { createWorkingPatternV2Draft } from "./working-pattern-draft";

const londonOvernight = {
    version: 2 as const,
    timezone: "Europe/London",
    weekdays: [1, 2, 3, 4, 5, 6],
    intervals: [{ weekday: 5, startMinute: 22 * 60, endMinute: 6 * 60 }],
    standardMinutesPerDay: 480,
    productivityPct: 100,
};

describe("ROB0922 independent finding fixes", () => {
    it("P1-1: add/count local walks finish quickly for 10 and 60 programme days", () => {
        clearLocalTimeCachesForTests();
        clearJobWorkingPatternCachesForTests();
        const pattern = {
            version: 2 as const,
            timezone: "Europe/London",
            weekdays: [1, 2, 3, 4, 5],
            intervals: [{ weekday: 1, startMinute: 8 * 60, endMinute: 16 * 60 }],
            standardMinutesPerDay: 480,
            productivityPct: 100,
        };
        const start = "2026-01-05";
        let t0 = performance.now();
        expect(addJobWorkingDays(start, 10, pattern)).toBeTruthy();
        expect(performance.now() - t0).toBeLessThan(800);
        t0 = performance.now();
        const end = addJobWorkingDays(start, 60, pattern);
        expect(end).toBeTruthy();
        expect(performance.now() - t0).toBeLessThan(800);
    });

    it("P1-2: capacity uses elapsed UTC minutes across DST, not wall-minute sums", () => {
        clearLocalTimeCachesForTests();
        clearJobWorkingPatternCachesForTests();
        const springGap = elapsedLocalMinutes("2026-03-29", 30, "2026-03-29", 180, "Europe/London");
        expect(springGap).toBe(90);
        expect(springGap).not.toBe(180 - 30);
        const pattern = {
            version: 2 as const,
            timezone: "Europe/London",
            weekdays: [0],
            intervals: [{ weekday: 0, startMinute: 30, endMinute: 180 }],
            standardMinutesPerDay: 90,
            productivityPct: 100,
        };
        expect(resolveJobWorkingPattern(pattern)).not.toBeNull();
        expect(effectiveLocalDayMinutesOnDate("2026-03-29", pattern)).toBeNull();
    });

    it("P2-1: week units include spill weekday for Mon–Fri overnight into Saturday", () => {
        expect(resolveJobWorkingPattern(londonOvernight)).not.toBeNull();
        expect(programmeWeekUnitCount(londonOvernight)).toBe(6);
        const built = buildSimpleProgramme({
            ...emptyProgrammeDraft("2026-10-16"),
            duration: "1",
            unit: "weeks",
            workingPattern: londonOvernight,
        });
        expect(built.ok).toBe(true);
        if (built.ok) expect(built.input.stages[0]?.workingDays).toBe(6);
    });

    it("P2-2: count from start through add end matches requested programme days", () => {
        clearJobWorkingPatternCachesForTests();
        const pattern = {
            version: 2 as const,
            timezone: "Europe/London",
            weekdays: [1, 2, 3, 4, 5],
            intervals: [{ weekday: 1, startMinute: 8 * 60, endMinute: 18 * 60 }],
            standardMinutesPerDay: 600,
            productivityPct: 100,
        };
        const start = "2026-10-19";
        const end = addJobWorkingDays(start, 4, pattern);
        expect(end).toBeTruthy();
        expect(countJobWorkingDays(start, end!, pattern)).toBe(4);
    });

    it("P1-4/P2-6: raw working pattern edits mark dirty and block Next until saved", async () => {
        const base = {
            version: 2 as const,
            timezone: "Europe/London",
            weekdays: [1, 2, 3, 4, 5],
            intervals: [{ weekday: 1, startMinute: 8 * 60, endMinute: 16 * 60 }],
            standardMinutesPerDay: 480,
            productivityPct: 100,
        };
        let state = initialProgrammeState({
            ...emptyProgrammeDraft("2026-10-19"),
            duration: "1",
            unit: "weeks",
            workingPattern: base,
        }, true);
        expect(isProgrammeDirty(state)).toBe(false);
        state = programmeReducer(state, {
            type: "field/change",
            patch: { workingPattern: { ...base, productivityPct: 90 } },
        });
        expect(isProgrammeDirty(state)).toBe(true);
        expect(canonicalWorkingPatternComparable(state.draft.workingPattern))
            .not.toEqual(canonicalWorkingPatternComparable(state.saved.workingPattern));
        const store = {
            getState: () => state,
            dispatch: (action: Parameters<typeof programmeReducer>[1]) => { state = programmeReducer(state, action); },
        };
        const navigate = vi.fn();
        const save = vi.fn().mockResolvedValue({
            success: true,
            confirmedProject: { programme_working_pattern: state.draft.workingPattern },
        });
        await expect(continueToProposal(store, save, navigate)).resolves.toBe("navigated");
        expect(navigate).toHaveBeenCalled();
    });

    it("P2-4: new v2 draft uses invalid equal-endpoint interval placeholder", () => {
        const draft = createWorkingPatternV2Draft([1, 2, 3, 4, 5]);
        expect(draft.intervals[0]?.startMinute).toBe(draft.intervals[0]?.endMinute);
        expect(resolveJobWorkingPattern(draft)).toBeNull();
    });

    it("P2-5: unresolved draft surfaces a specific working-pattern message", () => {
        const draft = createWorkingPatternV2Draft([1, 2, 3, 4, 5]);
        const built = buildSimpleProgramme({ ...emptyProgrammeDraft("2026-10-19"), duration: "1", unit: "weeks", workingPattern: draft });
        expect(built.ok).toBe(false);
        if (!built.ok) {
            expect(built.fieldErrors.workingPattern).toMatch(/timezone|interval|capacity/i);
            expect(built.fieldErrors.workingPattern).not.toBe("Choose valid working days for this job.");
        }
    });

    it("P1-3: folded SQL source rejects weak v1/v2 payloads and never returns NULL", () => {
        const sql = readFileSync(join(process.cwd(), "supabase/migrations/20261029103000_project_working_pattern_v2.sql"), "utf8");
        expect(sql).toContain("COALESCE(");
        expect(sql).toContain("NOT (value ? 'version')");
        expect(sql).toContain("WHEN value -> 'version' = '1'::jsonb THEN");
        expect(sql).toContain("value - 'version' - 'weekdays' <> '{}'::jsonb");
        expect(sql).not.toMatch(/RETURN NULL/);
        expect(sql).not.toContain("20261029120000");
    });
});
