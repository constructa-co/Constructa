import type { BriefConversationContext } from "@/lib/brief-conversation";
import type { PlanningContext } from "@/lib/planning-conversation";
import type { pricingModelData } from "@/lib/pricing-review";
import {
    createJobAssistantGenerator, type JobAssistantFeature, type JobAssistantGenerator,
    type JobAssistantTransport, type UsageLedger,
} from "./job-assistant-generation";
import { createRpcUsageLedger } from "./job-assistant-ledger";
import { PLANNING_SYSTEM_PROMPT } from "./job-assistant-prompts";
import { createOpenAIJobAssistantTransport } from "./openai-job-assistant-transport";

/**
 * A055 server-side activation point for the job assistant.
 *
 * A generator receives only context the server rebuilt from saved rows for
 * the authenticated owner, plus the conversation, the job and the revision it
 * was checked against. It is chosen here, never by the request, and it runs
 * through the generation seam in `job-assistant-generation.ts`: bounds,
 * reservation, one provider call, settle/release/retain, recorded outcome.
 *
 * NOTHING IS APPROVED YET, so every activation point returns null and the
 * request handlers answer "off" after their checks. What exists (A063):
 *   - planning: the OpenAI transport with its prompt and reply mapping, and
 *     the database usage ledger (source migration, NOT applied, disabled);
 *   - pricing and Brief: the shared seam and ledger only. Their prompts and
 *     reply mapping are not written, so their transport stays null.
 * Switching planning on still needs: the owner's approved configuration below
 * (approval reference, provider, model, prices and caps), the ledger migration
 * applied and its settings row enabled with ceilings, and the provider key
 * configured for the server. None of those is done or assumed here.
 * The existing `AiFeature` budgets (`brief.suggest`, the weekly client update
 * `schedule.programme-update` and the rest) are other features and must not be
 * borrowed. This module holds no secret or provider today.
 */
const APPROVED_GENERATION: Record<JobAssistantFeature, unknown> = { pricing: null, planning: null, brief: null };

// No client or key is made here: the transport makes its client only inside a send.
function serverTransport(feature: JobAssistantFeature): JobAssistantTransport | null {
    return feature === "planning" ? createOpenAIJobAssistantTransport({ systemPrompt: PLANNING_SYSTEM_PROMPT }) : null;
}

// The service-role client is made only inside a ledger step.
function serverUsageLedger(): UsageLedger | null {
    return createRpcUsageLedger();
}

export type ServerPricingGenerator = JobAssistantGenerator<ReturnType<typeof pricingModelData>>;
export type ServerPlanningGenerator = JobAssistantGenerator<PlanningContext>;
export type ServerBriefGenerator = JobAssistantGenerator<BriefConversationContext>;

const approved = <C>(feature: JobAssistantFeature) =>
    createJobAssistantGenerator<C>(feature, { config: APPROVED_GENERATION[feature], transport: serverTransport(feature), ledger: serverUsageLedger() });

export function approvedPricingGenerator(): ServerPricingGenerator | null {
    return approved("pricing");
}

export function approvedPlanningGenerator(): ServerPlanningGenerator | null {
    return approved("planning");
}

/** A055 Brief. Not approved either: same requirements as above, for its own feature. */
export function approvedBriefGenerator(): ServerBriefGenerator | null {
    return approved("brief");
}

/** What the pages tell the browser. The handlers check again on every request. */
export function jobAssistantAvailability(): { pricing: boolean; planning: boolean; brief: boolean } {
    return { pricing: approvedPricingGenerator() !== null, planning: approvedPlanningGenerator() !== null, brief: approvedBriefGenerator() !== null };
}
