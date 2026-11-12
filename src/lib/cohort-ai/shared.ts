/**
 * Shared by the four cohort AI text features: brief suggestion, proposal
 * wording, case-study wording and the programme progress update.
 *
 * Each feature has a pure part (what is sent, what must come back, the checks
 * a reply must pass) and one function that makes the call through the usage
 * budget. None of them calls a provider directly, and none retries.
 *
 * The checks are tripwires. They catch common ways a reply adds a number or
 * a claim nobody made. They do not understand meaning and are not proof that
 * a reply is true. In every one of these features the contractor reads the
 * reply before it is used.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ZodTypeAny, z } from "zod";
import type { GenerateStructuredOptions, StructuredResult } from "@/lib/ai";
import type { AiBudgetResult } from "@/lib/ai-budget";

export interface CohortAiContext {
    /** The server's service-role client, created only after the contractor is authenticated and authorised. */
    admin: Pick<SupabaseClient, "rpc">;
    /** The contractor the application authenticated for this request. */
    userId: string;
    /** Replaced only by tests, the evaluation and fixtures, with a canned generator. */
    generate?: <S extends ZodTypeAny>(options: GenerateStructuredOptions<S>) => Promise<StructuredResult<z.infer<S>>>;
}

export const COHORT_AI_OFF = "The assistant isn't switched on for this yet. Nothing has been changed, and you can carry on without it.";
export const COHORT_AI_BUSY = "The assistant is already working on something for you. Give it a moment, then try again.";
export const COHORT_AI_USED_UP = "You've used the assistant as much as is allowed for now. Try again later. Nothing has been changed.";
export const COHORT_AI_UNAVAILABLE = "The assistant isn't available right now. Nothing has been changed, and you can carry on without it.";
export const COHORT_AI_NOT_USABLE = "The assistant's reply couldn't be used, so it was dropped. Nothing has been changed.";

/**
 * What to tell the contractor when a budgeted call did not produce something
 * usable. `added` is the feature's own message for a reply dropped by its
 * tripwires. Never a success message.
 */
export function plainMessage(result: Exclude<AiBudgetResult<unknown>, { status: "ok" }>, added: string): string {
    if (result.status === "refused") {
        if (result.reason === "disabled") return COHORT_AI_OFF;
        if (result.reason === "in-flight") return COHORT_AI_BUSY;
        if (result.reason === "unavailable") return COHORT_AI_UNAVAILABLE;
        return COHORT_AI_USED_UP;
    }
    if (result.status === "rejected") return result.outcome === "rejected:tripwire" ? added : COHORT_AI_NOT_USABLE;
    return COHORT_AI_UNAVAILABLE;
}

/** One line, single spaces, no control characters, cut to a length. For context values, never for the contractor's own text. */
export function boundedContext(value: unknown, max: number): string {
    return (typeof value === "string" ? value : "")
        .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max);
}
