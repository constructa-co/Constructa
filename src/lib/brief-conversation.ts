/**
 * A055 Brief conversation: the contractor talks through the job's SAVED brief.
 *
 * Context is minimal and saved only: the work description (without the site,
 * access and assumption notes), the client type and the chosen trades. The
 * client's name, address, contact details, rough value and dates are not sent.
 * Unsaved Brief typing is never used: open Brief work blocks a turn.
 *
 * It uses the shared reviewed-conversation lifecycle (A063 planning) and the
 * shared request path. Nothing is saved, applied or sent to the client: facts
 * are exact quotes of the saved work, and assumptions, questions and
 * suggestions are kept or dismissed on the page only. The checks are
 * tripwires, not understanding: a reply that misquotes the saved work, names
 * money, or a date or lead time nobody gave, is dropped.
 */
import { z } from "zod";
import { composeScope, draftFromProject, MAX_SCOPE_LENGTH, splitScope, type BriefDraft, type BriefProjectFields } from "./guided-brief";
import { hasUnsourcedTimingOrMoney, PLANNING_FAILED, PLANNING_MESSAGE_LIMIT, PLANNING_TURN_LIMIT } from "./planning-conversation";
import { createReviewedConversation, type ReviewedConversationSpec, type ReviewedGenerator, type ReviewedReply } from "./reviewed-conversation";

export const BRIEF_OFF = "The brief assistant isn't switched on yet. Nothing has been sent, and you can write the brief without it.";
export const BRIEF_OPEN_WORK = "Save or discard your brief changes first. The conversation only uses your saved brief.";
export const BRIEF_NO_CONTEXT = "Check this job's saved brief before discussing it. Nothing has been sent.";
export const BRIEF_NOT_USABLE = "The reply quoted work your saved brief doesn't contain, or mentioned an amount, date or lead time that nobody gave, so it was dropped. Nothing has changed.";
export const BRIEF_CHANGED = "This job's saved brief changed, so the conversation started again. Nothing has been changed.";
export const BRIEF_SERVER_CHANGED = "This job's saved brief no longer matches this page. Reload the page to discuss the current brief. Nothing has been changed.";
export const BRIEF_STOPPED = "Stopped waiting for a reply. Your brief is unchanged.";
export const BRIEF_CLEARED = "Conversation cleared on this page. Your brief is unchanged.";

export type BriefSuggestionKind = "scope" | "exclusion" | "client-question";
export interface BriefConversationContext {
    job: { id: string };
    work: string;
    clientType: string;
    trades: string[];
}
type SavedBrief = Pick<BriefDraft, "work" | "siteNotes" | "clientType" | "trades">;

/** Built identically in the browser (from the confirmed saved draft) and on the server (from the saved row). */
export function buildBriefConversationContext(projectId: string, saved: SavedBrief): BriefConversationContext | null {
    if (!projectId || typeof projectId !== "string" || !saved) return null;
    const work = splitScope(composeScope(saved.work ?? "", saved.siteNotes ?? "")).work.trim();
    if (work.length > MAX_SCOPE_LENGTH || !Array.isArray(saved.trades) || saved.trades.some(trade => typeof trade !== "string")) return null;
    return { job: { id: projectId }, work, clientType: String(saved.clientType), trades: [...saved.trades] };
}

/** The server's view: the saved row normalised exactly as the Brief page loads it. */
export function briefContextFromProject(row: { id: string } & Pick<BriefProjectFields, "brief_scope" | "brief_trade_sections" | "client_type">): BriefConversationContext | null {
    if (!row || (row.brief_scope !== null && row.brief_scope !== undefined && typeof row.brief_scope !== "string")
        || (row.brief_trade_sections !== null && row.brief_trade_sections !== undefined && !Array.isArray(row.brief_trade_sections))) return null;
    const draft = draftFromProject({
        brief_scope: row.brief_scope ?? "", brief_trade_sections: row.brief_trade_sections ?? [], client_type: row.client_type,
        potential_value: null, start_date: "", lat: null, lng: null, region: "", brief_completed: false,
    });
    return buildBriefConversationContext(row.id, draft);
}

/** The reply shape; the server returns only what it checked. */
export const BriefReplySchema = z.strictObject({
    message: z.string().trim().min(1).max(1500),
    facts: z.array(z.strictObject({ start: z.number().int().nonnegative(), end: z.number().int().positive() })).max(6).default([]),
    assumptions: z.array(z.string().trim().min(1).max(300)).max(5).default([]),
    questions: z.array(z.string().trim().min(1).max(300)).max(5).default([]),
    suggestions: z.array(z.strictObject({
        kind: z.enum(["scope", "exclusion", "client-question"]),
        text: z.string().trim().min(1).max(200),
    })).max(6).default([]),
});

export type BriefAssistantMessage = {
    role: "assistant";
    content: string;
    /** Exact quotes of the saved work. */
    facts: string[];
    assumptions: string[];
    questions: string[];
    suggestions: Array<{ kind: BriefSuggestionKind; text: string }>;
};

const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/;

/** Checks one reply against the saved brief and the contractor's own words. */
export function reviewBriefReply(context: BriefConversationContext, userMessages: string[], raw: unknown): ReviewedReply<BriefAssistantMessage> {
    const parsed = BriefReplySchema.safeParse(raw);
    if (!parsed.success) return { ok: false };
    const reply = parsed.data;
    const facts: string[] = [];
    for (const range of reply.facts) {
        if (range.end <= range.start || range.end > context.work.length) return { ok: false };
        const quote = context.work.slice(range.start, range.end).replace(/\s+/g, " ").trim();
        if (!quote || CONTROL.test(quote)) return { ok: false };
        facts.push(quote);
    }
    const visible = [reply.message, ...reply.assumptions, ...reply.questions, ...reply.suggestions.map(item => item.text)].join("\n");
    if (hasUnsourcedTimingOrMoney(visible, [JSON.stringify(context), ...userMessages].join("\n"))) return { ok: false };
    return {
        ok: true,
        value: { role: "assistant", content: reply.message, facts: [...new Set(facts)], assumptions: reply.assumptions, questions: reply.questions,
            suggestions: reply.suggestions.map(item => ({ kind: item.kind, text: item.text })) },
    };
}

export type BriefConversationSource = { id: string; saved: SavedBrief };
const BRIEF_SPEC: ReviewedConversationSpec<BriefConversationSource, BriefConversationContext, BriefAssistantMessage> = {
    // The same conversation limits as planning; no new limit is introduced.
    messageLimit: PLANNING_MESSAGE_LIMIT,
    turnLimit: PLANNING_TURN_LIMIT,
    text: {
        off: BRIEF_OFF, openWork: BRIEF_OPEN_WORK, noContext: BRIEF_NO_CONTEXT, failed: PLANNING_FAILED, notUsable: BRIEF_NOT_USABLE,
        changed: BRIEF_CHANGED, serverChanged: BRIEF_SERVER_CHANGED, stopped: BRIEF_STOPPED, cleared: BRIEF_CLEARED,
        empty: "Enter a message within the length limit. Nothing has been sent.",
        limit: "This conversation has reached its limit. Clear it to start again; your brief is unchanged.",
    },
    context: source => buildBriefConversationContext(source.id, source.saved),
    review: reviewBriefReply,
    transcript: item => [item.content, ...item.assumptions, ...item.questions].join("\n"),
};

export type BriefGenerator = ReviewedGenerator<BriefConversationContext>;

/** `read` returns the job id, its last CONFIRMED saved brief, and whether Brief work is open. */
export function createBriefConversation(read: () => { project: BriefConversationSource; hasOpenWork: boolean }, generate?: BriefGenerator) {
    return createReviewedConversation(BRIEF_SPEC, read, generate);
}

export type BriefConversation = ReturnType<typeof createBriefConversation>;
export const BRIEF_MESSAGE_LIMIT = PLANNING_MESSAGE_LIMIT;
export const BRIEF_TURN_LIMIT = PLANNING_TURN_LIMIT;
