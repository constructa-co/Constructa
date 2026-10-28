/**
 * The in-page conversation lifecycle shared by the job assistant's grounded
 * conversations (A063 planning on Programme, A055 Brief). Extracted unchanged
 * from the A063 planning conversation; each use supplies how its SAVED context
 * is built, how a reply is reviewed, its wording and its limits.
 *
 * Nothing here sends, stores or writes on its own. Without a generator the
 * conversation reports that it is off. A supplied generator is a request
 * adapter whose server authorises the job, rebuilds the saved context and
 * chooses (or refuses) the model itself.
 */
import { AssistantTransportError } from "./assistant-transport";

export interface ReviewedConversationText {
    off: string; openWork: string; noContext: string; failed: string; notUsable: string;
    changed: string; serverChanged: string; stopped: string; cleared: string; empty: string; limit: string;
}
export type ReviewedAssistantMessage = { role: "assistant"; content: string; suggestions: unknown[] };
export type ReviewedMessage<A extends ReviewedAssistantMessage> = { role: "user"; content: string } | A;
export type ReviewedDecision = "kept" | "dismissed";
export type ReviewedReply<A> = { ok: true; value: A } | { ok: false };
export interface ReviewedConversationSpec<S, C, A extends ReviewedAssistantMessage> {
    messageLimit: number;
    turnLimit: number;
    text: ReviewedConversationText;
    /** Null when the saved context cannot be read safely. */
    context: (project: S) => C | null;
    review: (context: C, userMessages: string[], raw: unknown) => ReviewedReply<A>;
    /** How an earlier assistant turn is carried in the transcript. */
    transcript: (message: A) => string;
}
export type ReviewedGenerator<C> = (input: {
    context: C;
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    signal: AbortSignal;
}) => Promise<unknown>;
export interface ReviewedSnapshot<A extends ReviewedAssistantMessage> {
    available: boolean;
    status: "idle" | "pending" | "off" | "error";
    message: string;
    messages: ReviewedMessage<A>[];
    decisions: Record<string, ReviewedDecision>;
    error: string | null;
    notice: string | null;
    canRetry: boolean;
}
export type ReviewedOutcome = "reply" | "off" | "busy" | "invalid" | "blocked" | "failed" | "rejected" | "cancelled" | "stale" | "limit";

export const suggestionKey = (turn: number, index: number) => `${turn}:${index}`;

/**
 * In-memory conversation for one mounted job page. `read` returns the saved
 * project and whether unsaved or in-progress work is open.
 */
export function createReviewedConversation<S, C, A extends ReviewedAssistantMessage>(
    spec: ReviewedConversationSpec<S, C, A>,
    read: () => { project: S; hasOpenWork: boolean },
    generate?: ReviewedGenerator<C>,
) {
    const { text } = spec;
    const listeners = new Set<() => void>();
    let messages: ReviewedMessage<A>[] = [];
    let decisions: Record<string, ReviewedDecision> = {};
    let message = "", failed: string | null = null;
    let status: ReviewedSnapshot<A>["status"] = generate ? "idle" : "off";
    let error: string | null = generate ? null : text.off, notice: string | null = null;
    let revision: string | null = null;
    let active: { controller: AbortController; release: () => void } | null = null;
    let token = 0;

    const value = (): ReviewedSnapshot<A> => structuredClone({
        available: !!generate, status, message, messages, decisions, error, notice, canRetry: !!generate && failed !== null && !active,
    });
    let snapshot = value();
    const publish = () => { snapshot = value(); listeners.forEach(listener => listener()); };
    const current = () => {
        try {
            const source = read();
            const context = spec.context(source.project);
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
        status = generate ? "idle" : "off"; error = generate ? null : text.off; notice = nextNotice;
    };

    async function send(): Promise<ReviewedOutcome> {
        if (!generate) { publish(); return "off"; }
        if (active) return "busy";
        const submitted = message;
        if (!submitted.trim() || submitted.length > spec.messageLimit) {
            status = "error"; error = text.empty; notice = null; publish(); return "invalid";
        }
        const now = current();
        if (!now) { status = "error"; error = text.noContext; notice = null; publish(); return "blocked"; }
        if (now.hasOpenWork) { status = "error"; error = text.openWork; notice = null; publish(); return "blocked"; }
        if (revision !== null && revision !== now.revision) clear(text.changed, true);
        else notice = null;
        if (messages.filter(item => item.role === "user").length >= spec.turnLimit) {
            status = "error"; error = text.limit; publish(); return "limit";
        }
        revision = now.revision;
        const sent: ReviewedMessage<A>[] = [...messages, { role: "user", content: submitted }];
        const transcript = sent.map(item => item.role === "user"
            ? { role: "user" as const, content: item.content }
            : { role: "assistant" as const, content: spec.transcript(item as A) });
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
            catch (error) { return error instanceof AssistantTransportError ? { transport: error } : { failed: true as const }; }
        });
        const result = await Promise.race([reply, cancelled]);
        if (mine !== token || active !== request || "cancelled" in result) return "cancelled";
        active = null;
        const after = current();
        if (!after || after.revision !== now.revision) { clear(text.changed, true); publish(); return "stale"; }
        if (after.hasOpenWork) { status = "error"; error = text.openWork; failed = submitted; publish(); return "blocked"; }
        if ("transport" in result && result.transport) {
            // A request adapter's answer: the server is off, its saved job differs, or it refused.
            const reason = result.transport.status;
            if (reason === "stale") { clear(text.serverChanged, true); publish(); return "stale"; }
            if (reason === "off") { status = "error"; error = text.off; publish(); return "off"; }
            status = "error"; error = reason === "rejected" ? text.notUsable : text.failed; failed = submitted; publish();
            return reason === "rejected" ? "rejected" : "failed";
        }
        if ("failed" in result) { status = "error"; error = text.failed; failed = submitted; publish(); return "failed"; }
        const reviewed = spec.review(now.context, sent.flatMap(item => item.role === "user" ? [item.content] : []), result.value);
        if (!reviewed.ok) { status = "error"; error = text.notUsable; failed = submitted; publish(); return "rejected"; }
        messages = [...sent, reviewed.value];
        status = "idle"; error = null;
        if (message === submitted) message = "";
        publish();
        return "reply";
    }

    return {
        getSnapshot: () => snapshot,
        subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
        setMessage: (input: string) => {
            if (!generate || typeof input !== "string" || input === message) return;
            message = input;
            if (status === "error" && !failed) { status = "idle"; error = null; }
            publish();
        },
        send,
        /** Sends the last message that did not get a usable reply, unchanged. */
        retry: async (): Promise<ReviewedOutcome> => {
            if (failed === null || active) return active ? "busy" : "invalid";
            message = failed;
            return send();
        },
        /** A deliberate review choice. Kept in this page only; nothing is saved. */
        decide: (turn: number, index: number, decision: ReviewedDecision) => {
            const turnMessage = messages[turn];
            if (decision !== "kept" && decision !== "dismissed" || turnMessage?.role !== "assistant" || !turnMessage.suggestions[index]) return false;
            decisions = { ...decisions, [suggestionKey(turn, index)]: decision };
            publish();
            return true;
        },
        /** Re-reads the saved job. A changed saved context or job clears; open work stops any wait. */
        refresh: () => {
            const now = current();
            if (revision !== null && (!now || now.revision !== revision)) clear(text.changed, true);
            else if (now?.hasOpenWork && active) { stop(); status = "error"; error = text.openWork; }
            publish();
        },
        cancel: () => {
            if (!active) return;
            stop(); status = generate ? "idle" : "off"; error = null; notice = text.stopped; publish();
        },
        reset: () => { clear(text.cleared); publish(); },
        // Reset rather than dispose: React Strict Mode may replay effect cleanup/setup.
        detach: () => { clear(null); publish(); },
    };
}

export type ReviewedConversation<A extends ReviewedAssistantMessage> = ReturnType<typeof createReviewedConversation<unknown, unknown, A>>;
