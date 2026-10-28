"use client";

import { useId, useSyncExternalStore } from "react";
import { BRIEF_MESSAGE_LIMIT, BRIEF_OPEN_WORK, type BriefConversation, type BriefSuggestionKind } from "@/lib/brief-conversation";
import { suggestionKey } from "@/lib/reviewed-conversation";
import type { WorkspaceStyles } from "@/lib/workspace-styles";

const KIND_LABEL: Record<BriefSuggestionKind, string> = {
    scope: "Scope to consider",
    exclusion: "Possible exclusion",
    "client-question": "Ask the client",
};

/** A055: talk through the job's SAVED brief. Same review-only pattern as the planning panel. */
export default function BriefConversationPanel({ session, blocked, blockedNote, s }: { session: BriefConversation; blocked: boolean; blockedNote?: string; s: WorkspaceStyles }) {
    const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
    const id = useId();
    const pending = state.status === "pending";

    return (
        <details className={`${s.card} p-4 sm:p-5`} data-brief-conversation>
            <summary className={`cursor-pointer text-sm font-semibold ${s.heading}`}>
                Talk through this brief <span className={s.muted}>{state.available ? "Review before using" : "Not enabled"}</span>
            </summary>
            <div className="mt-4 space-y-4">
                {!state.available ? (
                    <p role="status" className={`text-sm ${s.muted}`}>{state.error} Opening this panel does not send your job details anywhere.</p>
                ) : (
                    <>
                        <p id={`${id}-help`} className={`text-sm ${s.muted}`}>Uses your saved brief only: the work description, client type and trades. Site and access notes, client details, value and dates are not used, and unsaved typing is never sent. Do not enter passwords or confidential client details. Replies are suggestions to review: they do not change or save your brief.</p>
                        {state.messages.length > 0 && (
                            <ol aria-label="Brief conversation" className="space-y-3">
                                {state.messages.map((message, turn) => (
                                    <li key={turn} className={`${s.inset} p-3 text-sm ${s.body}`}>
                                        <strong>{message.role === "user" ? "You" : "Assistant: review needed"}</strong>
                                        <p className="whitespace-pre-wrap">{message.content}</p>
                                        {message.role === "assistant" && message.facts.length > 0 && (
                                            <>
                                                <p className="mt-2 font-semibold">From your saved brief</p>
                                                {message.facts.map((fact, index) => <blockquote key={index} className="border-l-2 pl-3">{fact}</blockquote>)}
                                            </>
                                        )}
                                        {message.role === "assistant" && message.assumptions.length > 0 && (
                                            <>
                                                <p className="mt-2 font-semibold">Assumptions to check</p>
                                                <ul className="list-disc pl-5">{message.assumptions.map((item, index) => <li key={index}>{item}</li>)}</ul>
                                            </>
                                        )}
                                        {message.role === "assistant" && message.questions.length > 0 && (
                                            <>
                                                <p className="mt-2 font-semibold">Still to confirm</p>
                                                <ul className="list-disc pl-5">{message.questions.map((item, index) => <li key={index}>{item}</li>)}</ul>
                                            </>
                                        )}
                                        {message.role === "assistant" && message.suggestions.length > 0 && (
                                            <ul aria-label="Suggestions to review" className="mt-2 space-y-2">
                                                {message.suggestions.map((suggestion, index) => {
                                                    const decision = state.decisions[suggestionKey(turn, index)];
                                                    return (
                                                        <li key={index} data-brief-suggestion={decision ?? "open"}>
                                                            <p><span className="font-semibold">{KIND_LABEL[suggestion.kind]}:</span> {suggestion.text}</p>
                                                            {decision ? (
                                                                <p role="status" className={s.muted}>{decision === "kept" ? "Kept on this list. Add it to your brief yourself if it applies, then save." : "Dismissed."}</p>
                                                            ) : (
                                                                <div className="flex flex-wrap gap-2">
                                                                    <button type="button" className={s.quietButton} onClick={() => session.decide(turn, index, "kept")}>Keep on list</button>
                                                                    <button type="button" className={s.quietButton} onClick={() => session.decide(turn, index, "dismissed")}>Dismiss</button>
                                                                </div>
                                                            )}
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        )}
                                    </li>
                                ))}
                            </ol>
                        )}
                        <form aria-label="Discuss this job's brief" onSubmit={event => { event.preventDefault(); void session.send(); }} className="space-y-2">
                            <label htmlFor={`${id}-message`} className={s.label}>What would you like to talk through?</label>
                            <textarea id={`${id}-message`} className={s.textarea} value={state.message} maxLength={BRIEF_MESSAGE_LIMIT} rows={3}
                                disabled={blocked || pending} aria-describedby={`${id}-help${blocked ? ` ${id}-blocked` : ""}`}
                                onChange={event => session.setMessage(event.target.value)} />
                            {blocked && <p id={`${id}-blocked`} className={`text-sm ${s.muted}`}>{blockedNote ?? BRIEF_OPEN_WORK}</p>}
                            <div className="flex flex-wrap gap-2">
                                <button type="submit" className={s.primaryButton} disabled={blocked || pending || !state.message.trim() || state.message.length > BRIEF_MESSAGE_LIMIT}>
                                    {pending ? "Waiting for reply" : "Send message"}
                                </button>
                                {pending && <button type="button" className={s.secondaryButton} onClick={session.cancel}>Stop waiting</button>}
                                {state.canRetry && !blocked && <button type="button" className={s.secondaryButton} onClick={() => void session.retry()}>Try again</button>}
                                <button type="button" className={s.quietButton} disabled={pending} onClick={session.reset}>Clear conversation</button>
                            </div>
                        </form>
                        {pending && <p role="status" className={`text-sm ${s.muted}`}>Waiting for a reply. Nothing has been changed.</p>}
                        {state.error && <p role="alert" className={s.errorBox}>{state.error}</p>}
                        {state.notice && <p role="status" className={s.noticeBox}>{state.notice}</p>}
                    </>
                )}
            </div>
        </details>
    );
}
