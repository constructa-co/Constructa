import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { MAX_SCOPE_LENGTH } from "@/lib/guided-brief";
import type { AssistantTurnResult } from "@/lib/assistant-transport";
import { PRICING_CONVERSATION_LIMIT, PRICING_CONVERSATION_OFF } from "@/lib/pricing-conversation";
import { buildPricingReviewContext, pricingModelData, reviewPricingSuggestion, PRICING_REVIEW_STALE, type PricingReviewContext } from "@/lib/pricing-review";
import { getPrecontractEditLockReason } from "@/lib/project-editability";
import { requireEditableProjectAccess } from "@/lib/supabase/project-resource-access";
import { toEstimate } from "@/app/dashboard/projects/costs/estimate-mapping";
import type { Estimate } from "@/app/dashboard/projects/costs/types";
import type { ServerPricingGenerator } from "./job-assistant-transport";
import type { AttemptOutcome } from "./job-assistant-generation";

const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/;

const RequestSchema = z.object({
    projectId: z.string().uuid(),
    estimateId: z.string().uuid().nullable(),
    message: z.string().max(MAX_SCOPE_LENGTH).refine(value => !!value.trim()
        && !CONTROL.test(value)),
    // SHA-256 of the exact existing review revision, including the submitted message.
    // A fingerprint is only a freshness check, never proof of permission or correctness.
    expectedRevision: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

// A055: one turn of the conversation. Earlier turns are the contractor's own
// transcript, held only in their page; they are conversation, never job
// context or authority. Context is always rebuilt below from saved rows.
const TurnSchema = RequestSchema.extend({
    history: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(MAX_SCOPE_LENGTH).refine(value => !CONTROL.test(value)),
    }).strict()).max((PRICING_CONVERSATION_LIMIT - 1) * 2)
        .refine(history => history.length % 2 === 0 && history.every((item, index) => item.role === (index % 2 ? "assistant" : "user"))),
}).strict();

type PricingRequestResult = { status: "invalid" | "unavailable" | "stale" | "off"; message: string };
type Verified = { ok: true; userId: string; context: PricingReviewContext; revision: string } | { ok: false; result: PricingRequestResult };
type PricingReply = { message: string; suggestions: { source: "briefWork" | "contractorMessage"; start: number; end: number }[] };
export type PricingTurnResult = AssistantTurnResult<PricingReply>;
const FAILED = "The assistant couldn't complete this reply. Nothing has been changed. You can try again.";
const unavailable = (): PricingRequestResult => ({ status: "unavailable", message: "The pricing request could not be checked. Nothing has changed. You can continue pricing manually." });
const stale = (): PricingRequestResult => ({ status: "stale", message: PRICING_REVIEW_STALE });
const invalid = (): PricingRequestResult => ({ status: "invalid", message: "Review the current job and enter a message within the source-text limit. Nothing has changed." });

/** Server-only preflight. No provider, budget reservation, conversation storage
 * or mutation exists here. A055 reaches it through `handlePricingTurn` from the
 * Estimate page's Server Action; a generator must come from the server's
 * approved activation point, never from the request.
 */
export async function inspectPricingRequest(input: unknown): Promise<PricingRequestResult> {
    const parsed = RequestSchema.safeParse(input);
    if (!parsed.success) return invalid();
    const verified = await verifyPricingRequest(parsed.data);
    // There is no approved pricing-chat feature in the existing AI budget.
    // Do not borrow brief.suggest (or any other feature) to bypass that gate.
    return verified.ok ? { status: "off", message: PRICING_CONVERSATION_OFF } : verified.result;
}

/**
 * A055 request path for one pricing turn: the same checks as the preflight,
 * then the server-chosen generator (none is approved, so "off"), a review of
 * the reply against the SERVER's context, and a second freshness check.
 * The reply carries the job, estimate and revision it was checked against.
 */
export async function handlePricingTurn(input: unknown, generate?: ServerPricingGenerator): Promise<PricingTurnResult> {
    const parsed = TurnSchema.safeParse(input);
    if (!parsed.success) return invalid();
    const { history, ...request } = parsed.data;
    const verified = await verifyPricingRequest(request);
    if (!verified.ok) return verified.result;
    if (!generate) return { status: "off", message: PRICING_CONVERSATION_OFF };
    // The attempt identifier is the server's; every outcome below is recorded against it.
    const attemptId = randomUUID();
    const conclude = (outcome: AttemptOutcome) => generate.conclude?.(attemptId, outcome) ?? Promise.resolve(true);
    let raw: unknown;
    try {
        raw = await generate({ userId: verified.userId, projectId: request.projectId, revision: verified.revision, attemptId,
            context: pricingModelData(verified.context),
            messages: [...history, { role: "user", content: request.message }], signal: new AbortController().signal });
    } catch {
        await conclude("unavailable");
        return { status: "unavailable", message: FAILED };
    }
    const review = reviewPricingSuggestion(verified.context, raw);
    if (!review.ok) {
        await conclude("rejected");
        return { status: "rejected", message: review.error };
    }
    // The saved job may have moved while the reply was being prepared.
    const after = await verifyPricingRequest(request);
    if (!after.ok || after.revision !== verified.revision) {
        await conclude(after.ok ? "stale" : after.result.status === "stale" ? "stale" : "unavailable");
        return after.ok ? stale() : after.result;
    }
    if (!await conclude("reply")) return { status: "unavailable", message: FAILED };
    return {
        status: "reply",
        reply: { message: review.value.message, suggestions: review.value.suggestions.map(({ source, start, end }) => ({ source, start, end })) },
        provenance: { projectId: request.projectId, estimateId: request.estimateId, revision: verified.revision },
    };
}

async function verifyPricingRequest(request: z.infer<typeof RequestSchema>): Promise<Verified> {
    const fail = (result: PricingRequestResult): Verified => ({ ok: false, result });
    try {
        const { supabase, user, project: verified } = await requireEditableProjectAccess(request.projectId);
        if (!user.id || verified.id !== request.projectId || verified.user_id !== user.id) return fail(unavailable());

        const { data: project, error: projectError } = await supabase.from("projects")
            .select("id, user_id, brief_scope, status, is_archived, proposal_status, proposal_accepted_at")
            .eq("id", request.projectId).eq("user_id", user.id).single();
        if (projectError || !project || project.id !== request.projectId || project.user_id !== user.id
            || getPrecontractEditLockReason(project) || (project.brief_scope !== null && typeof project.brief_scope !== "string")) return fail(unavailable());

        let estimate: Estimate | null = null;
        if (request.estimateId === null) {
            const { data, error } = await supabase.from("estimates").select("id")
                .eq("project_id", request.projectId).limit(1);
            if (error || !Array.isArray(data)) return fail(unavailable());
            if (data.length) return fail(stale());
        } else {
            const { data, error } = await supabase.from("estimates")
                .select("*, estimate_lines(*, estimate_line_components(*))")
                .eq("id", request.estimateId).eq("project_id", request.projectId).single();
            if (error || !data || data.id !== request.estimateId || data.project_id !== request.projectId
                || data.is_client_boq || !Array.isArray(data.estimate_lines)) return fail(unavailable());
            const selected = toEstimate(data);
            if (selected.estimate_lines.some(line => !line || line.estimate_id !== selected.id
                || !Array.isArray(line.estimate_line_components)
                || line.estimate_line_components.some(component => !component || component.estimate_line_id !== line.id))) return fail(unavailable());
            estimate = selected;
        }

        const context = buildPricingReviewContext({ id: project.id, brief_scope: project.brief_scope ?? "" }, estimate, request.message);
        if (!context.ok) return fail(unavailable());
        const revision = createHash("sha256").update(context.value.revision).digest("hex");
        if (revision !== request.expectedRevision) return fail(stale());
        return { ok: true, userId: user.id, context: context.value, revision };
    } catch {
        // Do not disclose ownership, saved scope, financial state or raw DB errors.
        return fail(unavailable());
    }
}
