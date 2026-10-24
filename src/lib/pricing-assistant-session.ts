import { createPricingConversation, PRICING_CONVERSATION_OFF, type PricingConversationGenerator, type PricingConversationSnapshot, type PricingConversationState } from "./pricing-conversation";
import { PRICING_REVIEW_STALE, type PendingPricingReview } from "./pricing-review";

export type PricingDraftChoice = { ok: true } | { ok: false; error: string };
export interface PricingAssistantSnapshot {
    available: boolean;
    message: string;
    conversation: PricingConversationState;
    error: string | null;
    notice: string | null;
}

function frozen(snapshot: PricingAssistantSnapshot): Readonly<PricingAssistantSnapshot> {
    snapshot.conversation.messages.forEach(Object.freeze);
    Object.freeze(snapshot.conversation.messages);
    if (snapshot.conversation.pending) {
        snapshot.conversation.pending.suggestions.forEach(Object.freeze);
        Object.freeze(snapshot.conversation.pending.suggestions);
        Object.freeze(snapshot.conversation.pending);
    }
    Object.freeze(snapshot.conversation);
    return Object.freeze(snapshot);
}

/** In-memory UI adapter only. No default transport, storage, budget or save.
 * A supplied generator must eventually be a separately authorised server adapter.
 */
export function createPricingAssistantSession(
    read: () => PricingConversationSnapshot,
    openDraft: (pending: PendingPricingReview, index: number, contractorMessage: string) => PricingDraftChoice,
    generate?: PricingConversationGenerator,
) {
    const conversation = createPricingConversation(read, generate);
    const listeners = new Set<() => void>();
    let message = "", reviewedMessage = "";
    let error: string | null = null, notice: string | null = null;
    let request = 0;
    const value = () => {
        const state = conversation.getState();
        return frozen({ available: !!generate, message,
            conversation: generate ? state : { ...state, status: "off", error: PRICING_CONVERSATION_OFF },
            error: generate ? error ?? state.error : PRICING_CONVERSATION_OFF, notice });
    };
    let snapshot = value();
    const publish = () => { snapshot = value(); listeners.forEach(listener => listener()); };
    const clear = (nextNotice: string | null) => {
        request++; conversation.reset(); message = ""; reviewedMessage = "";
        error = null; notice = nextNotice; publish();
    };

    return {
        getSnapshot: () => snapshot,
        subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
        setMessage: (text: string) => {
            if (!generate || typeof text !== "string" || text === message) return;
            message = text; error = null; notice = null; publish();
        },
        async send() {
            if (!generate) { await conversation.send(""); publish(); return "off" as const; }
            if (conversation.getState().status === "pending") return "busy" as const;
            try {
                if (read().estimate?.is_client_boq) {
                    error = "Use the existing client BoQ workflow for this estimate."; publish(); return "invalid" as const;
                }
            } catch { error = PRICING_REVIEW_STALE; publish(); return "invalid" as const; }
            const submitted = message, token = ++request;
            error = null; notice = null; reviewedMessage = "";
            const reply = conversation.send(submitted);
            publish();
            const outcome = await reply;
            if (token !== request) return outcome;
            if (outcome === "review") {
                reviewedMessage = submitted;
                if (message === submitted) message = "";
            }
            publish();
            return outcome;
        },
        choose(index: number): PricingDraftChoice {
            const pending = conversation.getState().pending;
            if (!generate || !pending || !Number.isSafeInteger(index) || index < 0 || !pending.suggestions[index]) {
                error = "There is no reviewed activity ready to open. Review the current work first.";
                publish(); return { ok: false, error };
            }
            let result: PricingDraftChoice;
            try { result = openDraft(pending, index, reviewedMessage); }
            catch { result = { ok: false, error: "The draft could not be confirmed. Check the open price line before trying again." }; }
            if (result.ok) {
                conversation.cancel(); reviewedMessage = ""; error = null;
                notice = "An unpriced draft is open. Review its wording and enter your price before saving the line.";
            } else { error = result.error; }
            publish(); return result;
        },
        refresh: () => { publish(); },
        cancel: () => {
            request++; conversation.cancel(); reviewedMessage = ""; error = null;
            notice = "Stopped waiting for a reply. Your estimate is unchanged."; publish();
        },
        reset: () => clear("Conversation cleared on this page. Your estimate is unchanged."),
        // Reset rather than dispose: React Strict Mode may replay effect cleanup/setup.
        detach: () => clear(null),
    };
}

export type PricingAssistantSession = ReturnType<typeof createPricingAssistantSession>;
