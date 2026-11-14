import { describe, expect, it } from "vitest";
import { fakeSupabase } from "@/lib/__fixtures__/fake-supabase";
import { writeProgrammeStorage } from "@/lib/server/programme-storage";
import { ProgrammePhaseSchema, UpdatePhasesSchema } from "@/lib/validation/schemas";
import { jobCapacityMinutes, jobProductiveMinutesPerDay } from "./job-working-pattern";
import { computeProgrammePlan, draftPlanCoversEveryPhase, isFlaggedZeroDayStage, planCoversEveryPhase } from "./programme-plan";
import { computeDisplayProgramme } from "./relative-programme";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MONDAY = "2026-11-02";

const weekdayPattern = {
    version: 1 as const,
    weekdays: [1, 2, 3, 4, 5],
};

// Monday 22:00 to Tuesday 06:00: 120 minutes on Monday and 360 on Tuesday for one standard day.
const nightShift = {
    version: 2 as const,
    timezone: "Europe/London",
    weekdays: [1, 2, 3, 4, 5],
    intervals: [{ weekday: 1, startMinute: 22 * 60, endMinute: 6 * 60 }],
    standardMinutesPerDay: 480,
    productivityPct: 100,
};

const sized = { name: "A", calculatedDays: 2, manualDays: null, manhours: 16, startOffset: 0 };
const flagged = { name: "Check me", calculatedDays: 0, manualDays: null, manhours: 0, startOffset: 2, needsReview: true };

describe("needsReview survives the phase schema", () => {
    const parsed = ProgrammePhaseSchema.parse(flagged);

    it("is kept rather than stripped", () => {
        expect(parsed.needsReview).toBe(true);
        expect(parsed).toMatchObject({ calculatedDays: 0, manualDays: null });
    });

    it("is kept through the save action's schema", () => {
        const input = UpdatePhasesSchema.parse({ projectId: PROJECT_ID, phases: [sized, flagged] });
        expect(input.phases[1].needsReview).toBe(true);
        expect(input.phases[0].needsReview).toBeUndefined();
    });
});

describe("zero-day flagged stages: draft storage keeps them, proposals still refuse them", () => {
    const phases = [sized, flagged];

    it("recognises only a flagged stage that has no length", () => {
        expect(isFlaggedZeroDayStage(flagged)).toBe(true);
        expect(isFlaggedZeroDayStage({ ...flagged, manualDays: 3 })).toBe(false);
        expect(isFlaggedZeroDayStage({ ...flagged, needsReview: undefined })).toBe(false);
        expect(isFlaggedZeroDayStage({ ...flagged, duration_days: 5 })).toBe(false);
    });

    it("draft coverage accepts the flagged stage but rejects an unflagged zero-day one", () => {
        const plan = computeDisplayProgramme(MONDAY, phases, weekdayPattern);
        expect(plan?.stages).toHaveLength(1);
        expect(draftPlanCoversEveryPhase(plan, phases)).toBe(true);
        const unflagged = [sized, { ...flagged, needsReview: undefined }];
        expect(draftPlanCoversEveryPhase(computeDisplayProgramme(MONDAY, unflagged, weekdayPattern), unflagged)).toBe(false);
    });

    it("proposal coverage still fails while a flagged stage has no length", () => {
        expect(planCoversEveryPhase(computeDisplayProgramme(MONDAY, phases, weekdayPattern), phases)).toBe(false);
    });

    it("a draft made only of flagged stages is kept", () => {
        expect(draftPlanCoversEveryPhase(null, [flagged])).toBe(true);
        expect(draftPlanCoversEveryPhase(null, [])).toBe(false);
    });

    function setup() {
        return fakeSupabase({ projects: [{
            id: PROJECT_ID, user_id: USER_ID, start_date: null, programme_phases: [], programme_working_pattern: weekdayPattern,
        }] });
    }

    it("saves the flagged stage with its flag and reads it back unchanged", async () => {
        const db = setup();
        const saved = await writeProgrammeStorage(db.client as never, USER_ID, PROJECT_ID, {
            phases, startDate: MONDAY, expectedWorkingPattern: weekdayPattern,
        });
        expect(saved).toEqual(phases);
        expect(db.tables.projects[0].programme_phases).toEqual(phases);
        const reloaded = db.tables.projects[0].programme_phases as unknown[];
        expect(isFlaggedZeroDayStage(reloaded[1])).toBe(true);
    });

    it("still refuses an unflagged zero-day stage", async () => {
        const db = setup();
        await expect(writeProgrammeStorage(db.client as never, USER_ID, PROJECT_ID, {
            phases: [sized, { ...flagged, needsReview: undefined }], startDate: MONDAY, expectedWorkingPattern: weekdayPattern,
        })).rejects.toThrow("Check every programme phase");
        expect(db.updates).toHaveLength(0);
    });
});

describe("overnight shifts are counted by productive time, not by civil dates touched", () => {
    // Monday 19 October 2026.
    const start = "2026-10-19";

    it("measures capacity across an overnight shift", () => {
        expect(jobCapacityMinutes("2026-10-19", "2026-10-19", nightShift)).toBe(120);
        expect(jobCapacityMinutes("2026-10-19", "2026-10-20", nightShift)).toBe(480);
        expect(jobCapacityMinutes("2026-10-19", "2026-10-19", weekdayPattern)).toBeNull();
        expect(jobProductiveMinutesPerDay(nightShift)).toBe(480);
        expect(jobProductiveMinutesPerDay(weekdayPattern)).toBe(480);
        expect(jobProductiveMinutesPerDay(undefined)).toBe(480);
    });

    it("counts two working days of night shifts as two, not as the three dates they touch", () => {
        const plan = computeProgrammePlan(start, [{ name: "Works", manualDays: 2, calculatedDays: 2, startOffset: 0 }], nightShift);
        expect(plan?.stages[0].working_days).toBe(2);
        expect(plan?.working_days).toBe(2);
    });

    it("does not double count identical overlapping night stages", () => {
        const stage = { manualDays: 2, calculatedDays: 2, startOffset: 0 };
        const plan = computeProgrammePlan(start, [{ name: "A", ...stage }, { name: "B", ...stage }], nightShift);
        expect(plan?.working_days).toBe(2);
    });

    it("sums sequential night stages", () => {
        const plan = computeProgrammePlan(start, [
            { name: "A", manualDays: 1, calculatedDays: 1, startOffset: 0 },
            { name: "B", manualDays: 1, calculatedDays: 1, startOffset: 7 },
        ], nightShift);
        expect(plan?.working_days).toBe(2);
    });
});
