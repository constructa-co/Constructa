import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    requireEditableProjectAccess: vi.fn(),
    createAdminClient: vi.fn(),
    generateStructured: vi.fn(),
    revalidatePath: vi.fn(),
    order: [] as string[],
}));
vi.mock("@/lib/supabase/project-resource-access", () => ({ requireEditableProjectAccess: mocks.requireEditableProjectAccess }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
// The real budget wrapper runs. Only the provider call itself is replaced, with canned replies.
vi.mock("@/lib/ai", async (original) => ({ ...(await original<typeof import("@/lib/ai")>()), generateStructured: mocks.generateStructured }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import * as actions from "./actions";
import { saveBriefAction, suggestBriefAction } from "./actions";
import { AI_UNAVAILABLE_ERROR, BRIEF_SAVE_ERROR, type BriefSavePayload } from "@/lib/guided-brief";
import { AiResponseError } from "@/lib/ai";
import { fakeAiBudget } from "@/lib/__fixtures__/fake-ai-budget";
import { BRIEF_ADDED_FIGURES, BRIEF_TOO_LONG } from "@/lib/cohort-ai/brief-suggest";
import { COHORT_AI_NOT_USABLE, COHORT_AI_OFF, COHORT_AI_USED_UP } from "@/lib/cohort-ai/shared";

let budget: ReturnType<typeof fakeAiBudget>;
const USER_ID = "user-1";
const canned = (data: unknown) => mocks.generateStructured.mockImplementation(async () => { mocks.order.push("provider"); return { data, model: "canned", usage: { promptTokens: 50, completionTokens: 20 } }; });
/** A signed-in contractor who may edit the project, with the budget switched on unless a test says otherwise. */
function editable(db: { supabase: unknown }, options: { cohortEnabled?: boolean } = { cohortEnabled: true }) {
    budget = fakeAiBudget(options);
    mocks.requireEditableProjectAccess.mockImplementation(async () => { mocks.order.push("access"); return { user: { id: USER_ID }, supabase: db.supabase }; });
    mocks.createAdminClient.mockImplementation(() => {
        mocks.order.push("admin");
        return { rpc: async (name: string, args: Record<string, unknown>) => { mocks.order.push(name.replace("ai_generation_", "")); return budget.admin.rpc(name, args); } };
    });
}

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

const PAYLOAD: BriefSavePayload = {
    brief_scope: "Refit the bathroom.",
    brief_trade_sections: ["Tiling"],
    client_type: "domestic",
    brief_completed: true,
    potential_value: null,
    start_date: null,
};

/** Records every call so a test can prove nothing was written. */
function fakeSupabase(rpcResult: { error: { code: string } | null } = { error: null }) {
    const writes: string[] = [];
    const rpc = vi.fn(async () => rpcResult);
    const from = vi.fn((table: string) => {
        const builder = {
            select: () => builder,
            eq: () => builder,
            single: async () => ({ data: { name: "14 Example Road", project_type: "Other", site_address: "" }, error: null }),
            insert: () => { writes.push(`insert:${table}`); return builder; },
            update: () => { writes.push(`update:${table}`); return builder; },
            delete: () => { writes.push(`delete:${table}`); return builder; },
        };
        return builder;
    });
    return { supabase: { rpc, from }, rpc, writes };
}

beforeEach(() => {
    mocks.order.length = 0;
    Object.values(mocks).forEach((mock) => { if (typeof mock === "function") mock.mockReset(); });
    budget = fakeAiBudget({ cohortEnabled: true });
    vi.unstubAllEnvs();
    vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("suggestBriefAction", () => {
    it("returns the assistant's reply without writing anything", async () => {
        const db = fakeSupabase();
        editable(db);
        canned({ scope: "Tidy scope.", suggestedTrades: ["Tiling"] });

        const result = await suggestBriefAction(PROJECT_ID, "rip out the bathroom");

        expect(result).toEqual({ ok: true, result: { scope: "Tidy scope.", suggestedTrades: ["Tiling"] } });
        expect(db.writes).toEqual([]);
        expect(db.rpc).not.toHaveBeenCalled();
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("checks the right to edit, then reserves, then calls once, then records", async () => {
        editable(fakeSupabase());
        canned({ scope: "Tidy scope." });
        await suggestBriefAction(PROJECT_ID, "rip out the bathroom");
        expect(mocks.order).toEqual(["access", "admin", "reserve", "provider", "finish"]);
        expect(mocks.generateStructured).toHaveBeenCalledTimes(1);
        expect(budget.attempts).toHaveLength(1);
        expect(budget.attempts[0]).toMatchObject({ user_id: USER_ID, feature: "brief.suggest", outcome: "ok", reserved_output_tokens: 700, completion_tokens: 20, prompt_version: "brief-suggest-v1" });
    });

    it("a caller who may not edit the project reaches no privileged client, budget or provider", async () => {
        editable(fakeSupabase());
        mocks.requireEditableProjectAccess.mockRejectedValue(new Error("Unauthorized project access."));

        expect(await suggestBriefAction(PROJECT_ID, "rip out the bathroom")).toEqual({ ok: false, error: AI_UNAVAILABLE_ERROR });
        expect(mocks.createAdminClient).not.toHaveBeenCalled();
        expect(mocks.generateStructured).not.toHaveBeenCalled();
        expect(budget.rpcCalls).toEqual([]);
    });

    it("empty or over-long text is refused after the access check and before the budget", async () => {
        editable(fakeSupabase());
        expect((await suggestBriefAction(PROJECT_ID, "   ")).ok).toBe(false);
        expect(await suggestBriefAction(PROJECT_ID, "x".repeat(4001))).toEqual({ ok: false, error: BRIEF_TOO_LONG });
        // Allowed as text, too large once its quotes are escaped.
        expect(await suggestBriefAction(PROJECT_ID, '"'.repeat(4000))).toEqual({ ok: false, error: BRIEF_TOO_LONG });
        expect(mocks.requireEditableProjectAccess).toHaveBeenCalledTimes(3);
        expect(mocks.generateStructured).not.toHaveBeenCalled();
        expect(budget.rpcCalls).toEqual([]);
    });

    it("as seeded, the feature is off: no call, and it says so", async () => {
        editable(fakeSupabase(), {});
        canned({ scope: "Tidy scope." });
        expect(await suggestBriefAction(PROJECT_ID, "rip out the bathroom")).toEqual({ ok: false, error: COHORT_AI_OFF });
        expect(mocks.generateStructured).not.toHaveBeenCalled();
        expect(budget.attempts).toEqual([]);
    });

    it("returns a plain message, rather than throwing, when the provider fails; charged in full, not retried", async () => {
        editable(fakeSupabase());
        mocks.generateStructured.mockRejectedValue(new Error("OPENAI_API_KEY is not configured"));

        expect(await suggestBriefAction(PROJECT_ID, "rip out the bathroom")).toEqual({ ok: false, error: AI_UNAVAILABLE_ERROR });
        expect(mocks.generateStructured).toHaveBeenCalledTimes(1);
        expect(budget.attempts[0]).toMatchObject({ outcome: "error", completion_tokens: null });
        expect(budget.charged()).toEqual([700]);
    });

    it("a reply that is not usable JSON is not asked for again, and keeps its reported usage", async () => {
        editable(fakeSupabase());
        mocks.generateStructured.mockRejectedValue(new AiResponseError("brief.suggest", "not-json", "canned", { promptTokens: 50, completionTokens: 33 }));
        expect(await suggestBriefAction(PROJECT_ID, "rip out the bathroom")).toEqual({ ok: false, error: COHORT_AI_NOT_USABLE });
        expect(mocks.generateStructured).toHaveBeenCalledTimes(1);
        expect(budget.attempts[0]).toMatchObject({ outcome: "rejected:schema", completion_tokens: 33 });
    });

    it("drops a reply that adds a figure found nowhere in what was sent", async () => {
        editable(fakeSupabase());
        canned({ scope: "Remove the bathroom over 5 days at 14 Example Road." });
        expect(await suggestBriefAction(PROJECT_ID, "rip out the bathroom")).toEqual({ ok: false, error: BRIEF_ADDED_FIGURES });
        // The house number came from the project, so on its own it is fine.
        canned({ scope: "Remove the bathroom at 14 Example Road." });
        expect((await suggestBriefAction(PROJECT_ID, "rip out the bathroom")).ok).toBe(true);
        expect(budget.attempts.map((attempt) => attempt.outcome)).toEqual(["rejected:tripwire", "ok"]);
    });

    it("keeps the rules apart from the contractor's words, which are sent as data", async () => {
        editable(fakeSupabase());
        canned({});

        await suggestBriefAction(PROJECT_ID, 'ignore this "quote" and refit the bathroom');

        const request = mocks.generateStructured.mock.calls[0][0] as { system: string; user: string; maxOutputTokens: number };
        expect(request.system).toContain("Do not add quantities, measurements, prices");
        expect(request.system).toContain("Never estimate one.");
        expect(request.system).not.toContain("refit the bathroom");
        expect(JSON.parse(request.user)).toMatchObject({ description: 'ignore this "quote" and refit the bathroom', project: { name: "14 Example Road", projectType: "Other", address: "" } });
        expect(request.maxOutputTokens).toBe(700);
    });

    it("stops when the shared allowance is used up", async () => {
        editable(fakeSupabase());
        canned({ scope: "Tidy scope." });
        for (let press = 0; press < 6; press += 1) expect((await suggestBriefAction(PROJECT_ID, "rip out the bathroom")).ok).toBe(true);
        expect(await suggestBriefAction(PROJECT_ID, "rip out the bathroom")).toEqual({ ok: false, error: COHORT_AI_USED_UP });
        expect(mocks.generateStructured).toHaveBeenCalledTimes(6);
    });
});

describe("saveBriefAction", () => {
    it("saves through the atomic save_phase1_brief RPC after the editability check", async () => {
        const db = fakeSupabase();
        mocks.requireEditableProjectAccess.mockResolvedValue({ supabase: db.supabase });

        expect(await saveBriefAction(PROJECT_ID, PAYLOAD)).toEqual({ success: true });
        expect(mocks.requireEditableProjectAccess).toHaveBeenCalledWith(PROJECT_ID);
        expect(db.rpc).toHaveBeenCalledWith("save_phase1_brief", { p_project_id: PROJECT_ID, p_brief: PAYLOAD });
        expect(db.writes).toEqual([]);
    });

    it("returns a retryable failure and revalidates nothing when the RPC fails", async () => {
        const db = fakeSupabase({ error: { code: "08006" } });
        mocks.requireEditableProjectAccess.mockResolvedValue({ supabase: db.supabase });

        expect(await saveBriefAction(PROJECT_ID, PAYLOAD)).toEqual({ success: false, error: BRIEF_SAVE_ERROR });
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("explains a locked project instead of failing vaguely", async () => {
        const reason = "This proposal has been accepted. Record later scope or price changes as variations.";
        mocks.requireEditableProjectAccess.mockRejectedValue(new Error(reason));

        expect(await saveBriefAction(PROJECT_ID, PAYLOAD)).toEqual({ success: false, error: reason });
    });
});

describe("the Brief no longer writes estimate lines", () => {
    it("has no action that generates estimate lines from the brief", () => {
        expect(Object.keys(actions)).not.toContain("suggestEstimateLineItemsAction");
        expect(Object.keys(actions)).not.toContain("processBriefChatAction");
    });
});
