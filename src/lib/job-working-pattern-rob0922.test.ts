import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { clearJobWorkingPatternCachesForTests, resolveJobWorkingPattern } from "./job-working-pattern";
import { clearLocalTimeCachesForTests } from "./job-working-local";
import {
    buildSimpleProgramme, continueToProposal, emptyProgrammeDraft, initialProgrammeState,
    isProgrammeDirty, programmeReducer,
} from "./simple-programme";
import { canonicalWorkingPatternComparable } from "./working-pattern-canonical";
import { createWorkingPatternV2Draft } from "./working-pattern-draft";

describe("ROB0922 retained checks (superseded dates by ROB0942 where noted)", () => {
    beforeEach(() => {
        clearLocalTimeCachesForTests();
        clearJobWorkingPatternCachesForTests();
    });

    it("P1-4: raw working pattern edits mark dirty", async () => {
        const base = {
            version: 2 as const,
            timezone: "Europe/London",
            weekdays: [1, 2, 3, 4, 5],
            intervals: [1, 2, 3, 4, 5].map(weekday => ({ weekday, startMinute: 8 * 60, endMinute: 16 * 60 })),
            standardMinutesPerDay: 480,
            productivityPct: 100,
        };
        let state = initialProgrammeState({
            ...emptyProgrammeDraft("2026-10-19"),
            duration: "1",
            unit: "weeks",
            workingPattern: base,
        }, true);
        state = programmeReducer(state, {
            type: "field/change",
            patch: { workingPattern: { ...base, productivityPct: 90 } },
        });
        expect(isProgrammeDirty(state)).toBe(true);
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
    });

    it("P2-4/P2-5: invalid draft placeholder and specific error copy", () => {
        const draft = createWorkingPatternV2Draft([1, 2, 3, 4, 5]);
        expect(resolveJobWorkingPattern(draft)).toBeNull();
        const built = buildSimpleProgramme({ ...emptyProgrammeDraft("2026-10-19"), duration: "1", unit: "weeks", workingPattern: draft });
        expect(built.ok).toBe(false);
        if (!built.ok) expect(built.fieldErrors.workingPattern).toMatch(/timezone|interval|capacity/i);
    });

    it("P1-3: folded SQL COALESCE and v1 branch retained", () => {
        const sql = readFileSync(join(process.cwd(), "supabase/migrations/20261029103000_project_working_pattern_v2.sql"), "utf8");
        expect(sql).toContain("COALESCE(");
        expect(sql).toContain("value - 'version' - 'weekdays' <> '{}'::jsonb");
    });
});
