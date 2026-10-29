import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { localWallClockStatus } from "./job-working-local";
import { buildSimpleProgramme, emptyProgrammeDraft, initialProgrammeState, programmeReducer, saveProgramme } from "./simple-programme";
import { addJobWorkingDays, resolveJobWorkingPattern } from "./job-working-pattern";
import { createWorkingPatternV2Draft, isWorkingPatternV2Draft } from "./working-pattern-draft";

describe("ROB0905 same-build fixes (4a050cd regressions)", () => {
    it("finding2: rejects cross-midnight segment overlap on the spill weekday", () => {
        const pattern = {
            version: 2 as const,
            timezone: "Europe/London",
            weekdays: [1, 2],
            intervals: [
                { weekday: 1, startMinute: 22 * 60, endMinute: 6 * 60 },
                { weekday: 2, startMinute: 60, endMinute: 3 * 60 },
            ],
            standardMinutesPerDay: 480,
            productivityPct: 100,
        };
        expect(resolveJobWorkingPattern(pattern)).toBeNull();
    });

    it("finding3: rejects overnight spill when the next civil weekday is not selected", () => {
        const pattern = {
            version: 2 as const,
            timezone: "Europe/London",
            weekdays: [5],
            intervals: [{ weekday: 5, startMinute: 22 * 60, endMinute: 6 * 60 }],
            standardMinutesPerDay: 480,
            productivityPct: 100,
        };
        expect(resolveJobWorkingPattern(pattern)).toBeNull();
        expect(addJobWorkingDays("2026-10-16", 1, pattern)).toBeNull();
    });

    it("finding4: DST ambiguous/nonexistent wall times fail closed; valid post-transition times pass", () => {
        expect(localWallClockStatus("2026-10-25", 90, "Europe/London")).toBe("ambiguous");
        expect(localWallClockStatus("2026-03-29", 90, "Europe/London")).toBe("nonexistent");
        expect(localWallClockStatus("2026-03-30", 9 * 60, "Europe/London")).toBe("unique");
        const pattern = {
            version: 2 as const,
            timezone: "Europe/London",
            weekdays: [1, 2, 3, 4, 5],
            intervals: [{ weekday: 1, startMinute: 22 * 60, endMinute: 6 * 60 }],
            standardMinutesPerDay: 480,
            productivityPct: 100,
        };
        expect(resolveJobWorkingPattern(pattern)).not.toBeNull();
    });

    it("finding1: editor draft stays editable while save refuses until resolved", async () => {
        let state = initialProgrammeState({ ...emptyProgrammeDraft("2026-10-19"), duration: "1", unit: "days" }, false);
        const draft = createWorkingPatternV2Draft([1, 2, 3, 4, 5]);
        state = programmeReducer(state, { type: "field/change", patch: { workingPattern: draft } });
        expect(isWorkingPatternV2Draft(state.draft.workingPattern)).toBe(true);
        expect(resolveJobWorkingPattern(state.draft.workingPattern)).toBeNull();
        state = programmeReducer(state, { type: "field/change", patch: {
            workingPattern: { ...draft, timezone: "Europe/London", standardMinutesPerDay: 480, productivityPct: 100,
                intervals: [{ weekday: 1, startMinute: 8 * 60, endMinute: 16 * 60 }] },
        } });
        expect(resolveJobWorkingPattern(state.draft.workingPattern)).not.toBeNull();
        const invalid = buildSimpleProgramme({ ...state.draft, workingPattern: draft });
        expect(invalid.ok).toBe(false);
        const store = {
            getState: () => state,
            dispatch: (action: Parameters<typeof programmeReducer>[1]) => { state = programmeReducer(state, action); },
        };
        const save = vi.fn().mockResolvedValue({ success: false, error: "Calendar storage is not set up for this job yet. Nothing was saved." });
        expect(await saveProgramme(store, save)).toBe("failed");
        expect(save).toHaveBeenCalled();
    });

    it("finding6: strict SQL source requires weekday bounds and interval keys", () => {
        const sql = readFileSync(join(process.cwd(), "supabase/migrations/20261029103000_project_working_pattern_v2.sql"), "utf8");
        expect(sql).toContain("COALESCE(");
        expect(sql).toContain("NOT (value ? 'version')");
        expect(sql).toContain("NOT BETWEEN 0 AND 6");
        expect(sql).toContain("raw - 'weekday' - 'startMinute' - 'endMinute' <> '{}'::jsonb");
        expect(sql).toContain("(raw ->> 'startMinute')::int = (raw ->> 'endMinute')::int");
        expect(sql).not.toMatch(/RETURN NULL/);
    });
});
