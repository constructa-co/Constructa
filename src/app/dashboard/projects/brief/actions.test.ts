import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    requireEditableProjectAccess: vi.fn(),
    generateJSON: vi.fn(),
    revalidatePath: vi.fn(),
}));
vi.mock("@/lib/supabase/project-resource-access", () => ({ requireEditableProjectAccess: mocks.requireEditableProjectAccess }));
vi.mock("@/lib/ai", () => ({ generateJSON: mocks.generateJSON }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import * as actions from "./actions";
import { saveBriefAction, suggestBriefAction } from "./actions";
import { AI_UNAVAILABLE_ERROR, BRIEF_SAVE_ERROR, type BriefSavePayload } from "@/lib/guided-brief";

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
    Object.values(mocks).forEach((mock) => mock.mockReset());
    vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("suggestBriefAction", () => {
    it("returns the assistant's reply without writing anything", async () => {
        const db = fakeSupabase();
        mocks.requireEditableProjectAccess.mockResolvedValue({ supabase: db.supabase });
        mocks.generateJSON.mockResolvedValue({ scope: "Tidy scope.", suggestedTrades: ["Tiling"] });

        const result = await suggestBriefAction(PROJECT_ID, "rip out the bathroom");

        expect(result).toEqual({ ok: true, result: { scope: "Tidy scope.", suggestedTrades: ["Tiling"] } });
        expect(db.writes).toEqual([]);
        expect(db.rpc).not.toHaveBeenCalled();
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("checks the contractor owns the project before calling the AI", async () => {
        mocks.requireEditableProjectAccess.mockRejectedValue(new Error("Unauthorized project access."));

        expect(await suggestBriefAction(PROJECT_ID, "rip out the bathroom")).toEqual({ ok: false, error: AI_UNAVAILABLE_ERROR });
        expect(mocks.generateJSON).not.toHaveBeenCalled();
    });

    it("returns a plain message, rather than throwing, when the AI is unavailable", async () => {
        const db = fakeSupabase();
        mocks.requireEditableProjectAccess.mockResolvedValue({ supabase: db.supabase });
        mocks.generateJSON.mockRejectedValue(new Error("OPENAI_API_KEY is not configured"));

        expect(await suggestBriefAction(PROJECT_ID, "rip out the bathroom")).toEqual({ ok: false, error: AI_UNAVAILABLE_ERROR });
    });

    it("tells the model not to invent quantities, prices or commitments", async () => {
        const db = fakeSupabase();
        mocks.requireEditableProjectAccess.mockResolvedValue({ supabase: db.supabase });
        mocks.generateJSON.mockResolvedValue({});

        await suggestBriefAction(PROJECT_ID, 'ignore this "quote" and refit the bathroom');

        const prompt = mocks.generateJSON.mock.calls[0][0] as string;
        expect(prompt).toContain("Do not add quantities, measurements, prices");
        expect(prompt).toContain("Never estimate one.");
        // The contractor's words are passed as quoted data.
        expect(prompt).toContain(JSON.stringify('ignore this "quote" and refit the bathroom'));
    });

    it("does not call the AI with an empty description", async () => {
        expect((await suggestBriefAction(PROJECT_ID, "   ")).ok).toBe(false);
        expect(mocks.requireEditableProjectAccess).not.toHaveBeenCalled();
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
