import type { AssistantTurnMessage } from "@/lib/assistant-transport";
import type { PlanningContext } from "@/lib/planning-conversation";
import type { pricingModelData } from "@/lib/pricing-review";

/**
 * A055 server-side activation point for the job assistant.
 *
 * A generator receives only context the server rebuilt from saved rows for
 * the authenticated owner, plus the conversation. It is chosen here, never by
 * the request.
 *
 * NOTHING IS APPROVED YET, so both return null and the request handlers answer
 * "off" after their checks. Switching either on needs, at least:
 *   - an approved `AiFeature` for it in `ai-budget.ts`, with fixed bounds and
 *     a database feature row added by migration (allowance and retention);
 *   - an approved model and prompt for that feature;
 *   - a generator that calls the provider only through `withAiBudget`.
 * None of those is invented here. The weekly client update
 * (`schedule.programme-update`) and `brief.suggest` are other features and
 * must not be borrowed. This module holds no secret or provider today; a
 * real generator must live in a `server-only` module of its own.
 */
export type ServerPricingGenerator = (input: {
    userId: string;
    context: ReturnType<typeof pricingModelData>;
    messages: AssistantTurnMessage[];
    signal: AbortSignal;
}) => Promise<unknown>;
export type ServerPlanningGenerator = (input: {
    userId: string;
    context: PlanningContext;
    messages: AssistantTurnMessage[];
    signal: AbortSignal;
}) => Promise<unknown>;

export function approvedPricingGenerator(): ServerPricingGenerator | null {
    return null;
}

export function approvedPlanningGenerator(): ServerPlanningGenerator | null {
    return null;
}

/** What the pages tell the browser. The handlers check again on every request. */
export function jobAssistantAvailability(): { pricing: boolean; planning: boolean } {
    return { pricing: approvedPricingGenerator() !== null, planning: approvedPlanningGenerator() !== null };
}
