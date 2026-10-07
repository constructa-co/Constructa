/**
 * Everything the AI-wording flow needs, in memory: the interview's tables,
 * the AI budget's ledger, and a CANNED generator standing in for the
 * provider. Used by the unit tests, the evaluation harness and the browser
 * fixture harness. No provider, no network, no database.
 *
 * The canned generator returns whatever reply it has been given. It says
 * nothing about what a real model would write.
 */

import { AiResponseError } from "@/lib/ai";
import { fakeAiBudget } from "@/lib/__fixtures__/fake-ai-budget";
import { fakeInterviewDb } from "./fake-db";
import { saveAnswer } from "../service";
import type { WordingContext } from "../ai-wording";

export const RIG_USER = "aaaaaaaa-0000-4000-8000-000000000001";
export const RIG_NOW = () => Date.parse("2026-10-09T09:00:00.000Z");
export const CANNED_USAGE = { promptTokens: 400, completionTokens: 120 };

export type CannedReply =
    /** A reply with this text. */
    | { text: string; usage?: { promptTokens: number; completionTokens: number }; during?: () => void | Promise<void> }
    /** The provider gives nothing back. */
    | { error: true; during?: () => void | Promise<void> }
    /** A reply that is not usable JSON, with or without reported usage. */
    | { invalid: true; usage: { promptTokens: number; completionTokens: number } | null; during?: () => void | Promise<void> };

export function wordingRig(options: { enabled?: boolean; companyName?: string | null; profile?: Record<string, unknown> } = {}) {
    const budget = fakeAiBudget({ introductionEnabled: options.enabled ?? true });
    const db = fakeInterviewDb({
        profiles: [{
            id: RIG_USER,
            company_name: options.companyName === undefined ? "Smith Builders" : options.companyName,
            business_type: "Building", capability_statement: null, years_trading: null, accreditations: null, insurance_details: null,
            ...options.profile,
        }],
        // A website suggestion that was never approved. Nothing here may pick it up.
        pendingImport: [{ id: "import-1", user_id: RIG_USER, items: [{ field: "company_name", proposed: "Evil Website Ltd, NICEIC approved", status: "pending" }] }],
        aiAttempts: budget.attempts,
    });

    const providerCalls: Array<{ system: string; user: string; maxOutputTokens: number; timeoutMs: number }> = [];
    const replies: CannedReply[] = [];

    const generate = async (request: { system: string; user: string; maxOutputTokens: number; timeoutMs: number; feature: string }) => {
        providerCalls.push({ system: request.system, user: request.user, maxOutputTokens: request.maxOutputTokens, timeoutMs: request.timeoutMs });
        const reply = replies.shift();
        if (!reply) throw new Error("no canned reply was queued");
        if (reply.during) await reply.during();
        if ("error" in reply) throw new Error("canned provider failure");
        if ("invalid" in reply) throw new AiResponseError(request.feature, "wrong-shape", reply.usage ? "canned-model" : null, reply.usage);
        return { data: { introduction: reply.text }, model: "canned-model", usage: reply.usage ?? CANNED_USAGE };
    };

    const admin = {
        rpc: (name: string, args: Record<string, unknown>) => (name.startsWith("ai_generation_") ? budget.admin.rpc(name, args) : db.admin.rpc(name, args)),
        // Only the availability hint reads a table through the server's client.
        from: (table: string) => ({
            select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: table === "ai_generation_features" ? { enabled: budget.features["company.introduction"].enabled } : null, error: null }) }) }),
        }),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const context: WordingContext = { supabase: db.user, admin: admin as any, userId: RIG_USER, now: RIG_NOW, generate: generate as any };

    const answer = async (key: string, text: string, skipped = false) => {
        const current = db.tables.company_interview_answers.find((row) => row.user_id === RIG_USER && row.question_key === key);
        const result = await saveAnswer(context, { key, answer: text, skipped, expectedRevision: Number(current?.revision ?? 0) });
        if (!result.ok) throw new Error(`could not save the ${key} answer: ${result.error}`);
    };

    return {
        budget,
        db,
        admin,
        context,
        providerCalls,
        /** Queues the next canned reply. */
        reply: (next: CannedReply) => { replies.push(next); },
        answer,
        answers: async (all: Record<string, string>) => { for (const [key, text] of Object.entries(all)) await answer(key, text); },
        profile: () => db.profile(RIG_USER),
        drafts: () => db.tables.company_narrative_drafts,
        currentDraft: () => db.tables.company_narrative_drafts.filter((row) => row.status !== "superseded").at(-1) ?? null,
    };
}
