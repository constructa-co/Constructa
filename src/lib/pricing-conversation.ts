import type { Estimate } from "@/app/dashboard/projects/costs/types";
import { AssistantTransportError } from "./assistant-transport";
import { MAX_SCOPE_LENGTH } from "./guided-brief";
import {
    buildPricingReviewContext, pricingModelData, reviewPricingSuggestion,
    PRICING_REVIEW_OPEN, PRICING_REVIEW_STALE, type PendingPricingReview,
} from "./pricing-review";

export const PRICING_CONVERSATION_LIMIT = 12;
export const PRICING_CONVERSATION_OFF = "The pricing assistant isn't switched on yet. You can continue pricing manually.";
/** The server's saved job or estimate differs from this page (another tab, or a save not yet shown here). */
export const PRICING_SERVER_STALE = "The saved job or estimate no longer matches this page. Reload the page to see the current work. Nothing has been changed.";
const UNAVAILABLE = "The assistant couldn't complete this reply. Nothing has been changed. You can try again.";
type Message = { role: "user" | "assistant"; content: string };
type GenerationResult = { value: unknown } | { failed: true } | { cancelled: true } | { transport: AssistantTransportError };
export interface PricingConversationSnapshot {
    project: { id: string; brief_scope: string };
    estimate: Estimate | null;
    hasOpenWork: boolean;
}
export type PricingConversationGenerator = (input: {
    context: ReturnType<typeof pricingModelData>;
    messages: Message[];
    signal: AbortSignal;
}) => Promise<unknown>;
export interface PricingConversationState {
    status: "idle" | "pending" | "review" | "off" | "error";
    messages: Message[];
    pending: PendingPricingReview | null;
    error: string | null;
}
export type PricingConversationOutcome = "review" | "off" | "busy" | "invalid" | "failed" | "cancelled" | "stale" | "limit";

/** Client-side lifecycle only. An eventual server adapter must separately
 * authorise the job, enforce its budget and validate data before generation.
 * There is deliberately no default provider, transport, persistence or write.
 */
export function createPricingConversation(
    read: () => PricingConversationSnapshot,
    generate?: PricingConversationGenerator,
) {
    let state: PricingConversationState = { status: "idle", messages: [], pending: null, error: null };
    let revision: string | null = null;
    let disposed = false;
    let active: { controller: AbortController; cancel: () => void } | null = null;

    const current = (message = "") => {
        try {
            const snapshot = read();
            const base = buildPricingReviewContext(snapshot.project, snapshot.estimate);
            const context = buildPricingReviewContext(snapshot.project, snapshot.estimate, message);
            if (!base.ok || !context.ok) return null;
            return { revision: base.value.revision, context: context.value, hasOpenWork: snapshot.hasOpenWork };
        } catch { return null; }
    };
    const cancel = () => {
        const request = active;
        active = null;
        if (request) {
            request.controller.abort();
            request.cancel();
        }
        state = { ...state, status: "idle", pending: null, error: null };
    };
    const clear = (error: string | null = null) => {
        cancel();
        revision = null;
        state = { status: error ? "error" : "idle", messages: [], pending: null, error };
    };
    const getState = (): PricingConversationState => {
        if (disposed || revision === null) return structuredClone(state);
        const snapshot = current();
        if (revision !== null && (!snapshot || snapshot.revision !== revision)) clear(PRICING_REVIEW_STALE);
        else if (snapshot?.hasOpenWork && (state.pending || active)) {
            cancel();
            state = { ...state, status: "error", error: PRICING_REVIEW_OPEN };
        }
        // Callers and generators must not be able to mutate the stored review
        // or transcript into a different activity or a subsequent prompt.
        return structuredClone(state);
    };

    async function send(message: string): Promise<PricingConversationOutcome> {
        if (disposed) return "cancelled";
        if (active) return "busy";
        if (!generate) {
            clear();
            state = { ...state, status: "off", error: PRICING_CONVERSATION_OFF };
            return "off";
        }
        if (typeof message !== "string" || !message.trim() || message.length > MAX_SCOPE_LENGTH) {
            state = { ...state, status: "error", pending: null, error: "Enter a message within the source-text limit. Nothing has changed." };
            return "invalid";
        }
        const snapshot = current(message);
        if (!snapshot) { clear(PRICING_REVIEW_STALE); return "invalid"; }
        if (snapshot.hasOpenWork) {
            state = { ...state, status: "error", pending: null, error: PRICING_REVIEW_OPEN };
            return "invalid";
        }
        if (revision !== snapshot.revision) clear();
        revision = snapshot.revision;
        if (state.messages.length >= PRICING_CONVERSATION_LIMIT * 2) {
            state = { ...state, status: "error", pending: null, error: "This conversation has reached its limit. Start a new review to continue; your estimate is unchanged." };
            return "limit";
        }
        const messages: Message[] = [...state.messages.map(item => ({ ...item })), { role: "user", content: message }];
        let release: () => void = () => {};
        const cancelled = new Promise<{ cancelled: true }>(resolve => { release = () => resolve({ cancelled: true }); });
        const request = { controller: new AbortController(), cancel: release };
        active = request;
        state = { ...state, status: "pending", pending: null, error: null };
        // The handled promise remains safe even if a transport ignores abort
        // and settles only after cancellation or after a newer request.
        const reply = Promise.resolve().then<GenerationResult>(async () => {
            if (request.controller.signal.aborted) return { cancelled: true };
            try {
                const value = await generate({ context: pricingModelData(snapshot.context), messages: messages.map(item => ({ ...item })), signal: request.controller.signal });
                return { value };
            } catch (error) { return error instanceof AssistantTransportError ? { transport: error } : { failed: true }; }
        });
        const result = await Promise.race([reply, cancelled]);
        if (active !== request || disposed || "cancelled" in result) return "cancelled";
        active = null;
        const now = current(message);
        if (!now || now.revision !== snapshot.revision) { clear(PRICING_REVIEW_STALE); return "stale"; }
        if (now.hasOpenWork) {
            state = { ...state, status: "error", pending: null, error: PRICING_REVIEW_OPEN };
            return "stale";
        }
        if ("transport" in result) {
            // A request adapter's answer: the server is off, its saved job differs, or it refused.
            const { status, message } = result.transport;
            if (status === "off") {
                clear();
                state = { ...state, status: "off", error: message || PRICING_CONVERSATION_OFF };
                return "off";
            }
            if (status === "stale") { clear(PRICING_SERVER_STALE); return "stale"; }
            state = { ...state, status: "error", pending: null, error: message || UNAVAILABLE };
            return status === "rejected" || status === "invalid" ? "invalid" : "failed";
        }
        if ("failed" in result) {
            state = { ...state, status: "error", pending: null, error: UNAVAILABLE };
            return "failed";
        }
        const review = reviewPricingSuggestion(snapshot.context, result.value);
        if (!review.ok) {
            state = { ...state, status: "error", pending: null, error: review.error };
            return "invalid";
        }
        const pending = structuredClone(review.value);
        state = { status: "review", messages: [...messages, { role: "assistant", content: pending.message }], pending, error: null };
        return "review";
    }

    return {
        send, getState, cancel,
        reset: () => clear(),
        dispose: () => { clear(); disposed = true; },
    };
}
