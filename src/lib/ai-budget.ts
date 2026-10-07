/**
 * The one way two features reach the AI provider: through a usage budget.
 *
 * SCOPE. This covers six named features (see `AiFeature`) and nothing else:
 * the two it began with, and the four AI text features a cohort contractor
 * can reach. Every other AI call in the application is outside it.
 * It is not an application-wide spending limit.
 *
 * What happens, in order:
 *
 *   1. An emergency stop is checked. It can only switch AI off.
 *   2. The request is checked against fixed size limits.
 *   3. An attempt is RESERVED in the database. The database refuses if the
 *      feature is off, a call is already in flight for this contractor, or
 *      the contractor's or the service's allowance is used up. Refused means
 *      no call. If the reservation cannot be made for any reason, no call.
 *   4. ONE call is made, with the output cap that was reserved.
 *   5. The caller's `judge` decides what the reply is worth (tripwires, and
 *      later a check that the sources have not moved).
 *   6. The attempt is FINISHED, once, with how it really ended and what the
 *      provider says it used. A reply that was paid for and then rejected is
 *      charged what it used. A call that gave nothing back is charged its
 *      whole reservation.
 *
 * The reservation and the finish are two short database calls. The provider
 * call happens between them, never inside a transaction or a lock.
 *
 * The model, the output cap and the time limit are fixed here, on the server.
 * A caller cannot ask for more.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ZodTypeAny, z } from "zod";
import { AiResponseError, generateStructured, type GenerateStructuredOptions, type StructuredResult } from "@/lib/ai";

export type AiFeature =
    | "company.introduction"
    | "profile.rewrite"
    | "brief.suggest"
    | "proposal.wording"
    | "case-studies.enhance"
    | "schedule.programme-update";

/** Fixed per feature. Output is what gets reserved; the character caps bound the input. */
export const AI_FEATURE_BOUNDS: Record<AiFeature, { maxOutputTokens: number; timeoutMs: number; maxSystemChars: number; maxUserChars: number }> = {
    "profile.rewrite": { maxOutputTokens: 700, timeoutMs: 20_000, maxSystemChars: 4000, maxUserChars: 6000 },
    "company.introduction": { maxOutputTokens: 500, timeoutMs: 20_000, maxSystemChars: 4000, maxUserChars: 8000 },
    // The four cohort text features. `maxUserChars` is the limit on the whole
    // encoded JSON that is sent, escapes included, not on any one field.
    "brief.suggest": { maxOutputTokens: 700, timeoutMs: 20_000, maxSystemChars: 4000, maxUserChars: 6000 },
    "proposal.wording": { maxOutputTokens: 2000, timeoutMs: 30_000, maxSystemChars: 4000, maxUserChars: 8000 },
    "case-studies.enhance": { maxOutputTokens: 1000, timeoutMs: 20_000, maxSystemChars: 4000, maxUserChars: 6000 },
    "schedule.programme-update": { maxOutputTokens: 900, timeoutMs: 20_000, maxSystemChars: 4000, maxUserChars: 8000 },
};

/**
 * Whether a request is inside its feature's fixed size limits. A caller uses
 * this BEFORE asking for a reservation so that it can tell the contractor,
 * honestly, that what they wrote is too long, instead of the wrapper refusing
 * with nothing more to say. The check is on the encoded text that would be
 * sent, so quotes, backslashes and non-ASCII characters are counted as sent.
 */
export function fitsAiBounds(feature: AiFeature, request: { system: string; user: string }): boolean {
    const bounds = AI_FEATURE_BOUNDS[feature];
    return !!bounds && request.system.length > 0 && request.user.length > 0
        && request.system.length <= bounds.maxSystemChars && request.user.length <= bounds.maxUserChars;
}

/** How an attempt can end once a reply exists. `judge` returns one of these. */
export type AiVerdict = "ok" | "rejected:tripwire" | "sources-moved";

export type AiRefusal =
    /** Switched off by the emergency stop or in the database. */
    | "disabled"
    | "in-flight"
    | "attempt-limit"
    | "token-limit"
    | "service-limit"
    /** The budget could not be consulted, or the request was out of bounds. Nothing was called. */
    | "unavailable";

export type AiBudgetResult<T> =
    | { status: "ok"; data: T; attemptId: string; model: string; promptVersion: string; usage: StructuredResult<T>["usage"] }
    /** Nothing was called and nothing was charged. */
    | { status: "refused"; reason: AiRefusal }
    /** A reply came back, was paid for, and is not to be used. */
    | { status: "rejected"; outcome: "rejected:schema" | "rejected:tripwire" | "sources-moved"; attemptId: string }
    /** The call failed, or its outcome could not be recorded. Charged; not to be used. */
    | { status: "failed"; attemptId: string };

export interface AiBudgetContext {
    /** The server's service-role client. The budget functions cannot be executed by anything else. */
    admin: Pick<SupabaseClient, "rpc">;
    /** The contractor the application authenticated for this request. */
    userId: string;
    feature: AiFeature;
    promptVersion: string;
    /** `company.introduction` only: the sources the request was written from. */
    sourceFingerprint?: string | null;
    /** Replaced only by tests, with a canned generator. */
    generate?: <S extends ZodTypeAny>(options: GenerateStructuredOptions<S>) => Promise<StructuredResult<z.infer<S>>>;
}

export interface AiBudgetRequest<S extends ZodTypeAny> {
    /** A label for logs. Not the budget feature. */
    label: string;
    system: string;
    user: string;
    schema: S;
}

/**
 * True when AI is switched off by the operator. This can only stop calls.
 * There is deliberately no setting anywhere that switches a feature ON from
 * the environment: that is a row in the database, changed by a migration.
 */
export function aiEmergencyStop(): boolean {
    const value = (process.env.CONSTRUCTA_AI_DISABLED ?? "").trim().toLowerCase();
    return value !== "" && value !== "0" && value !== "false";
}

const REFUSALS: readonly string[] = ["disabled", "in-flight", "attempt-limit", "token-limit", "service-limit"];

export async function withAiBudget<S extends ZodTypeAny>(
    context: AiBudgetContext,
    request: AiBudgetRequest<S>,
    judge: (data: z.infer<S>) => AiVerdict | Promise<AiVerdict>,
): Promise<AiBudgetResult<z.infer<S>>> {
    const { admin, userId, feature, promptVersion } = context;
    const generate = context.generate ?? generateStructured;
    const bounds = AI_FEATURE_BOUNDS[feature];

    if (aiEmergencyStop()) return { status: "refused", reason: "disabled" };
    if (!bounds || !userId || !request.system || !request.user
        || request.system.length > bounds.maxSystemChars || request.user.length > bounds.maxUserChars) {
        return { status: "refused", reason: "unavailable" };
    }

    // ── Reserve. No reservation, no call. ────────────────────────────────────
    let attemptId: string;
    try {
        const { data, error } = await admin.rpc("ai_generation_reserve", {
            p_user_id: userId,
            p_feature: feature,
            p_reserve_output_tokens: bounds.maxOutputTokens,
            p_source_fingerprint: context.sourceFingerprint ?? null,
        });
        const claim = data as { status?: string; attempt_id?: string } | null;
        if (error || !claim?.status) {
            console.error("ai budget reservation failed", { feature, code: error?.code });
            return { status: "refused", reason: "unavailable" };
        }
        if (REFUSALS.includes(claim.status)) return { status: "refused", reason: claim.status as AiRefusal };
        if (claim.status !== "reserved" || !claim.attempt_id) return { status: "refused", reason: "unavailable" };
        attemptId = claim.attempt_id;
    } catch (error) {
        console.error("ai budget reservation threw", { feature, message: error instanceof Error ? error.message : String(error) });
        return { status: "refused", reason: "unavailable" };
    }

    // ── From here an attempt is open. It is finished exactly once. ───────────
    let finished = false;
    const finish = async (outcome: string, usage: { promptTokens: number; completionTokens: number } | null, model: string | null): Promise<boolean> => {
        if (finished) return false;
        finished = true;
        try {
            const { data, error } = await admin.rpc("ai_generation_finish", {
                p_user_id: userId,
                p_attempt_id: attemptId,
                p_outcome: outcome,
                p_prompt_tokens: usage?.promptTokens ?? null,
                p_completion_tokens: usage?.completionTokens ?? null,
                p_model: model,
                p_prompt_version: promptVersion,
            });
            if (error || data !== true) {
                // Left open, it stays charged at its whole reservation and stops blocking after two minutes.
                console.error("ai budget attempt not recorded", { feature, outcome, code: error?.code });
                return false;
            }
            return true;
        } catch (error) {
            console.error("ai budget finish threw", { feature, outcome, message: error instanceof Error ? error.message : String(error) });
            return false;
        }
    };

    try {
        let reply: StructuredResult<z.infer<S>>;
        try {
            reply = await generate({
                feature: request.label,
                system: request.system,
                user: request.user,
                schema: request.schema,
                maxOutputTokens: bounds.maxOutputTokens,
                timeoutMs: bounds.timeoutMs,
            });
        } catch (error) {
            if (error instanceof AiResponseError) {
                // Paid for, unusable. Charged what it used if the provider said; otherwise the whole reservation.
                await finish("rejected:schema", error.usage, error.model);
                return { status: "rejected", outcome: "rejected:schema", attemptId };
            }
            // Nothing came back. What it cost is unknown, so it is charged in full.
            await finish("error", null, null);
            return { status: "failed", attemptId };
        }

        let verdict: AiVerdict;
        try {
            verdict = await judge(reply.data);
        } catch (error) {
            // The reply exists and was paid for; our own check failed. Recorded with what it used.
            console.error("ai budget judge threw", { feature, message: error instanceof Error ? error.message : String(error) });
            await finish("error", reply.usage, reply.model);
            return { status: "failed", attemptId };
        }
        if (verdict !== "ok") {
            await finish(verdict, reply.usage, reply.model);
            return { status: "rejected", outcome: verdict, attemptId };
        }

        // The reply is only used if the record that it was made and what it cost exists.
        const recorded = await finish("ok", reply.usage, reply.model);
        if (!recorded) return { status: "failed", attemptId };
        return { status: "ok", data: reply.data, attemptId, model: reply.model, promptVersion, usage: reply.usage };
    } finally {
        // Only reached unfinished if something above threw in a way nothing anticipated.
        if (!finished) await finish("error", null, null);
    }
}
