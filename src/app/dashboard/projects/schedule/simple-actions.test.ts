import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "@/lib/__fixtures__/fake-supabase";

const mocks = vi.hoisted(() => ({ requireEditableProjectAccess: vi.fn() }));
vi.mock("@/lib/supabase/project-resource-access", () => mocks);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { computeProgrammePlan } from "@/lib/programme-plan";
import { computeDisplayProgramme } from "@/lib/relative-programme";
import { viewForProject } from "@/lib/simple-programme";
import { PROGRAMME_SAVE_ERROR } from "@/lib/simple-programme";
import { saveSimpleProgrammeAction } from "./simple-actions";

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
// 12 October 2026 is a Monday.
const MONDAY = "2026-10-12";

const established = [
    { name: "Strip out", calculatedDays: 3, manualDays: 5, manhours: 24, startOffset: 0, color: "blue" },
    { name: "First fix", calculatedDays: 10, manualDays: null, manhours: 80, startOffset: 7, color: "emerald" },
    { name: "Finishes", calculatedDays: 5, manualDays: 5, manhours: 40, startOffset: 21, color: "orange" },
];

function setup(project: Record<string, unknown> = {}) {
    const db = fakeSupabase({ projects: [{ id: PROJECT_ID, user_id: USER_ID, start_date: null, programme_phases: [], ...project }] });
    mocks.requireEditableProjectAccess.mockResolvedValue({ user: { id: USER_ID }, supabase: db.client });
    return db;
}

const whole = { startDate: MONDAY, stages: [{ name: "Works on site", workingDays: 15, unit: "weeks" as const, source: null }] };

beforeEach(() => vi.clearAllMocks());

describe("saveSimpleProgrammeAction", () => {
    it("atomically saves and reads back the job pattern and phases, then reopens weekends", async () => {
        const pattern = { version: 1 as const, weekdays: [1, 2, 3, 4, 5, 6] };
        const db = setup({ programme_working_pattern: null });
        const input = { startDate: "2026-10-16", workingPattern: pattern, expectedWorkingPattern: null,
            stages: [{ name: "Works", workingDays: 2, unit: "days" as const, source: null }] };
        const result = await saveSimpleProgrammeAction(PROJECT_ID, input);
        expect(result).toMatchObject({ success: true, confirmedProject: { programme_working_pattern: pattern, start_date: input.startDate } });
        expect(db.updates).toHaveLength(1);
        expect(db.updates[0].values).toMatchObject({ programme_working_pattern: pattern, start_date: input.startDate });
        expect(db.updates[0].filters).toMatchObject({ id: PROJECT_ID, user_id: USER_ID, programme_phases: "[]", programme_working_pattern: null });
        const saved = db.tables.projects[0];
        expect(computeDisplayProgramme(input.startDate, saved.programme_phases as unknown[], saved.programme_working_pattern)?.end_date).toBe("2026-10-17");
        expect(viewForProject(saved, () => "key")).toMatchObject({ kind: "simple", draft: { workingPattern: pattern, duration: "2", unit: "days" } });
        expect(await saveSimpleProgrammeAction(PROJECT_ID, { ...input, expectedWorkingPattern: pattern })).toMatchObject({ success: true });
    });

    it("preserves legacy saves before migration but refuses calendar writes when its column is absent", async () => {
        const db = setup();
        const pattern = { version: 1 as const, weekdays: [1, 2, 3, 4, 5, 6] };
        expect(await saveSimpleProgrammeAction(PROJECT_ID, { ...whole, workingPattern: pattern, expectedWorkingPattern: null })).toEqual({ success: false, error: "Calendar storage is not set up for this job yet. Nothing was saved." });
        expect(db.updates).toHaveLength(0);
        expect(await saveSimpleProgrammeAction(PROJECT_ID, whole)).toEqual({ success: true });
        expect(db.updates[0].values).not.toHaveProperty("programme_working_pattern");
    });

    it("refuses malformed or unbound calendar requests before access, and stale legacy clients after opt-in", async () => {
        const pattern = { version: 1 as const, weekdays: [1, 2, 3, 4, 5, 6] };
        const db = setup({ programme_working_pattern: pattern });
        for (const input of [
            { ...whole, workingPattern: pattern },
            { ...whole, workingPattern: { version: 1, weekdays: [1, 1] }, expectedWorkingPattern: null },
        ]) expect((await saveSimpleProgrammeAction(PROJECT_ID, input as never)).success).toBe(false);
        expect(mocks.requireEditableProjectAccess).not.toHaveBeenCalled();
        expect((await saveSimpleProgrammeAction(PROJECT_ID, whole)).success).toBe(false);
        expect((await saveSimpleProgrammeAction(PROJECT_ID, { ...whole, workingPattern: pattern, expectedWorkingPattern: null })).success).toBe(false);
        expect(db.updates).toHaveLength(0);
    });

    it("keeps refused calendar saves unchanged and fences concurrent pattern changes", async () => {
        const pattern = { version: 1 as const, weekdays: [1, 2, 3, 4, 5, 6] };
        const input = { ...whole, workingPattern: pattern, expectedWorkingPattern: null };
        const db = setup({ programme_working_pattern: null });
        db.fail("projects", "update");
        expect((await saveSimpleProgrammeAction(PROJECT_ID, input)).success).toBe(false);
        expect(db.tables.projects[0].programme_working_pattern).toBeNull();
        expect(db.tables.projects[0].programme_phases).toEqual([]);
        const from = db.client.from;
        vi.spyOn(db.client, "from").mockImplementation(table => {
            const query = from(table), update = query.update;
            query.update = values => { db.tables.projects[0].programme_working_pattern = pattern; return update(values); };
            return query;
        });
        expect((await saveSimpleProgrammeAction(PROJECT_ID, input)).success).toBe(false);
        expect(db.tables.projects[0].programme_working_pattern).toEqual(pattern);
        expect(db.tables.projects[0].programme_phases).toEqual([]);
    });

    it("never confirms a calendar save whose returned row does not confirm the stored pattern", async () => {
        const pattern = { version: 1 as const, weekdays: [1, 2, 3, 4, 5, 6] };
        const db = setup({ programme_working_pattern: null }), from = db.client.from;
        vi.spyOn(db.client, "from").mockImplementation(table => {
            const query = from(table), update = query.update, single = query.single;
            let updating = false;
            query.update = values => { updating = true; return update(values); };
            query.single = async () => { const result = await single(); return updating && result.data
                ? { ...result, data: { ...result.data, programme_working_pattern: null } } : result; };
            return query;
        });
        const result = await saveSimpleProgrammeAction(PROJECT_ID, { ...whole, workingPattern: pattern, expectedWorkingPattern: null });
        expect(result).toEqual({ success: false, error: "The programme save wasn't confirmed and may already have saved. Reload Programme before retrying." });
        expect(db.tables.projects[0].programme_working_pattern).toEqual(pattern);
    });

    it("saves and reads relative stages without overwriting a project's separate start date", async () => {
        const db = setup({ start_date: MONDAY, programme_phases: established });
        const input = { timeBasis: "relative" as const, startDate: "", stages: [
            { name: "Prepare", workingDays: 3, unit: "days" as const, source: 0 },
            { name: "Install", workingDays: 5, unit: "weeks" as const, source: 1 },
        ] };
        expect(await saveSimpleProgrammeAction(PROJECT_ID, input)).toEqual({ success: true });
        expect(db.updates).toHaveLength(1);
        expect(db.updates[0].filters).toEqual({ id: PROJECT_ID, user_id: USER_ID, programme_phases: JSON.stringify(established) });
        expect(db.tables.projects[0].start_date).toBe(MONDAY);
        const saved = db.tables.projects[0].programme_phases as unknown[];
        expect(saved[1]).toMatchObject({ timeBasis: "relative_working_days", workingDayOffset: 3, color: "emerald", manhours: 80 });
        expect(computeDisplayProgramme(MONDAY, saved)).toMatchObject({ working_days: 8, stages: [{ start_day: 1, end_day: 3 }, { start_day: 4, end_day: 8 }] });
        expect(viewForProject({ start_date: MONDAY, programme_phases: saved }, () => "key")).toMatchObject({ kind: "simple", hasSaved: true, draft: { timeBasis: "relative" } });
        expect(await saveSimpleProgrammeAction(PROJECT_ID, { startDate: MONDAY, stages: input.stages })).toEqual({ success: true });
        const dated = db.tables.projects[0].programme_phases as Array<Record<string, unknown>>;
        expect(dated.every(p => !("timeBasis" in p) && !("workingDayOffset" in p))).toBe(true);
        expect(computeProgrammePlan(MONDAY, dated)).not.toBeNull();
    });

    it("retains existing phases on failed relative save and permits retry", async () => {
        const db = setup({ programme_phases: established });
        const input = { ...whole, timeBasis: "relative" as const, startDate: "" };
        db.fail("projects", "update", "57014");
        expect(await saveSimpleProgrammeAction(PROJECT_ID, input)).toEqual({ success: false, error: PROGRAMME_SAVE_ERROR });
        expect(db.tables.projects[0].programme_phases).toEqual(established);
        expect(await saveSimpleProgrammeAction(PROJECT_ID, input)).toEqual({ success: true });
    });

    it("keeps auth/lock checks and rejects ambiguous relative requests before access", async () => {
        const db = setup();
        expect((await saveSimpleProgrammeAction(PROJECT_ID, { ...whole, timeBasis: "relative" })).success).toBe(false);
        expect(mocks.requireEditableProjectAccess).not.toHaveBeenCalled();
        mocks.requireEditableProjectAccess.mockRejectedValue(new Error("Unauthorized project access."));
        expect((await saveSimpleProgrammeAction(PROJECT_ID, { ...whole, timeBasis: "relative", startDate: "" })).success).toBe(false);
        expect(db.updates).toEqual([]);
    });

    it("saves two contractor-named activities using existing owner-scoped phases and canonical dates", async () => {
        const db = setup({ start_date: MONDAY, programme_phases: established });
        const result = await saveSimpleProgrammeAction(PROJECT_ID, { startDate: MONDAY, stages: [
            { name: "Prepare", workingDays: 3, unit: "days", source: 0 },
            { name: "Install", workingDays: 5, unit: "weeks", source: 1 },
        ] });
        expect(result).toEqual({ success: true });
        expect(db.updates).toHaveLength(1);
        expect(db.updates[0].filters).toEqual({ id: PROJECT_ID, user_id: USER_ID, programme_phases: JSON.stringify(established) });
        expect(db.tables.projects[0].programme_phases).toEqual([
            { name: "Prepare", calculatedDays: 3, manualDays: 3, manhours: 24, startOffset: 0, color: "blue", duration_unit: "Days" },
            { name: "Install", calculatedDays: 10, manualDays: 5, manhours: 80, startOffset: 3, color: "emerald", duration_unit: "Weeks" },
        ]);
        expect(computeProgrammePlan(MONDAY, db.tables.projects[0].programme_phases as unknown[])).toMatchObject({ end_date: "2026-10-21", working_days: 8 });
    });

    it("saves a start date and one duration as a programme with one canonical end date", async () => {
        const db = setup();
        await expect(saveSimpleProgrammeAction(PROJECT_ID, whole)).resolves.toEqual({ success: true });

        const saved = db.tables.projects[0];
        expect(saved.start_date).toBe(MONDAY);
        expect(saved.programme_phases).toEqual([
            { name: "Works on site", calculatedDays: 15, manualDays: 15, manhours: 0, startOffset: 0, duration_unit: "Weeks" },
        ]);
        expect(computeProgrammePlan(MONDAY, saved.programme_phases as unknown[])).toMatchObject({ end_date: "2026-10-30", duration_label: "3 weeks" });
        // Scoped to the owner as well as the project.
        expect(db.updates[0].filters).toEqual({ id: PROJECT_ID, user_id: USER_ID, programme_phases: JSON.stringify([]) });
    });

    it("works out stage positions on the server, not from the request", async () => {
        const db = setup();
        await saveSimpleProgrammeAction(PROJECT_ID, {
            startDate: MONDAY,
            stages: [
                { name: "Strip out", workingDays: 5, unit: "weeks", source: null },
                { name: "First fix", workingDays: 8, unit: "days", source: null },
                { name: "Finishes", workingDays: 10, unit: "weeks", source: null },
            ],
        });
        expect((db.tables.projects[0].programme_phases as Array<{ startOffset: number }>).map((p) => p.startOffset)).toEqual([0, 7, 17]);
    });

    it("keeps the detailed planner's fields from the saved project when a stage changes", async () => {
        const db = setup({ start_date: MONDAY, programme_phases: established });
        await saveSimpleProgrammeAction(PROJECT_ID, {
            startDate: MONDAY,
            stages: [
                { name: "Strip out", workingDays: 5, unit: "weeks", source: 0 },
                { name: "First fix and plaster", workingDays: 15, unit: "weeks", source: 1 },
                { name: "Finishes", workingDays: 5, unit: "weeks", source: 2 },
            ],
        });
        const phases = db.tables.projects[0].programme_phases as Array<Record<string, unknown>>;
        expect(phases[1]).toMatchObject({ name: "First fix and plaster", calculatedDays: 10, manualDays: 15, manhours: 80, color: "emerald" });
        expect(phases[2]).toMatchObject({ color: "orange", manhours: 40, startOffset: 28 });
    });

    it("retains nothing from a failed save and succeeds on retry with the same input", async () => {
        const db = setup();
        db.fail("projects", "update", "57014");
        await expect(saveSimpleProgrammeAction(PROJECT_ID, whole)).resolves.toEqual({ success: false, error: PROGRAMME_SAVE_ERROR });
        expect(db.tables.projects[0].programme_phases).toEqual([]);
        expect(db.tables.projects[0].start_date).toBeNull();

        await expect(saveSimpleProgrammeAction(PROJECT_ID, whole)).resolves.toEqual({ success: true });
        expect(db.tables.projects[0].start_date).toBe(MONDAY);
    });

    it("reports a save that matched no row as failed", async () => {
        const db = setup();
        db.tables.projects[0].user_id = "someone-else";
        mocks.requireEditableProjectAccess.mockResolvedValue({ user: { id: USER_ID }, supabase: db.client });
        await expect(saveSimpleProgrammeAction(PROJECT_ID, whole)).resolves.toEqual({ success: false, error: PROGRAMME_SAVE_ERROR });
    });

    it("refuses once pre-contract information is locked, with the reason", async () => {
        const db = setup();
        mocks.requireEditableProjectAccess.mockRejectedValue(new Error("This proposal has been accepted. Record later scope or price changes as variations."));
        await expect(saveSimpleProgrammeAction(PROJECT_ID, whole)).resolves.toEqual({
            success: false,
            error: "This proposal has been accepted. Record later scope or price changes as variations.",
        });
        expect(db.updates).toEqual([]);
    });

    it("refuses another user's project without saying why", async () => {
        const db = setup();
        mocks.requireEditableProjectAccess.mockRejectedValue(new Error("Unauthorized project access."));
        await expect(saveSimpleProgrammeAction(PROJECT_ID, whole)).resolves.toEqual({ success: false, error: "You can't change this project's programme." });
        expect(db.log).toEqual([]);
    });

    it.each([
        ["a weekend start", { ...whole, startDate: "2026-10-17" }],
        ["a malformed date", { ...whole, startDate: "12/10/2026" }],
        ["an unnamed second stage", { startDate: MONDAY, stages: [whole.stages[0], { ...whole.stages[0], name: " " }] }],
        ["seven stages", { startDate: MONDAY, stages: Array.from({ length: 7 }, () => whole.stages[0]) }],
        ["no stages", { startDate: MONDAY, stages: [] }],
        ["a zero duration", { startDate: MONDAY, stages: [{ ...whole.stages[0], workingDays: 0 }] }],
        ["a fractional duration", { startDate: MONDAY, stages: [{ ...whole.stages[0], workingDays: 2.5 }] }],
        ["an unnamed stage", { startDate: MONDAY, stages: [{ ...whole.stages[0], name: "  " }] }],
    ])("rejects %s before touching the database", async (_label, input) => {
        const db = setup();
        const result = await saveSimpleProgrammeAction(PROJECT_ID, input as never);
        expect(result.success).toBe(false);
        expect(mocks.requireEditableProjectAccess).not.toHaveBeenCalled();
        expect(db.log).toEqual([]);
    });
});
