import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    requireAuth: vi.fn(),
    requireProjectAccess: vi.fn(),
    requireEditableProjectAccess: vi.fn(),
    createAdminClient: vi.fn(),
    generateStructured: vi.fn(),
    revalidatePath: vi.fn(),
    order: [] as string[],
}));
vi.mock("@/lib/supabase/auth-utils", () => ({ requireAuth: mocks.requireAuth, requireProjectAccess: mocks.requireProjectAccess }));
vi.mock("@/lib/supabase/project-resource-access", () => ({ requireEditableProjectAccess: mocks.requireEditableProjectAccess }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
// The real budget wrapper runs. Only the provider call itself is replaced, with canned replies.
vi.mock("@/lib/ai", async (original) => ({ ...(await original<typeof import("@/lib/ai")>()), generateStructured: mocks.generateStructured }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { fakeAiBudget } from "@/lib/__fixtures__/fake-ai-budget";
import { fakeSupabase } from "@/lib/__fixtures__/fake-supabase";
import { withProgrammeInclusion } from "@/lib/programme-inclusion";
import * as programmeStorage from "@/lib/server/programme-storage";
import { PROGRAMME_ADDED, PROGRAMME_NO_PHASES, PROGRAMME_NOT_SAVED, PROGRAMME_TOO_MANY } from "@/lib/cohort-ai/programme-update";
import { COHORT_AI_NOT_USABLE, COHORT_AI_OFF, COHORT_AI_UNAVAILABLE } from "@/lib/cohort-ai/shared";
import { AiResponseError } from "@/lib/ai";
import { generateWeeklyUpdateAction, saveProgrammePhasesAction, updatePhasesAction } from "./actions";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const PHASES = [
    { name: "Groundworks", pct_complete: 100, actual_start_date: "2026-09-07", actual_finish_date: "2026-09-18", manualDays: 10, startOffset: 0 },
    { name: "Brickwork", pct_complete: 40, actual_start_date: "2026-09-21", manualDays: 15, startOffset: 14 },
    { name: "Roofing", pct_complete: 0, manualDays: 5, startOffset: 35 },
];
const GOOD = "Work at 14 Example Road is 47% complete overall. Groundworks is complete. Brickwork is 40% complete. Roofing has not started.";

let budget: ReturnType<typeof fakeAiBudget>;
let inserts: Array<{ table: string; rows: unknown }>;
let insertError: { code: string } | null;
let project: Record<string, unknown> | null;

const canned = (update: string) => mocks.generateStructured.mockImplementation(async () => { mocks.order.push("provider"); return { data: { update }, model: "canned", usage: { promptTokens: 120, completionTokens: 60 } }; });

function arrange(options: { cohortEnabled?: boolean } = { cohortEnabled: true }) {
    budget = fakeAiBudget(options);
    const supabase = {
        from: (table: string) => ({
            select: () => ({ eq: () => ({ single: async () => { mocks.order.push("read"); return { data: project, error: null }; } }) }),
            insert: async (rows: unknown) => { mocks.order.push("insert"); inserts.push({ table, rows }); return { error: insertError }; },
        }),
    };
    mocks.requireProjectAccess.mockImplementation(async () => { mocks.order.push("access"); return { user: { id: "user-1" }, supabase }; });
    mocks.createAdminClient.mockImplementation(() => {
        mocks.order.push("admin");
        return { rpc: async (name: string, args: Record<string, unknown>) => { mocks.order.push(name.replace("ai_generation_", "")); return budget.admin.rpc(name, args); } };
    });
}

describe("generateWeeklyUpdateAction", () => {
    beforeEach(() => {
        mocks.order.length = 0;
        Object.values(mocks).forEach((mock) => { if (typeof mock === "function") mock.mockReset(); });
        inserts = [];
        insertError = null;
        project = { name: "14 Example Road", client_name: "Mrs Patel", start_date: "2026-09-07", programme_phases: PHASES };
        arrange();
        canned(GOOD);
        vi.unstubAllEnvs();
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    it("checks ownership, reserves, calls once, records, and only then stores the validated update", async () => {
        await expect(generateWeeklyUpdateAction(PROJECT_ID)).resolves.toBe(GOOD);
        expect(mocks.order).toEqual(["access", "read", "admin", "reserve", "provider", "finish", "insert"]);
        expect(mocks.generateStructured).toHaveBeenCalledTimes(1);
        expect(budget.attempts[0]).toMatchObject({ user_id: "user-1", feature: "schedule.programme-update", outcome: "ok", reserved_output_tokens: 900, completion_tokens: 60 });
        // Stored beside the stages exactly as they were read and sent, not a tidied copy.
        expect(inserts).toEqual([{ table: "programme_updates", rows: [{ project_id: PROJECT_ID, narrative: GOOD, phases_snapshot: PHASES }] }]);
        expect(mocks.revalidatePath).toHaveBeenCalledTimes(1);
    });

    it("someone who does not own the project reaches nothing", async () => {
        mocks.requireProjectAccess.mockRejectedValue(new Error("Unauthorized project access."));
        await expect(generateWeeklyUpdateAction(PROJECT_ID)).rejects.toThrow("Unauthorized project access.");
        expect(mocks.createAdminClient).not.toHaveBeenCalled();
        expect(mocks.generateStructured).not.toHaveBeenCalled();
        expect(budget.rpcCalls).toEqual([]);
        expect(inserts).toEqual([]);
    });

    it("sends bounded facts as data, apart from the rules", async () => {
        await generateWeeklyUpdateAction(PROJECT_ID);
        const request = mocks.generateStructured.mock.calls[0][0] as { system: string; user: string; maxOutputTokens: number };
        const sent = JSON.parse(request.user);
        expect(sent).toMatchObject({ project: "14 Example Road", client: "Mrs Patel", overallCompletion: "47%" });
        expect(sent.stages).toEqual([
            { name: "Groundworks", status: "Complete", started: "7 September 2026", finished: "18 September 2026" },
            { name: "Brickwork", status: "40% complete", started: "21 September 2026" },
            { name: "Roofing", status: "Not started" },
        ]);
        expect(request.system).not.toContain("Groundworks");
        expect(request.maxOutputTokens).toBe(900);
    });

    it.each([
        ["no stages", [], PROGRAMME_NO_PHASES],
        ["too many stages", Array.from({ length: 41 }, (_, index) => ({ name: `Stage ${index}` })), PROGRAMME_TOO_MANY],
        ["a stage name too long to send whole", [{ name: "x".repeat(121) }], PROGRAMME_TOO_MANY],
        ["stages too large once encoded", Array.from({ length: 40 }, () => ({ name: '"'.repeat(120), pct_complete: 50 })), PROGRAMME_TOO_MANY],
    ])("%s: refused before the budget, nothing stored", async (_label, phases, message) => {
        project = { ...project, programme_phases: phases };
        await expect(generateWeeklyUpdateAction(PROJECT_ID)).rejects.toThrow(message);
        expect(mocks.generateStructured).not.toHaveBeenCalled();
        expect(budget.rpcCalls).toEqual([]);
        expect(inserts).toEqual([]);
    });

    it("an update with a figure or date that was not supplied is refused, charged, and never stored", async () => {
        canned("Work is 60% complete and we expect to finish by 30 November 2026.");
        await expect(generateWeeklyUpdateAction(PROJECT_ID)).rejects.toThrow(PROGRAMME_ADDED);
        expect(budget.attempts[0]).toMatchObject({ outcome: "rejected:tripwire", completion_tokens: 60 });
        expect(inserts).toEqual([]);
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("an unusable or failed reply is not retried and never stored", async () => {
        mocks.generateStructured.mockRejectedValue(new AiResponseError("schedule.programme-update", "cut-off", "canned", { promptTokens: 120, completionTokens: 900 }));
        await expect(generateWeeklyUpdateAction(PROJECT_ID)).rejects.toThrow(COHORT_AI_NOT_USABLE);
        mocks.generateStructured.mockRejectedValue(new Error("timeout"));
        await expect(generateWeeklyUpdateAction(PROJECT_ID)).rejects.toThrow(COHORT_AI_UNAVAILABLE);
        expect(mocks.generateStructured).toHaveBeenCalledTimes(2);
        expect(budget.attempts.map((attempt) => attempt.outcome)).toEqual(["rejected:schema", "error"]);
        expect(budget.charged()).toEqual([900, 900]);
        expect(inserts).toEqual([]);
    });

    it("as seeded, the feature is off: no call, nothing stored, and it says so", async () => {
        arrange({});
        await expect(generateWeeklyUpdateAction(PROJECT_ID)).rejects.toThrow(COHORT_AI_OFF);
        expect(mocks.generateStructured).not.toHaveBeenCalled();
        expect(inserts).toEqual([]);
    });

    it("if the update cannot be stored it says so, and does not claim it was saved", async () => {
        insertError = { code: "42501" };
        await expect(generateWeeklyUpdateAction(PROJECT_ID)).rejects.toThrow(PROGRAMME_NOT_SAVED);
        // The call was made and is recorded; the screen is told the truth about the save.
        expect(budget.attempts[0]).toMatchObject({ outcome: "ok" });
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("without the server's own client there is no call", async () => {
        mocks.createAdminClient.mockImplementation(() => { throw new Error("SUPABASE_SERVICE_ROLE_KEY missing"); });
        await expect(generateWeeklyUpdateAction(PROJECT_ID)).rejects.toThrow(COHORT_AI_UNAVAILABLE);
        expect(mocks.generateStructured).not.toHaveBeenCalled();
        expect(inserts).toEqual([]);
    });
});

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SIX_DAYS = { version: 1, weekdays: [1, 2, 3, 4, 5, 6] };
const DETAILED_PHASES = [{ name: "Works", calculatedDays: 2, manualDays: null, manhours: 16, startOffset: 0, color: "emerald" }];

function arrangeProgramme(overrides: Record<string, unknown> = {}) {
    const db = fakeSupabase({ projects: [{
        id: PROJECT_ID, user_id: USER_ID, start_date: "2026-10-16", programme_phases: DETAILED_PHASES, ...overrides,
    }] });
    const access = { user: { id: USER_ID }, supabase: db.client };
    mocks.requireProjectAccess.mockResolvedValue(access);
    mocks.requireEditableProjectAccess.mockResolvedValue(access);
    return db;
}

describe("detailed programme calendar storage", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
    });

    it("saves and regenerates on the stored custom calendar, comparing weekday sets rather than their order", async () => {
        const db = arrangeProgramme({ programme_working_pattern: SIX_DAYS });
        const next = [{ ...DETAILED_PHASES[0], manualDays: 3 }];
        const expected = { version: 1, weekdays: [6, 5, 4, 3, 2, 1] };
        expect(await updatePhasesAction(PROJECT_ID, next, undefined, expected)).toEqual({ success: true });
        await expect(saveProgrammePhasesAction(PROJECT_ID, DETAILED_PHASES, expected)).resolves.toBeUndefined();
        expect(db.updates).toHaveLength(2);
        expect(db.updates[0].filters).toEqual({
            id: PROJECT_ID, user_id: USER_ID, programme_phases: JSON.stringify(DETAILED_PHASES),
            programme_working_pattern: JSON.stringify(SIX_DAYS),
        });
        expect(db.updates[1].filters.programme_phases).toBe(JSON.stringify(next));
        for (const update of db.updates) expect(update.values).not.toHaveProperty("programme_working_pattern");
        expect(db.tables.projects[0].programme_working_pattern).toEqual(SIX_DAYS);
        expect(db.tables.projects[0].programme_phases).toEqual(DETAILED_PHASES);
    });

    it.each(["matching", "mismatched"])("regenerates phases and start date in one guarded write with %s start readback", async readback => {
        const db = arrangeProgramme({ programme_working_pattern: SIX_DAYS }), from = db.client.from;
        const startDate = "2026-10-19";
        const phases = [{ ...DETAILED_PHASES[0], manualDays: 5 },
            { ...DETAILED_PHASES[0], name: "Finish", calculatedDays: 1, manualDays: 1, startOffset: 5 }];
        const selections: Array<string | undefined> = [];
        vi.spyOn(db.client, "from").mockImplementation(table => {
            const query = from(table), select = query.select, update = query.update, single = query.single;
            let updating = false;
            query.select = (columns?: string) => { selections.push(columns); return select(); };
            query.update = values => { updating = true; return update(values); };
            query.single = async () => {
                const result = await single();
                return updating && readback === "mismatched" && result.data
                    ? { ...result, data: { ...result.data, start_date: "2026-10-16" } } : result;
            };
            return query;
        });
        const result = saveProgrammePhasesAction(PROJECT_ID, phases, SIX_DAYS, startDate);
        if (readback === "matching") await expect(result).resolves.toBeUndefined();
        else await expect(result).rejects.toThrow(programmeStorage.PROGRAMME_CHOICE_UNCONFIRMED);
        expect(db.log).toEqual(["select:projects", "update:projects"]);
        expect(db.updates).toEqual([{ table: "projects", values: { programme_phases: phases, start_date: startDate }, filters: {
            id: PROJECT_ID, user_id: USER_ID, programme_phases: JSON.stringify(DETAILED_PHASES),
            programme_working_pattern: JSON.stringify(SIX_DAYS),
        } }]);
        expect(selections).toEqual(["*", "programme_phases,programme_working_pattern,start_date"]);
        expect(db.tables.projects[0]).toMatchObject({ programme_phases: phases, start_date: startDate, programme_working_pattern: SIX_DAYS });
        expect(mocks.revalidatePath).toHaveBeenCalledTimes(readback === "matching" ? 1 : 0);
    });

    it.each(["", "19/10/2026"])("refuses a malformed supplied regeneration date %j before storage", async startDate => {
        const db = arrangeProgramme();
        await expect(saveProgrammePhasesAction(PROJECT_ID, DETAILED_PHASES, undefined, startDate)).rejects.toThrow();
        expect(db.log).toEqual([]);
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it.each([
        ["stale default expectation", SIX_DAYS, null],
        ["stale custom expectation", null, SIX_DAYS],
        ["invalid stored pattern", { version: 1, weekdays: [] }, null],
        ["invalid expectation", SIX_DAYS, { version: 1, weekdays: [1, 1] }],
        ["unknown expectation keys", SIX_DAYS, { ...SIX_DAYS, extra: true }],
    ])("refuses %s in both action entry points without writing", async (_label, stored, expected) => {
        const db = arrangeProgramme({ programme_working_pattern: stored });
        expect((await updatePhasesAction(PROJECT_ID, DETAILED_PHASES, undefined, expected)).success).toBe(false);
        await expect(saveProgrammePhasesAction(PROJECT_ID, DETAILED_PHASES, expected)).rejects.toThrow();
        expect(db.updates).toEqual([]);
        expect(db.tables.projects[0].programme_phases).toEqual(DETAILED_PHASES);
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("keeps old action request shapes and legacy saves when the calendar column is absent", async () => {
        const db = arrangeProgramme({ start_date: null });
        const write = vi.spyOn(programmeStorage, "writeProgrammeStorage");
        expect(await updatePhasesAction(PROJECT_ID, DETAILED_PHASES)).toEqual({ success: true });
        expect(write).toHaveBeenLastCalledWith(db.client, USER_ID, PROJECT_ID, { phases: DETAILED_PHASES, startDate: undefined });
        await saveProgrammePhasesAction(PROJECT_ID, DETAILED_PHASES);
        expect(write).toHaveBeenLastCalledWith(db.client, USER_ID, PROJECT_ID, { phases: DETAILED_PHASES });
        for (const update of db.updates) {
            expect(update.filters).not.toHaveProperty("programme_working_pattern");
            expect(update.values).not.toHaveProperty("programme_working_pattern");
        }
    });

    it("reads * before migration and only phases on readback, with explicit default expectations", async () => {
        const db = arrangeProgramme(), from = db.client.from, selections: Array<string | undefined> = [];
        vi.spyOn(db.client, "from").mockImplementation(table => {
            const query = from(table), select = query.select;
            query.select = (columns?: string) => { selections.push(columns); return select(); };
            return query;
        });
        expect(await updatePhasesAction(PROJECT_ID, DETAILED_PHASES, undefined, null)).toEqual({ success: true });
        expect(selections).toEqual(["*", "programme_phases"]);
        expect(db.tables.projects[0]).not.toHaveProperty("programme_working_pattern");
    });

    it("uses an incoming start date before the stored start and fences a null stored pattern", async () => {
        const db = arrangeProgramme({ start_date: null, programme_working_pattern: null });
        const expected = { version: 1, weekdays: [5, 4, 3, 2, 1] };
        expect(await updatePhasesAction(PROJECT_ID, DETAILED_PHASES, "2026-10-19", expected)).toEqual({ success: true });
        expect(db.updates[0].filters.programme_working_pattern).toBeNull();
        expect(db.tables.projects[0].start_date).toBe("2026-10-19");
        expect(db.tables.projects[0].programme_working_pattern).toBeNull();
    });

    it.each([
        ["empty", []],
        ["partial", [...DETAILED_PHASES, { name: "Missing duration", calculatedDays: 0, manualDays: null, manhours: 0, startOffset: 2 }]],
        ["truncated", Array.from({ length: 201 }, () => ({ ...DETAILED_PHASES[0] }))],
    ])("requires a complete incoming plan, not the valid old plan: %s", async (_label, phases) => {
        const db = arrangeProgramme({ programme_working_pattern: SIX_DAYS });
        await expect(saveProgrammePhasesAction(PROJECT_ID, phases, SIX_DAYS)).rejects.toThrow();
        expect(db.updates).toEqual([]);
        expect(db.tables.projects[0].programme_phases).toEqual(DETAILED_PHASES);
    });

    it("does not accept an explicitly bound dated plan without a usable start", async () => {
        const db = arrangeProgramme({ start_date: null });
        expect((await updatePhasesAction(PROJECT_ID, DETAILED_PHASES, undefined, null)).success).toBe(false);
        expect(db.updates).toEqual([]);
    });

    it("preserves relative phases, unrelated project start and omission while validating incoming activities", async () => {
        const db = arrangeProgramme({ programme_working_pattern: SIX_DAYS, programme_phases: withProgrammeInclusion(DETAILED_PHASES, false) });
        const relative = [{ name: "Undated works", manualDays: 6, timeBasis: "relative_working_days", workingDayOffset: 0 }];
        await saveProgrammePhasesAction(PROJECT_ID, relative, SIX_DAYS);
        expect(db.tables.projects[0].programme_phases).toEqual(withProgrammeInclusion(relative, false));
        expect(db.tables.projects[0].start_date).toBe("2026-10-16");
        expect(db.updates[0].values).not.toHaveProperty("start_date");
    });

    it("keeps accepted-job operational autosave available without allowing calendar-unaware planning changes", async () => {
        const db = arrangeProgramme({ programme_working_pattern: SIX_DAYS, programme_phases: withProgrammeInclusion(DETAILED_PHASES, false) });
        mocks.requireEditableProjectAccess.mockRejectedValue(new Error("Accepted job is locked"));
        const tracking = [{ ...DETAILED_PHASES[0], pct_complete: 50, actual_start_date: "2026-10-17", actual_finish_date: null }];
        expect(await updatePhasesAction(PROJECT_ID, tracking, "2026-10-16")).toEqual({ success: true });
        expect(mocks.requireEditableProjectAccess).not.toHaveBeenCalled();
        expect(db.tables.projects[0].programme_phases).toEqual(withProgrammeInclusion(tracking, false));
        expect(db.tables.projects[0].programme_working_pattern).toEqual(SIX_DAYS);
        expect((await updatePhasesAction(PROJECT_ID, [{ ...tracking[0], startOffset: 1 }])).success).toBe(false);
        expect((await updatePhasesAction(PROJECT_ID, tracking, "2026-10-19")).success).toBe(false);
        expect(db.updates).toHaveLength(1);
    });

    it.each([
        ["duration", [{ ...DETAILED_PHASES[0], manualDays: 5 }]],
        ["dependencies", [{ ...DETAILED_PHASES[0], dependsOn: [1] }]],
        ["renaming", [{ ...DETAILED_PHASES[0], name: "Regenerated work" }]],
        ["lost planning metadata", [{ name: "Works", calculatedDays: 2, manualDays: null, manhours: 16, startOffset: 0 }]],
        ["added activities", [...DETAILED_PHASES, { ...DETAILED_PHASES[0], name: "Extra" }]],
        ["unknown planning fields", [{ ...DETAILED_PHASES[0], frozen: true }]],
    ])("rejects legacy custom-calendar planning overwrite: %s", async (_label, phases) => {
        const db = arrangeProgramme({ programme_working_pattern: SIX_DAYS });
        await expect(saveProgrammePhasesAction(PROJECT_ID, phases)).rejects.toThrow();
        expect(db.updates).toEqual([]);
    });

    it("keeps legacy as-built tracking and JSON-omitted optional fields without demanding a dated plan", async () => {
        const db = arrangeProgramme({ start_date: null, programme_working_pattern: SIX_DAYS });
        const access = await mocks.requireProjectAccess(PROJECT_ID);
        const tracking = [{ ...DETAILED_PHASES[0], pct_complete: 25, actual_start_date: undefined,
            revised_planned_finish: "2026-10-29", delay_reason: "Weather", delay_notes: "Observed on site" }];
        await expect(programmeStorage.writeProgrammeStorage(access.supabase, USER_ID, PROJECT_ID, { phases: tracking }))
            .resolves.toStrictEqual(JSON.parse(JSON.stringify(tracking)));
        expect(db.tables.projects[0].programme_working_pattern).toEqual(SIX_DAYS);
    });

    it.each(["programme_phases", "programme_working_pattern"])("refuses a concurrent %s change, including raw weekday reordering", async column => {
        const db = arrangeProgramme({ programme_working_pattern: SIX_DAYS }), from = db.client.from;
        const newer = column === "programme_phases" ? [{ ...DETAILED_PHASES[0], name: "Newer work" }]
            : { version: 1, weekdays: [6, 5, 4, 3, 2, 1] };
        vi.spyOn(db.client, "from").mockImplementation(table => {
            const query = from(table), update = query.update;
            query.update = values => { db.tables.projects[0][column] = newer; return update(values); };
            return query;
        });
        expect((await updatePhasesAction(PROJECT_ID, [{ ...DETAILED_PHASES[0], manualDays: 3 }], undefined, SIX_DAYS)).success).toBe(false);
        expect(db.tables.projects[0][column]).toEqual(newer);
        if (column === "programme_working_pattern") expect(db.tables.projects[0].programme_phases).toEqual(DETAILED_PHASES);
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it.each(["phases", "pattern", "missing pattern"])("does not confirm a misleading %s readback", async mismatch => {
        const db = arrangeProgramme({ programme_working_pattern: SIX_DAYS }), from = db.client.from;
        const next = [{ ...DETAILED_PHASES[0], manualDays: 3 }];
        const selections: Array<string | undefined> = [];
        vi.spyOn(db.client, "from").mockImplementation(table => {
            const query = from(table), update = query.update, single = query.single, select = query.select;
            let updating = false;
            query.select = (columns?: string) => { selections.push(columns); return select(); };
            query.update = values => { updating = true; return update(values); };
            query.single = async () => {
                const result = await single();
                if (!updating || !result.data) return result;
                const data = { ...result.data };
                if (mismatch === "phases") data.programme_phases = DETAILED_PHASES;
                else if (mismatch === "pattern") data.programme_working_pattern = null;
                else delete data.programme_working_pattern;
                return { ...result, data };
            };
            return query;
        });
        await expect(saveProgrammePhasesAction(PROJECT_ID, next, SIX_DAYS)).rejects.toThrow(programmeStorage.PROGRAMME_CHOICE_UNCONFIRMED);
        expect(selections).toEqual(["*", "programme_phases,programme_working_pattern"]);
        expect(db.tables.projects[0].programme_phases).toEqual(next);
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("does not confirm a supplied start date whose readback differs", async () => {
        const db = arrangeProgramme({ programme_working_pattern: SIX_DAYS }), from = db.client.from;
        const selections: Array<string | undefined> = [];
        vi.spyOn(db.client, "from").mockImplementation(table => {
            const query = from(table), update = query.update, single = query.single, select = query.select;
            let updating = false;
            query.select = (columns?: string) => { selections.push(columns); return select(); };
            query.update = values => { updating = true; return update(values); };
            query.single = async () => {
                const result = await single();
                return updating && result.data ? { ...result, data: { ...result.data, start_date: "2026-10-16" } } : result;
            };
            return query;
        });
        expect((await updatePhasesAction(PROJECT_ID, DETAILED_PHASES, "2026-10-19", SIX_DAYS)).success).toBe(false);
        expect(selections).toEqual(["*", "programme_phases,programme_working_pattern,start_date"]);
        expect(db.tables.projects[0].start_date).toBe("2026-10-19");
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("keeps inclusion-only writes independent of calendar and plan validity", async () => {
        const invalid = { version: 1, weekdays: [] };
        const db = arrangeProgramme({ start_date: null, programme_working_pattern: invalid });
        const access = await mocks.requireProjectAccess(PROJECT_ID);
        await programmeStorage.writeProgrammeStorage(access.supabase, USER_ID, PROJECT_ID, { include: false });
        expect(db.tables.projects[0].programme_phases).toEqual(withProgrammeInclusion(DETAILED_PHASES, false));
        expect(db.tables.projects[0].programme_working_pattern).toEqual(invalid);
        expect(db.updates[0].filters.programme_working_pattern).toBe(JSON.stringify(invalid));
    });

    it("retains regenerate edit locks and autosave ownership checks before storage", async () => {
        const db = arrangeProgramme();
        mocks.requireEditableProjectAccess.mockRejectedValue(new Error("Accepted job is locked"));
        await expect(saveProgrammePhasesAction(PROJECT_ID, DETAILED_PHASES, null)).rejects.toThrow("Accepted job is locked");
        mocks.requireProjectAccess.mockRejectedValue(new Error("Unauthorized project access."));
        await expect(updatePhasesAction(PROJECT_ID, DETAILED_PHASES, undefined, null)).rejects.toThrow("Unauthorized project access.");
        expect(db.log).toEqual([]);
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });
});
