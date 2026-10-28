"use client";

import { useId, useSyncExternalStore } from "react";
import { MAX_SCOPE_LENGTH } from "@/lib/guided-brief";
import type { PricingAssistantSession } from "@/lib/pricing-assistant-session";
import ui from "./estimating.module.css";

export default function PricingAssistantPanel({ session, blocked, blockedNote }: { session: PricingAssistantSession; blocked: boolean; blockedNote?: string }) {
    const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
    const id = useId();
    const pending = state.conversation.status === "pending";
    const review = state.conversation.pending;

    return (
        <details className={ui.assistantPanel} data-pricing-assistant>
            <summary className={ui.assistantSummary}>
                Pricing guidance <span>{state.available ? "Review before using" : "Not enabled"}</span>
            </summary>
            <div className={ui.assistantBody}>
                {!state.available ? (
                    <p role="status">{state.error} Opening this panel does not send your job details to an AI service.</p>
                ) : (
                    <>
                        <p id={`${id}-help`}>Uses your work description, existing activity descriptions and this conversation. Do not enter passwords or confidential client details. Replies need your review; they do not save prices or change your estimate.</p>
                        {state.conversation.messages.length > 0 && (
                            <ol aria-label="Pricing conversation" className={ui.assistantMessages}>
                                {state.conversation.messages.map((message, index) => (
                                    <li key={index}>
                                        <strong>{message.role === "user" ? "You" : "Assistant: review needed"}</strong>
                                        <p>{message.content}</p>
                                    </li>
                                ))}
                            </ol>
                        )}
                        <form aria-label="Ask about pricing this job" onSubmit={event => { event.preventDefault(); void session.send(); }}>
                            <label htmlFor={`${id}-message`}>What would you like help with?</label>
                            <textarea id={`${id}-message`} value={state.message} maxLength={MAX_SCOPE_LENGTH}
                                disabled={blocked} aria-describedby={`${id}-help${blocked ? ` ${id}-blocked` : ""}`}
                                onChange={event => session.setMessage(event.target.value)} rows={3} />
                            {blocked && <p id={`${id}-blocked`}>{blockedNote ?? "Finish or cancel open estimating work first. Client BoQs use their existing workflow."}</p>}
                            <div className={ui.assistantActions}>
                                <button type="submit" disabled={blocked || pending || !state.message.trim() || state.message.length > MAX_SCOPE_LENGTH}>
                                    {pending ? "Waiting for reply" : "Send message"}
                                </button>
                                {pending && <button type="button" onClick={session.cancel}>Stop waiting</button>}
                                <button type="button" onClick={session.reset}>Clear conversation</button>
                            </div>
                        </form>
                        {pending && <p role="status">Waiting for a reply. Nothing has been added to the estimate.</p>}
                        {state.error && <p role="alert">{state.error}</p>}
                        {state.notice && <p role="status">{state.notice}</p>}
                        {review && !blocked && (
                            <section aria-labelledby={`${id}-review`}>
                                <h3 id={`${id}-review`}>Review suggested activities</h3>
                                <p>These are source excerpts, not verified scope. Check exclusions and assumptions. No quantities or rates are filled.</p>
                                <ul className={ui.assistantChoices}>
                                    {review.suggestions.map((suggestion, index) => (
                                        <li key={`${suggestion.source}:${suggestion.start}:${suggestion.end}`}>
                                            <p>{suggestion.source === "briefWork" ? "From saved work" : "From your message"}</p>
                                            <blockquote>{suggestion.description}</blockquote>
                                            <button type="button" onClick={() => session.choose(index)}>Open unpriced draft</button>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}
                    </>
                )}
            </div>
        </details>
    );
}
