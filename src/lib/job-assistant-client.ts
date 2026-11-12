/**
 * A055 browser half of the job assistant: turns a conversation turn into a
 * request to the server and the server's answer back into a reply or a status.
 *
 * Only identifiers, the contractor's words, the transcript and a fingerprint
 * of the SAVED context shown on this page are sent. Job context, model and
 * budget are never sent: the server rebuilds the context from its own rows
 * and chooses (or refuses) the generator itself.
 */
import type { Estimate } from "@/app/dashboard/projects/costs/types";
import { AssistantTransportError, sha256Hex, unwrapAssistantTurn, type AssistantTurnMessage } from "./assistant-transport";
import type { BriefGenerator } from "./brief-conversation";
import type { PlanningGenerator } from "./planning-conversation";
import { PLANNING_FAILED } from "./planning-conversation";
import type { PricingConversationGenerator } from "./pricing-conversation";
import { buildPricingReviewContext, PRICING_REVIEW_STALE } from "./pricing-review";

const PRICING_FAILED = "The assistant couldn't complete this reply. Nothing has been changed. You can try again.";

export interface PricingTurnRequest {
    projectId: string;
    estimateId: string | null;
    message: string;
    expectedRevision: string;
    history: AssistantTurnMessage[];
}
export type BriefTurnRequest = PlanningTurnRequest;
export interface PlanningTurnRequest {
    projectId: string;
    message: string;
    expectedRevision: string;
    history: AssistantTurnMessage[];
}

function split(messages: AssistantTurnMessage[], fallback: string) {
    const last = messages.at(-1);
    if (!last || last.role !== "user") throw new AssistantTransportError("invalid", fallback);
    return { message: last.content, history: messages.slice(0, -1).map(item => ({ role: item.role, content: item.content })) };
}
function stopped(signal: AbortSignal, fallback: string) {
    if (signal.aborted) throw new AssistantTransportError("unavailable", fallback);
}

/**
 * `read` returns the saved job and the selected saved estimate as this page
 * holds them; the fingerprint is taken from exactly those, with the message.
 */
export function createPricingRequestGenerator(
    read: () => { project: { id: string; brief_scope: string }; estimate: Estimate | null },
    request: (input: PricingTurnRequest) => Promise<unknown>,
): PricingConversationGenerator {
    return async ({ messages, signal }) => {
        const { message, history } = split(messages, PRICING_FAILED);
        const { project, estimate } = read();
        const context = buildPricingReviewContext(project, estimate, message);
        if (!context.ok) throw new AssistantTransportError("stale", PRICING_REVIEW_STALE);
        const expected = { projectId: project.id, estimateId: estimate?.id ?? null, revision: await sha256Hex(context.value.revision) };
        stopped(signal, PRICING_FAILED);
        const result = await request({ projectId: expected.projectId, estimateId: expected.estimateId, message, expectedRevision: expected.revision, history });
        stopped(signal, PRICING_FAILED);
        return unwrapAssistantTurn(result, expected, PRICING_FAILED);
    };
}

/** The planning conversation hands over the saved-programme context it reviewed; that is what is fingerprinted. */
export function createPlanningRequestGenerator(request: (input: PlanningTurnRequest) => Promise<unknown>): PlanningGenerator {
    return savedContextRequest(request);
}

/** The Brief conversation hands over the saved-brief context it reviewed (A055); the same request path. */
export function createBriefRequestGenerator(request: (input: BriefTurnRequest) => Promise<unknown>): BriefGenerator {
    return savedContextRequest(request);
}

function savedContextRequest<C extends { job: { id: string } }>(request: (input: PlanningTurnRequest) => Promise<unknown>) {
    return async ({ context, messages, signal }: { context: C; messages: AssistantTurnMessage[]; signal: AbortSignal }) => {
        const { message, history } = split(messages, PLANNING_FAILED);
        const expected = { projectId: context.job.id, revision: await sha256Hex(JSON.stringify(context)) };
        stopped(signal, PLANNING_FAILED);
        const result = await request({ projectId: expected.projectId, message, expectedRevision: expected.revision, history });
        stopped(signal, PLANNING_FAILED);
        return unwrapAssistantTurn(result, expected, PLANNING_FAILED);
    };
}
