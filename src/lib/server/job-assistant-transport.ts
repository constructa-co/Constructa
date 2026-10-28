import type { BriefConversationContext } from "@/lib/brief-conversation";
import type { PlanningContext } from "@/lib/planning-conversation";
import type { pricingModelData } from "@/lib/pricing-review";
import {
    createJobAssistantGenerator, type JobAssistantFeature, type JobAssistantGenerator,
    type JobAssistantTransport, type UsageLedger,
} from "./job-assistant-generation";
import { createRpcUsageLedger } from "./job-assistant-ledger";
import { BRIEF_SYSTEM_PROMPT, PLANNING_SYSTEM_PROMPT, PRICING_SYSTEM_PROMPT } from "./job-assistant-prompts";
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
 * request handlers answer "off" after their checks. Each feature already has
 * its OpenAI transport adapter and prompt here; reply JSON is mapped in
 * `openai-job-assistant-transport` and reviewed on the request path. The usage
 * ledger migration is source only (NOT applied, disabled). Turning a feature on
 * still needs that feature's approved configuration below, the ledger applied
 * and enabled, and the provider key on the server.
 * The existing `AiFeature` budgets (`brief.suggest`, the weekly client update
 * `schedule.programme-update` and the rest) are other features and must not be
 * borrowed. This module holds no secret or provider today.
 */
const APPROVED_GENERATION: Record<JobAssistantFeature, unknown> = { pricing: null, planning: null, brief: null };

// No client or key is made here: the transport makes its client only inside a send.
const FEATURE_PROMPTS: Record<JobAssistantFeature, string> = {
    pricing: PRICING_SYSTEM_PROMPT,
    planning: PLANNING_SYSTEM_PROMPT,
    brief: BRIEF_SYSTEM_PROMPT,
};

function serverTransport(feature: JobAssistantFeature): JobAssistantTransport | null {
    const systemPrompt = FEATURE_PROMPTS[feature];
    return systemPrompt ? createOpenAIJobAssistantTransport({ systemPrompt }) : null;
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
