import type { BriefConversationContext } from "@/lib/brief-conversation";
import type { PlanningContext } from "@/lib/planning-conversation";
import type { pricingModelData } from "@/lib/pricing-review";
import {
    createJobAssistantGenerator, type JobAssistantFeature, type JobAssistantGenerator,
    type JobAssistantTransport, type UsageLedger,
} from "./job-assistant-generation";

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
 * request handlers answer "off" after their checks. Switching one on needs, at
 * least, all three of:
 *   - an approved configuration for that feature below (approval reference,
 *     provider, model and caps, each decided by the owner, not by this code);
 *   - a `server-only` provider transport;
 *   - a usage ledger that reserves atomically within the caps (a database
 *     migration of its own, applied separately).
 * The existing `AiFeature` budgets (`brief.suggest`, the weekly client update
 * `schedule.programme-update` and the rest) are other features and must not be
 * borrowed. This module holds no secret or provider today.
 */
const APPROVED_GENERATION: Record<JobAssistantFeature, unknown> = { pricing: null, planning: null, brief: null };

function serverTransport(): JobAssistantTransport | null {
    return null;
}

function serverUsageLedger(): UsageLedger | null {
    return null;
}

export type ServerPricingGenerator = JobAssistantGenerator<ReturnType<typeof pricingModelData>>;
export type ServerPlanningGenerator = JobAssistantGenerator<PlanningContext>;
export type ServerBriefGenerator = JobAssistantGenerator<BriefConversationContext>;

const approved = <C>(feature: JobAssistantFeature) =>
    createJobAssistantGenerator<C>(feature, { config: APPROVED_GENERATION[feature], transport: serverTransport(), ledger: serverUsageLedger() });

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
