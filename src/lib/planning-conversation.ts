/**
 * A063 planning conversation: a contractor talks through milestones,
 * procurement lead times and client decisions for the job that is open.
 *
 * Every turn is grounded in the selected job's SAVED programme and in what
 * the contractor has typed in this conversation. Nothing else is sent, and
 * nothing is written: suggestions are kept or dismissed in this page only,
 * and the contractor changes the programme themselves.
 *
 * There is deliberately no default transport, model, budget, persistence or
 * storage. The weekly client update (`schedule.programme-update`) is a
 * different feature with its own allowance and is not reused here. Until a
 * separately authorised server adapter is supplied, the conversation reports
 * honestly that it is not switched on. A supplied generator must authorise the
 * job, enforce its own budget and validate data on the server.
 *
 * The reply checks are tripwires, not understanding: they drop a reply that
 * names a stage the job does not have, a date or lead time nobody gave, or an
 * amount of money. A timing nobody stated becomes an open question.
 */
import { z } from "zod";
import { resolveJobWorkingPattern } from "./job-working-pattern";
import { formatPlanDate, formatWorkingDuration } from "./programme-plan";
import { readProgrammeInclusion } from "./programme-inclusion";
import { computeDisplayProgramme } from "./relative-programme";

export const PLANNING_MESSAGE_LIMIT = 2000;
export const PLANNING_TURN_LIMIT = 10;
export const PLANNING_OFF = "The planning assistant isn't switched on yet. Nothing has been sent, and you can plan this job without it.";
export const PLANNING_OPEN_WORK = "Save or discard your programme changes first. The conversation only uses your saved programme.";
export const PLANNING_NO_CONTEXT = "Check this job's saved programme before discussing it. Nothing has been sent.";
export const PLANNING_FAILED = "The assistant couldn't complete this reply. Nothing has been changed. You can try again.";
export const PLANNING_NOT_USABLE = "The reply mentioned a stage, date, lead time or amount that this job and conversation don't contain, so it was dropped. Nothing has changed.";
export const PLANNING_CHANGED = "This job's saved programme changed, so the conversation started again. Nothing has been changed.";
export const PLANNING_STOPPED = "Stopped waiting for a reply. Your programme is unchanged.";
export const PLANNING_CLEARED = "Conversation cleared on this page. Your programme is unchanged.";
const EMPTY = "Enter a message within the length limit. Nothing has been sent.";
const LIMIT = "This conversation has reached its limit. Clear it to start again; your programme is unchanged.";

export type PlanningTopic = "milestone" | "procurement" | "client-decision";

export interface PlanningProjectFields {
    id: string;
    name: string;
    client_name?: string | null;
    start_date?: string | null;
    programme_phases?: unknown[] | null;
    programme_working_pattern?: unknown;
}

export interface PlanningContext {
    job: { id: string; name: string; client: string | null };
    /** "none" when no programme is saved yet. Relative stages count working days, not dates. */
    basis: "dated" | "relative" | "none";
    start: string | null;
    finish: string | null;
    duration: string | null;
    stages: Array<{ name: string; from: string; to: string; duration: string }>;
}

/** Built from the saved project only. Null when the saved programme cannot be read safely. */
export function buildPlanningContext(project: PlanningProjectFields): PlanningContext | null {
    if (!project || typeof project.id !== "string" || !project.id) return null;
    const pattern = resolveJobWorkingPattern(project.programme_working_pattern);
    const inclusion = readProgrammeInclusion(project.programme_phases);
    if (!pattern || inclusion.intent === "invalid") return null;
    const job = { id: project.id, name: String(project.name ?? "").trim(), client: project.client_name?.trim() || null };
    if (inclusion.phases.length === 0) {
        const start = /^\d{4}-\d{2}-\d{2}$/.test(project.start_date?.slice(0, 10) ?? "") ? formatPlanDate(project.start_date) : null;
        return { job, basis: "none", start: start || null, finish: null, duration: null, stages: [] };
    }
    const plan = computeDisplayProgramme(project.start_date, inclusion.phases, project.programme_working_pattern);
    if (!plan) return null;
    if (plan.basis === "relative_working_days") {
        return {
            job, basis: "relative", start: null, finish: null, duration: plan.duration_label,
            stages: plan.stages.map(stage => ({ name: stage.name, from: `Day ${stage.start_day}`, to: `Day ${stage.end_day}`, duration: formatWorkingDuration(stage.working_days, pattern) })),
        };
    }
    return {
        job, basis: "dated", start: formatPlanDate(plan.start_date), finish: formatPlanDate(plan.end_date), duration: plan.duration_label,
        stages: plan.stages.map(stage => ({ name: stage.name, from: formatPlanDate(stage.start_date), to: formatPlanDate(stage.end_date), duration: formatWorkingDuration(stage.working_days, pattern) })),
    };
}

export interface PlanningSuggestion {
    topic: PlanningTopic;
    title: string;
    /** A stage of this job, exactly as saved, or null. */
    stage: string | null;
    /** Timing in the contractor's own words, or null when nobody has stated it. */
    timing: string | null;
}
export type PlanningMessage =
    | { role: "user"; content: string }
    | { role: "assistant"; content: string; questions: string[]; suggestions: PlanningSuggestion[] };
export type PlanningDecision = "kept" | "dismissed";

export type PlanningGenerator = (input: {
    context: PlanningContext;
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    signal: AbortSignal;
}) => Promise<unknown>;

const ReplySchema = z.strictObject({
    message: z.string().trim().min(1).max(1500),
    questions: z.array(z.string().trim().min(1).max(300)).max(5).default([]),
    suggestions: z.array(z.strictObject({
        topic: z.enum(["milestone", "procurement", "client-decision"]),
        title: z.string().trim().min(1).max(160),
        stage: z.string().trim().max(80).nullable().default(null),
        timing: z.string().trim().max(80).nullable().default(null),
    })).max(6).default([]),
});

const norm = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();
const MONTH = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*";
const DATE_LIKE = new RegExp(`\\b\\d{4}-\\d{2}-\\d{2}\\b|\\b\\d{1,2}/\\d{1,2}(?:/\\d{2,4})?\\b|\\b\\d{1,2}(?:st|nd|rd|th)? ${MONTH}(?: \\d{4})?\\b|\\b${MONTH} \\d{1,2}(?:st|nd|rd|th)?\\b`, "gi");
const LEAD_LIKE = /\b\d+(?:\.\d+)?\s*(?:-|to)?\s*\d*\s*(?:working\s+)?(?:days?|weeks?|wks?|months?)\b/gi;
const MONEY = /[£$€]\s?\d|\b\d[\d,.]*\s?(?:k|gbp|pounds?)\b/i;

/** Tokens in `text` that look like dates or lead times and appear in none of the sources. */
function unsourced(text: string, sources: string): string[] {
    return [...text.matchAll(DATE_LIKE), ...text.matchAll(LEAD_LIKE)].map(match => norm(match[0])).filter(token => !sources.includes(token));
}

export type ReviewedReply = { ok: true; value: Extract<PlanningMessage, { role: "assistant" }> } | { ok: false };

/** Checks one reply against the job and the contractor's own words. */
export function reviewPlanningReply(context: PlanningContext, userMessages: string[], raw: unknown): ReviewedReply {
    const parsed = ReplySchema.safeParse(raw);
    if (!parsed.success) return { ok: false };
    const sources = norm([JSON.stringify(context), ...userMessages].join("\n"));
    const said = norm(userMessages.join("\n"));
    const stages = new Map(context.stages.map(stage => [norm(stage.name), stage.name]));
    const reply = parsed.data;
    const visible = [reply.message, ...reply.questions, ...reply.suggestions.map(item => item.title)].join("\n");
    if (MONEY.test(visible) || unsourced(visible, sources).length) return { ok: false };
    const questions = [...reply.questions];
    const suggestions: PlanningSuggestion[] = [];
    for (const item of reply.suggestions) {
        const stage = item.stage ? stages.get(norm(item.stage)) : null;
        if (item.stage && !stage) return { ok: false };
        // A timing counts only if the contractor said it. Otherwise it stays a question.
        const timing = item.timing && said.includes(norm(item.timing)) ? item.timing : null;
        if (item.timing && !timing || !item.timing && item.topic === "procurement") {
            questions.push(`What timing applies to "${item.title}"? It hasn't been given yet, so nothing is assumed.`);
        }
        suggestions.push({ topic: item.topic, title: item.title, stage: stage ?? null, timing });
    }
    return { ok: true, value: { role: "assistant", content: reply.message, questions: [...new Set(questions)].slice(0, 8), suggestions } };
}

export interface PlanningSnapshot {
    available: boolean;
    status: "idle" | "pending" | "off" | "error";
    message: string;
    messages: PlanningMessage[];
    decisions: Record<string, PlanningDecision>;
    error: string | null;
    notice: string | null;
    canRetry: boolean;
}
export type PlanningOutcome = "reply" | "off" | "busy" | "invalid" | "blocked" | "failed" | "rejected" | "cancelled" | "stale" | "limit";

export const suggestionKey = (turn: number, index: number) => `${turn}:${index}`;

/**
 * In-memory conversation for one mounted job page. `read` returns the saved
 * project and whether unsaved or in-progress programme work is open.
 */
export function createPlanningConversation(
    read: () => { project: PlanningProjectFields; hasOpenWork: boolean },
    generate?: PlanningGenerator,
) {
    const listeners = new Set<() => void>();
    let messages: PlanningMessage[] = [];
    let decisions: Record<string, PlanningDecision> = {};
    let message = "", failed: string | null = null;
    let status: PlanningSnapshot["status"] = generate ? "idle" : "off";
    let error: string | null = generate ? null : PLANNING_OFF, notice: string | null = null;
    let revision: string | null = null;
    let active: { controller: AbortController; release: () => void } | null = null;
    let token = 0;

    const value = (): PlanningSnapshot => structuredClone({
        available: !!generate, status, message, messages, decisions, error, notice, canRetry: !!generate && failed !== null && !active,
    });
    let snapshot = value();
    const publish = () => { snapshot = value(); listeners.forEach(listener => listener()); };
    const current = () => {
        try {
            const source = read();
            const context = buildPlanningContext(source.project);
            return context ? { context, revision: JSON.stringify(context), hasOpenWork: source.hasOpenWork } : null;
        } catch { return null; }
    };
    const stop = () => {
        token++;
        const request = active;
        active = null;
        if (request) { request.controller.abort(); request.release(); }
    };
    const clear = (nextNotice: string | null, keepMessage = false) => {
        stop();
        messages = []; decisions = {}; revision = null; failed = null;
        if (!keepMessage) message = "";
        status = generate ? "idle" : "off"; error = generate ? null : PLANNING_OFF; notice = nextNotice;
    };

    async function send(): Promise<PlanningOutcome> {
        if (!generate) { publish(); return "off"; }
        if (active) return "busy";
        const submitted = message;
        if (!submitted.trim() || submitted.length > PLANNING_MESSAGE_LIMIT) {
            status = "error"; error = EMPTY; notice = null; publish(); return "invalid";
        }
        const now = current();
        if (!now) { status = "error"; error = PLANNING_NO_CONTEXT; notice = null; publish(); return "blocked"; }
        if (now.hasOpenWork) { status = "error"; error = PLANNING_OPEN_WORK; notice = null; publish(); return "blocked"; }
        if (revision !== null && revision !== now.revision) clear(PLANNING_CHANGED, true);
        else notice = null;
        if (messages.filter(item => item.role === "user").length >= PLANNING_TURN_LIMIT) {
            status = "error"; error = LIMIT; publish(); return "limit";
        }
        revision = now.revision;
        const sent: PlanningMessage[] = [...messages, { role: "user", content: submitted }];
        const transcript = sent.map(item => item.role === "user"
            ? { role: "user" as const, content: item.content }
            : { role: "assistant" as const, content: [item.content, ...item.questions].join("\n") });
        let release: () => void = () => {};
        const cancelled = new Promise<{ cancelled: true }>(resolve => { release = () => resolve({ cancelled: true }); });
        const request = { controller: new AbortController(), release };
        const mine = ++token;
        active = request; status = "pending"; error = null; failed = null;
        publish();
        // Settles safely even if a transport ignores abort or answers after a newer request.
        const reply = Promise.resolve().then(async () => {
            if (request.controller.signal.aborted) return { cancelled: true as const };
            try { return { value: await generate({ context: structuredClone(now.context), messages: transcript, signal: request.controller.signal }) }; }
            catch { return { failed: true as const }; }
        });
        const result = await Promise.race([reply, cancelled]);
        if (mine !== token || active !== request || "cancelled" in result) return "cancelled";
        active = null;
        const after = current();
        if (!after || after.revision !== now.revision) { clear(PLANNING_CHANGED, true); publish(); return "stale"; }
        if (after.hasOpenWork) { status = "error"; error = PLANNING_OPEN_WORK; failed = submitted; publish(); return "blocked"; }
        if ("failed" in result) { status = "error"; error = PLANNING_FAILED; failed = submitted; publish(); return "failed"; }
        const reviewed = reviewPlanningReply(now.context, sent.flatMap(item => item.role === "user" ? [item.content] : []), result.value);
        if (!reviewed.ok) { status = "error"; error = PLANNING_NOT_USABLE; failed = submitted; publish(); return "rejected"; }
        messages = [...sent, reviewed.value];
        status = "idle"; error = null;
        if (message === submitted) message = "";
        publish();
        return "reply";
    }

    return {
        getSnapshot: () => snapshot,
        subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
        setMessage: (text: string) => {
            if (!generate || typeof text !== "string" || text === message) return;
            message = text;
            if (status === "error" && !failed) { status = "idle"; error = null; }
            publish();
        },
        send,
        /** Sends the last message that did not get a usable reply, unchanged. */
        retry: async (): Promise<PlanningOutcome> => {
            if (failed === null || active) return active ? "busy" : "invalid";
            message = failed;
            return send();
        },
        /** A deliberate review choice. Kept in this page only; nothing is saved. */
        decide: (turn: number, index: number, decision: PlanningDecision) => {
            const turnMessage = messages[turn];
            if (decision !== "kept" && decision !== "dismissed" || turnMessage?.role !== "assistant" || !turnMessage.suggestions[index]) return false;
            decisions = { ...decisions, [suggestionKey(turn, index)]: decision };
            publish();
            return true;
        },
        /** Re-reads the saved job. A changed programme or job clears; open work stops any wait. */
        refresh: () => {
            const now = current();
            if (revision !== null && (!now || now.revision !== revision)) clear(PLANNING_CHANGED, true);
            else if (now?.hasOpenWork && active) { stop(); status = "error"; error = PLANNING_OPEN_WORK; }
            publish();
        },
        cancel: () => {
            if (!active) return;
            stop(); status = generate ? "idle" : "off"; error = null; notice = PLANNING_STOPPED; publish();
        },
        reset: () => { clear(PLANNING_CLEARED); publish(); },
        // Reset rather than dispose: React Strict Mode may replay effect cleanup/setup.
        detach: () => { clear(null); publish(); },
    };
}

export type PlanningConversation = ReturnType<typeof createPlanningConversation>;
