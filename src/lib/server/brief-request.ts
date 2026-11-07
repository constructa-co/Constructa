import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { AssistantTurnResult } from "@/lib/assistant-transport";
import {
    briefContextFromProject, reviewBriefReply, BriefReplySchema,
    BRIEF_MESSAGE_LIMIT, BRIEF_NOT_USABLE, BRIEF_OFF, BRIEF_SERVER_CHANGED, BRIEF_TURN_LIMIT,
    type BriefConversationContext,
} from "@/lib/brief-conversation";
import { explainAssistantOff } from "@/lib/job-assistant-readiness";
import { PLANNING_FAILED } from "@/lib/planning-conversation";
import { getPrecontractEditLockReason } from "@/lib/project-editability";
import { requireEditableProjectAccess } from "@/lib/supabase/project-resource-access";
import type { ServerBriefGenerator } from "./job-assistant-transport";
import { generatorRefusal, resolveGenerator, type AttemptOutcome, type GeneratorSource } from "./job-assistant-generation";

const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/;
// An earlier assistant turn as the page carries it: the reply (up to 1500
// characters) plus up to five assumptions and five questions of up to 300 each.
const ASSISTANT_TURN_LIMIT = 1500 + 10 * 301;

const TurnSchema = z.object({
    projectId: z.string().uuid(),
    message: z.string().max(BRIEF_MESSAGE_LIMIT).refine(value => !!value.trim() && !CONTROL.test(value)),
    // SHA-256 of the saved-brief context the page reviewed. Freshness only, never permission.
    expectedRevision: z.string().regex(/^[a-f0-9]{64}$/),
    // The contractor's transcript, held only in their page: conversation, never job context.
    history: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(ASSISTANT_TURN_LIMIT).refine(value => !CONTROL.test(value)),
    }).strict()).max((BRIEF_TURN_LIMIT - 1) * 2)
        .refine(history => history.length % 2 === 0 && history.every((item, index) => item.role === (index % 2 ? "assistant" : "user")
            && (item.role === "assistant" || item.content.length <= BRIEF_MESSAGE_LIMIT))),
}).strict();

type Refusal = { status: "invalid" | "unavailable" | "stale" | "off" | "rejected"; message: string };
export type BriefTurnResult = AssistantTurnResult<z.infer<typeof BriefReplySchema>>;
type Verified = { ok: true; userId: string; context: BriefConversationContext; revision: string } | { ok: false; result: Refusal };

const invalid = (): Refusal => ({ status: "invalid", message: "Enter a message within the length limit. Nothing has been sent." });
const unavailable = (): Refusal => ({ status: "unavailable", message: "The brief request could not be checked. Nothing has changed. You can write the brief without it." });
const stale = (): Refusal => ({ status: "stale", message: BRIEF_SERVER_CHANGED });

/**
 * A055 request path for one Brief turn. The same guards as the pricing and
 * planning turns: signed-in owner, pre-contract lock, the SAVED brief rebuilt
 * here and compared with the page's fingerprint. Then the server-chosen
 * generator (none is approved, so "off"), the Brief reply checks against the
 * server's context, and a second freshness check. Nothing is written.
 */
export async function handleBriefTurn(input: unknown, source?: GeneratorSource<ServerBriefGenerator>): Promise<BriefTurnResult> {
    const parsed = TurnSchema.safeParse(input);
    if (!parsed.success) return invalid();
    const request = parsed.data;
    const verified = await verifyBriefRequest(request.projectId, request.expectedRevision);
    if (!verified.ok) return verified.result;
    // Prepared only now, for a verified owner: the activation point's checks run before anything is reserved or sent.
    const generate = await resolveGenerator(source);
    if (!generate) return { status: "off", message: explainAssistantOff(BRIEF_OFF, generatorRefusal(source)) };
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
    if (!reviewBriefReply(verified.context, userWords, raw).ok) {
        await conclude("rejected");
        return { status: "rejected", message: BRIEF_NOT_USABLE };
    }
    const after = await verifyBriefRequest(request.projectId, request.expectedRevision);
    if (!after.ok) {
        await conclude(after.result.status === "stale" ? "stale" : "unavailable");
        return after.result;
    }
    if (!await conclude("reply")) return { status: "unavailable", message: PLANNING_FAILED };
    return {
        status: "reply",
        // Only the checked shape goes back; the page reviews it again against what it shows.
        reply: BriefReplySchema.parse(raw),
        provenance: { projectId: request.projectId, revision: verified.revision },
    };
}

async function verifyBriefRequest(projectId: string, expectedRevision: string): Promise<Verified> {
    const fail = (result: Refusal): Verified => ({ ok: false, result });
    try {
        const { supabase, user, project: verified } = await requireEditableProjectAccess(projectId);
        if (!user.id || verified.id !== projectId || verified.user_id !== user.id) return fail(unavailable());
        const { data: project, error } = await supabase.from("projects")
            .select("id, user_id, brief_scope, brief_trade_sections, client_type, status, is_archived, proposal_status, proposal_accepted_at")
            .eq("id", projectId).eq("user_id", user.id).single();
        if (error || !project || project.id !== projectId || project.user_id !== user.id || getPrecontractEditLockReason(project)) return fail(unavailable());
        const context = briefContextFromProject(project);
        if (!context) return fail(unavailable());
        const revision = createHash("sha256").update(JSON.stringify(context)).digest("hex");
        if (revision !== expectedRevision) return fail(stale());
        return { ok: true, userId: user.id, context, revision };
    } catch {
        // Do not disclose ownership, the saved brief or raw DB errors.
        return fail(unavailable());
    }
}
