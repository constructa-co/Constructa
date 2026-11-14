"use client";

import { useId, useRef, useState, useSyncExternalStore } from "react";
import { assistantOffLabel, explainAssistantOff, type JobAssistantOffReason } from "@/lib/job-assistant-readiness";
import { PLANNING_MESSAGE_LIMIT, suggestionKey, type PlanningConversation, type PlanningSuggestion, type PlanningTopic } from "@/lib/planning-conversation";
import type { AddPlanningItemResult, PlanningProgrammeItem } from "@/lib/planning-programme-item";
import { MAX_STAGE_NAME_LENGTH } from "@/lib/simple-programme";
import type { WorkspaceStyles } from "@/lib/workspace-styles";

const TOPIC_LABEL: Record<PlanningTopic, string> = {
    milestone: "Milestone",
    procurement: "Procurement",
    "client-decision": "Client decision",
};

/**
 * The contractor's own confirmation for one suggestion. They type the stage name
 * and length; nothing is taken from the reply. Saving goes through the page's
 * programme save, which is why it is offered only when that is available.
 */
function AddToProgramme({ suggestion, onAdd, onReload, s, id, sending }: { suggestion: PlanningSuggestion; onAdd: (item: PlanningProgrammeItem) => Promise<AddPlanningItemResult>; onReload?: () => void; s: WorkspaceStyles; id: string; /** Shared by every suggestion in the panel, so only one add is ever being sent. */ sending: { current: boolean } }) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState(suggestion.title.slice(0, MAX_STAGE_NAME_LENGTH));
    const [duration, setDuration] = useState("");
    const [unit, setUnit] = useState<PlanningProgrammeItem["unit"]>("weeks");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [added, setAdded] = useState<string | null>(null);
    // The saved programme changed since this page loaded: adding again here would only be refused again.
    const [stale, setStale] = useState(false);

    if (added) return <p role="status" className={s.muted}>Added to your programme as &ldquo;{added}&rdquo;.</p>;
    if (!open) return <button type="button" className={s.quietButton} onClick={() => setOpen(true)}>Add to programme</button>;

    const confirm = async () => {
        // Taken synchronously: `busy` only lands on the next render, so a second press
        // in the same tick (or on another suggestion) would otherwise get through.
        if (sending.current) return;
        sending.current = true;
        setBusy(true); setError(null); setStale(false);
        try {
            const result = await onAdd({ name, duration, unit });
            if (result.ok) setAdded(result.name); else { setError(result.error); setStale(result.stale === true); }
        } catch {
            setError("The programme couldn't be saved. Nothing has been changed.");
        } finally { sending.current = false; setBusy(false); }
    };

    return (
        <div role="group" aria-label={`Add ${suggestion.title} to the programme`} className="space-y-2" data-planning-add>
            <p className={s.muted}>
                This adds a stage at the end of your saved programme and saves it. Stages run one after another, so it lengthens the programme by the time you enter.
                {suggestion.timing ? ` Timing you gave: ${suggestion.timing}.` : " No timing has been given, so enter the length yourself."}
                {" "}The conversation restarts afterwards because your programme will have changed.
            </p>
            <label htmlFor={`${id}-name`} className={s.label}>Stage name</label>
            <input id={`${id}-name`} className={s.input} value={name} maxLength={MAX_STAGE_NAME_LENGTH} disabled={busy} onChange={event => setName(event.target.value)} />
            <label htmlFor={`${id}-duration`} className={s.label}>How long</label>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-2">
                <input id={`${id}-duration`} className={s.input} inputMode="numeric" autoComplete="off" value={duration} disabled={busy} onChange={event => setDuration(event.target.value)} />
                <select aria-label="Days or weeks" className={s.input} value={unit} disabled={busy} onChange={event => setUnit(event.target.value === "days" ? "days" : "weeks")}>
                    <option value="weeks">weeks</option>
                    <option value="days">working days</option>
                </select>
            </div>
            {error && <p role="alert" className={s.errorBox}>{error}</p>}
            <div className="flex flex-wrap gap-2">
                {stale && onReload
                    ? <button type="button" className={s.primaryButton} onClick={onReload}>Reload programme</button>
                    : <button type="button" className={s.primaryButton} disabled={busy || !name.trim() || !duration.trim() || stale} onClick={() => void confirm()}>{busy ? "Saving" : "Add and save"}</button>}
                <button type="button" className={s.quietButton} disabled={busy} onClick={() => { setOpen(false); setError(null); setStale(false); }}>Cancel</button>
            </div>
        </div>
    );
}

export default function PlanningConversationPanel({ session, blocked, blockedNote, offReason, onAdd, onReload, s }: { session: PlanningConversation; blocked: boolean; blockedNote?: string; offReason?: JobAssistantOffReason | null; /** Present only when this job's saved programme can take a new stage. */ onAdd?: (item: PlanningProgrammeItem) => Promise<AddPlanningItemResult>; /** Reloads the saved programme when an add is refused as stale. */ onReload?: () => void; s: WorkspaceStyles }) {
    const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
    const id = useId();
    const addSending = useRef(false);
    const pending = state.status === "pending";
    const offLabel = assistantOffLabel(offReason);

    return (
        <details className={`${s.card} p-4 sm:p-5`} data-planning-conversation>
            <summary className={`cursor-pointer text-sm font-semibold ${s.heading}`}>
                Talk through milestones, lead times and client decisions <span className={s.muted}>{state.available ? "Review before using" : offLabel ? `Not enabled: ${offLabel}` : "Not enabled"}</span>
            </summary>
            <div className="mt-4 space-y-4">
                {!state.available ? (
                    <p role="status" className={`text-sm ${s.muted}`}>{explainAssistantOff(state.error ?? "", offReason)} Opening this panel does not send your job details anywhere.</p>
                ) : (
                    <>
                        <p id={`${id}-help`} className={`text-sm ${s.muted}`}>Uses this job&apos;s saved programme and what you write here. Do not enter passwords or confidential client details. Replies are suggestions to review: they do not change dates or prices, and nothing is sent to your client. Your programme changes only if you choose to add a suggestion to it and confirm the name and length yourself.</p>
                        {state.messages.length > 0 && (
                            <ol aria-label="Planning conversation" className="space-y-3">
                                {state.messages.map((message, turn) => (
                                    <li key={turn} className={`${s.inset} p-3 text-sm ${s.body}`}>
                                        <strong>{message.role === "user" ? "You" : "Assistant: review needed"}</strong>
                                        <p className="whitespace-pre-wrap">{message.content}</p>
                                        {message.role === "assistant" && message.questions.length > 0 && (
                                            <>
                                                <p className="mt-2 font-semibold">Still to confirm</p>
                                                <ul className="list-disc pl-5">{message.questions.map((question, index) => <li key={index}>{question}</li>)}</ul>
                                            </>
                                        )}
                                        {message.role === "assistant" && message.suggestions.length > 0 && (
                                            <ul aria-label="Suggestions to review" className="mt-2 space-y-2">
                                                {message.suggestions.map((suggestion, index) => {
                                                    const decision = state.decisions[suggestionKey(turn, index)];
                                                    return (
                                                        <li key={index} data-planning-suggestion={decision ?? "open"}>
                                                            <p><span className="font-semibold">{TOPIC_LABEL[suggestion.topic]}:</span> {suggestion.title}</p>
                                                            <p className={s.muted}>
                                                                {suggestion.stage ? `Stage: ${suggestion.stage}. ` : ""}
                                                                {suggestion.timing ? `Timing you gave: ${suggestion.timing}.` : "Timing not given yet."}
                                                            </p>
                                                            {decision ? (
                                                                <p role="status" className={s.muted}>{decision === "kept" ? "Kept on this list. Add it to your programme yourself if it applies." : "Dismissed."}</p>
                                                            ) : (
                                                                <div className="flex flex-wrap gap-2">
                                                                    <button type="button" className={s.quietButton} onClick={() => session.decide(turn, index, "kept")}>Keep on list</button>
                                                                    <button type="button" className={s.quietButton} onClick={() => session.decide(turn, index, "dismissed")}>Dismiss</button>
                                                                </div>
                                                            )}
                                                            {!decision && onAdd && !blocked && <AddToProgramme suggestion={suggestion} onAdd={onAdd} onReload={onReload} s={s} id={`${id}-add-${turn}-${index}`} sending={addSending} />}
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        )}
                                    </li>
                                ))}
                            </ol>
                        )}
                        <form aria-label="Discuss this job's programme" onSubmit={event => { event.preventDefault(); void session.send(); }} className="space-y-2">
                            <label htmlFor={`${id}-message`} className={s.label}>What would you like to talk through?</label>
                            <textarea id={`${id}-message`} className={s.textarea} value={state.message} maxLength={PLANNING_MESSAGE_LIMIT} rows={3}
                                disabled={blocked || pending} aria-describedby={`${id}-help${blocked ? ` ${id}-blocked` : ""}`}
                                onChange={event => session.setMessage(event.target.value)} />
                            {blocked && <p id={`${id}-blocked`} className={`text-sm ${s.muted}`}>{blockedNote ?? "Save or discard your programme changes first. The conversation only uses your saved programme."}</p>}
                            <div className="flex flex-wrap gap-2">
                                <button type="submit" className={s.primaryButton} disabled={blocked || pending || !state.message.trim() || state.message.length > PLANNING_MESSAGE_LIMIT}>
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
