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
import { PROGRAMME_ADDED, PROGRAMME_NO_PHASES, PROGRAMME_NOT_SAVED, PROGRAMME_TOO_MANY } from "@/lib/cohort-ai/programme-update";
import { COHORT_AI_NOT_USABLE, COHORT_AI_OFF, COHORT_AI_UNAVAILABLE } from "@/lib/cohort-ai/shared";
import { AiResponseError } from "@/lib/ai";
import { generateWeeklyUpdateAction } from "./actions";

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
