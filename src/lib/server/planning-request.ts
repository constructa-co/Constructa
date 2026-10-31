import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { AssistantTurnResult } from "@/lib/assistant-transport";
import {
    buildPlanningContext, reviewPlanningReply, PlanningReplySchema,
    PLANNING_FAILED, PLANNING_MESSAGE_LIMIT, PLANNING_NOT_USABLE, PLANNING_OFF, PLANNING_SERVER_CHANGED, PLANNING_TURN_LIMIT,
    type PlanningContext,
} from "@/lib/planning-conversation";
import { explainAssistantOff } from "@/lib/job-assistant-readiness";
import { getPrecontractEditLockReason } from "@/lib/project-editability";
import { requireEditableProjectAccess } from "@/lib/supabase/project-resource-access";
import type { ServerPlanningGenerator } from "./job-assistant-transport";
import { generatorRefusal, resolveGenerator, type AttemptOutcome, type GeneratorSource } from "./job-assistant-generation";

const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/;
// An earlier assistant turn as the page shows it: the reply (up to 1500
// characters) plus up to eight open questions of up to 300 characters each.
const ASSISTANT_TURN_LIMIT = 1500 + 8 * 301;

const TurnSchema = z.object({
    projectId: z.string().uuid(),
    message: z.string().max(PLANNING_MESSAGE_LIMIT).refine(value => !!value.trim() && !CONTROL.test(value)),
    // SHA-256 of the saved-programme context the page reviewed. Freshness only, never permission.
    expectedRevision: z.string().regex(/^[a-f0-9]{64}$/),
    // The contractor's transcript, held only in their page: conversation, never job context.
    history: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(ASSISTANT_TURN_LIMIT).refine(value => !CONTROL.test(value)),
    }).strict()).max((PLANNING_TURN_LIMIT - 1) * 2)
        .refine(history => history.length % 2 === 0 && history.every((item, index) => item.role === (index % 2 ? "assistant" : "user")
            && (item.role === "assistant" || item.content.length <= PLANNING_MESSAGE_LIMIT))),
}).strict();

type Refusal = { status: "invalid" | "unavailable" | "stale" | "off" | "rejected"; message: string };
export type PlanningTurnResult = AssistantTurnResult<z.infer<typeof PlanningReplySchema>>;
type Verified = { ok: true; userId: string; context: PlanningContext; revision: string } | { ok: false; result: Refusal };

const invalid = (): Refusal => ({ status: "invalid", message: "Enter a message within the length limit. Nothing has been sent." });
const unavailable = (): Refusal => ({ status: "unavailable", message: "The planning request could not be checked. Nothing has changed. You can plan this job without it." });
const stale = (): Refusal => ({ status: "stale", message: PLANNING_SERVER_CHANGED });

/**
 * A055 request path for one planning turn (Programme page). Same guards as the
 * pricing preflight: signed-in owner, pre-contract lock, the SAVED programme
 * rebuilt here and compared with the page's fingerprint. Then the
 * server-chosen generator (none is approved, so "off"), the A063 reply checks
 * against the server's context, and a second freshness check. Nothing is written.
 */
export async function handlePlanningTurn(input: unknown, source?: GeneratorSource<ServerPlanningGenerator>): Promise<PlanningTurnResult> {
    const parsed = TurnSchema.safeParse(input);
    if (!parsed.success) return invalid();
    const request = parsed.data;
    const verified = await verifyPlanningRequest(request.projectId, request.expectedRevision);
    if (!verified.ok) return verified.result;
    // Prepared only now, for a verified owner: the activation point's checks run before anything is reserved or sent.
    const generate = await resolveGenerator(source);
    if (!generate) return { status: "off", message: explainAssistantOff(PLANNING_OFF, generatorRefusal(source)) };
    const messages = [...request.history, { role: "user" as const, content: request.message }];
    // The attempt identifier is the server's; every outcome below is recorded against it.
    const attemptId = randomUUID();
    const conclude = (outcome: AttemptOutcome) => generate.conclude?.(attemptId, outcome) ?? Promise.resolve(true);
    let raw: unknown;
    try {
        raw = await generate({ userId: verified.userId, projectId: request.projectId, revision: verified.revision, attemptId,
            context: structuredClone(verified.context), messages, signal: new AbortController().signal });
    } catch {
        await conclude("unavailable");
        return { status: "unavailable", message: PLANNING_FAILED };
    }
    const userWords = messages.flatMap(item => item.role === "user" ? [item.content] : []);
    if (!reviewPlanningReply(verified.context, userWords, raw).ok) {
        await conclude("rejected");
        return { status: "rejected", message: PLANNING_NOT_USABLE };
    }
    const after = await verifyPlanningRequest(request.projectId, request.expectedRevision);
    if (!after.ok) {
        await conclude(after.result.status === "stale" ? "stale" : "unavailable");
        return after.result;
    }
    if (!await conclude("reply")) return { status: "unavailable", message: PLANNING_FAILED };
    return {
        status: "reply",
        // Only the checked shape goes back; the page reviews it again against what it shows.
        reply: PlanningReplySchema.parse(raw),
        provenance: { projectId: request.projectId, revision: verified.revision },
    };
}

async function verifyPlanningRequest(projectId: string, expectedRevision: string): Promise<Verified> {
    const fail = (result: Refusal): Verified => ({ ok: false, result });
    try {
        const { supabase, user, project: verified } = await requireEditableProjectAccess(projectId);
        if (!user.id || verified.id !== projectId || verified.user_id !== user.id) return fail(unavailable());
        const { data: project, error } = await supabase.from("projects")
            .select("id, user_id, name, client_name, start_date, programme_phases, programme_working_pattern, status, is_archived, proposal_status, proposal_accepted_at")
            .eq("id", projectId).eq("user_id", user.id).single();
        if (error || !project || project.id !== projectId || project.user_id !== user.id || getPrecontractEditLockReason(project)) return fail(unavailable());
        const context = buildPlanningContext(project);
        if (!context) return fail(unavailable());
        const revision = createHash("sha256").update(JSON.stringify(context)).digest("hex");
        if (revision !== expectedRevision) return fail(stale());
        return { ok: true, userId: user.id, context, revision };
    } catch {
        // Do not disclose ownership, the saved programme or raw DB errors.
        return fail(unavailable());
    }
}
