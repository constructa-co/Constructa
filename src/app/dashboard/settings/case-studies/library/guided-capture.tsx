"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useReducer, useRef, useState, type FormEvent } from "react";
import { isDirty, saveLine } from "@/lib/case-library/editor-state";
import {
    GUIDED_MESSAGES, GUIDED_QUESTIONS, answered, characters, clientLines, firstUnanswered, questionAfter, questionBefore, questionDirty, questionForField, questionOf, summaryOf, unsavedNames,
} from "@/lib/case-library/guided";
import { guidedReducer, initialGuidedState, mayLeave, planSave, type AfterSave, type LeaveTo, type Screen } from "@/lib/case-library/guided-state";
import { CANONICAL_WORK_NAMES } from "@/lib/case-library/labels";
import type { LibraryResult, StudyView } from "@/lib/case-library/service";
import type { StoredDiscipline } from "@/lib/case-library/store";
import { useUnsavedGuard } from "@/lib/use-unsaved-guard";
import { createCaseStudyAction, saveCaseStudyAction, saveDisciplineAction } from "../library-actions";

/** Everything the questions can ask the server to do: add the case study, save it, add a kind of work. Nothing else. */
export interface GuidedServer {
    create: (input: { content: unknown; disciplineIds: unknown }) => Promise<LibraryResult>;
    save: (input: { id: unknown; revision: unknown; content: unknown; disciplineIds: unknown }) => Promise<LibraryResult>;
    addDiscipline: (input: { id: null; revision: 0; label: unknown }) => Promise<LibraryResult>;
}

const realServer: GuidedServer = { create: createCaseStudyAction, save: saveCaseStudyAction, addDiscipline: saveDisciplineAction };

const ring = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
const card = "bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-4";
const hint = "text-base text-slate-300";
const input = `mt-3 w-full min-h-11 rounded-lg border border-slate-500 bg-slate-950 px-3 py-2 text-base text-slate-50 placeholder:text-slate-400 ${ring}`;
const primary = `inline-flex items-center justify-center min-h-11 px-4 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-base font-semibold text-white ${ring}`;
const secondary = `inline-flex items-center justify-center min-h-11 px-4 rounded-lg border border-slate-400 text-base font-semibold text-slate-100 hover:bg-white/5 disabled:opacity-60 ${ring}`;
const plain = `inline-flex items-center min-h-11 text-base font-semibold text-blue-200 underline underline-offset-4 ${ring}`;
const chip = (on: boolean) => `min-h-11 px-3 rounded-full border text-sm font-semibold ${ring} ${on ? "bg-blue-700 border-blue-400 text-white" : "border-slate-400 text-slate-100 hover:bg-white/5"}`;

const BASICS = GUIDED_QUESTIONS.filter((question) => question.kind !== "client");
const list = (names: string[]) => names.join(", ");

/**
 * While something is unsaved, the browser's Back button asks before leaving.
 * It works by keeping one extra history entry for this page, so Back lands
 * on this page first and can be refused. With nothing unsaved, Back passes
 * straight through.
 */
function useBackGuard(dirty: boolean) {
    const dirtyNow = useRef(dirty);
    const armed = useRef(false);
    const passing = useRef(false);
    useEffect(() => { dirtyNow.current = dirty; });
    useEffect(() => {
        if (dirty && !armed.current) {
            window.history.pushState(null, "", window.location.href);
            armed.current = true;
        }
    }, [dirty]);
    useEffect(() => {
        const onBack = () => {
            if (!armed.current || passing.current) return;
            if (dirtyNow.current && !window.confirm(GUIDED_MESSAGES.leaveConfirm)) {
                window.history.pushState(null, "", window.location.href);
                return;
            }
            armed.current = false;
            passing.current = true;
            window.history.back();
        };
        window.addEventListener("popstate", onBack);
        return () => window.removeEventListener("popstate", onBack);
    }, []);

    /** Gives this page a new address without loading anything, keeping the extra entry in step so Back still lands here. */
    return (url: string) => {
        if (!armed.current) {
            window.history.replaceState(null, "", url);
            return;
        }
        passing.current = true;
        const settle = () => {
            window.removeEventListener("popstate", settle);
            window.history.replaceState(null, "", url);
            window.history.pushState(null, "", url);
            passing.current = false;
        };
        window.addEventListener("popstate", settle);
        window.history.back();
    };
}

/**
 * A past job, one plain question at a time. It fills in the same draft the
 * full form edits, through the same saves, and the full form is one press
 * away on every screen. It cannot approve anything: checking and approving
 * happen on the full form.
 */
export default function GuidedCapture({ initial, disciplines: initialDisciplines, server = realServer, basePath, listHref }: {
    initial: StudyView | null;
    disciplines: StoredDiscipline[];
    /** Defaults to the real server actions; replaced only by tests and the fixture harness. */
    server?: GuidedServer;
    /** Where case studies live: `${basePath}/new`, `${basePath}/<id>`, and `/guided` under each. */
    basePath: string;
    listHref: string;
}) {
    const router = useRouter();
    const [state, dispatch] = useReducer(guidedReducer, initial, initialGuidedState);
    const [disciplines, setDisciplines] = useState(initialDisciplines);
    const [newKind, setNewKind] = useState("");
    const [kindNotice, setKindNotice] = useState<string | null>(null);
    const [addingKind, setAddingKind] = useState(false);
    const [leaving, setLeaving] = useState<LeaveTo | null>(null);
    const stateRef = useRef(state);
    const requestRunning = useRef(false);
    const heading = useRef<HTMLHeadingElement>(null);
    const firstScreen = useRef(true);
    useEffect(() => { stateRef.current = state; });

    const { editor, screen } = state;
    const content = editor.draft.content;
    const dirty = isDirty(editor);
    const saving = editor.saving !== null;
    const unsaved = unsavedNames(editor);
    const active = disciplines.filter((entry) => !entry.archived);
    const formHref = `${basePath}/${editor.id ?? "new"}`;
    const hrefOf = (to: LeaveTo) => (to === "form" ? formHref : listHref);

    // Reload, closing the tab, and any link on the page ask first. So does the browser's Back button.
    useUnsavedGuard(dirty, GUIDED_MESSAGES.leaveConfirm);
    const renameAddress = useBackGuard(dirty);

    // Each new screen starts at its question, for a keyboard and for a screen reader.
    const screenName = screen.kind === "question" ? screen.key : screen.kind;
    useEffect(() => {
        if (firstScreen.current) { firstScreen.current = false; return; }
        heading.current?.focus();
    }, [screenName]);

    // A save that was confirmed, where the contractor had asked to leave afterwards. It goes only if nothing
    // on the screen is unsaved at this moment and no save is running, whatever was decided earlier.
    const leaveNow = mayLeave(state) ? state.leave : null;
    const going = useRef(false);
    useEffect(() => {
        if (!leaveNow || going.current) return;
        going.current = true;
        router.push(leaveNow === "form" ? `${basePath}/${state.editor.id ?? "new"}` : listHref);
    }, [leaveNow, state.editor.id, basePath, listHref, router]);
    // Asked to leave, saved what was sent, but something typed since is not saved: the choice is put again.
    const leavePanel = leaving ?? state.leaveHeld;
    const stay = () => { setLeaving(null); dispatch({ type: "leave/stay" }); };

    const save = async (then: AfterSave, again = false) => {
        // One request at a time, decided before anything is sent.
        if (requestRunning.current) return;
        const { plan } = planSave(stateRef.current, again);
        dispatch({ type: "save/start", then, again });
        if (!plan) return;
        requestRunning.current = true;
        let result: LibraryResult;
        try {
            result = plan.id
                ? await server.save({ id: plan.id, revision: plan.revision, content: plan.sent.content, disciplineIds: plan.sent.disciplineIds })
                : await server.create({ content: plan.sent.content, disciplineIds: plan.sent.disciplineIds });
        } catch {
            // The request itself failed. Whether it reached the server is not known.
            result = { status: "unknown", message: plan.id ? GUIDED_MESSAGES.requestFailed : GUIDED_MESSAGES.createUnknown };
        }
        requestRunning.current = false;
        dispatch({ type: "save/reply", token: plan.token, result });
        if (result.disciplines) setDisciplines(result.disciplines);
        // Now that it exists, this page's address becomes its own, so a reload comes back to it and not to a blank one.
        if (!plan.id && result.id && (result.status === "saved" || result.status === "partial")) renameAddress(`${basePath}/${result.id}/guided`);
    };

    const go = (to: Screen) => dispatch({ type: "go", screen: to });

    const addKind = async () => {
        if (addingKind || newKind.trim() === "") return;
        setAddingKind(true);
        setKindNotice(null);
        try {
            const result = await server.addDiscipline({ id: null, revision: 0, label: newKind });
            if (result.disciplines) setDisciplines(result.disciplines);
            if (result.status === "saved" && result.id) {
                // Ticked for this job only, and not saved to it until the contractor saves.
                const chosen = stateRef.current.editor.draft.disciplineIds;
                if (chosen.length < 6 && !chosen.includes(result.id)) dispatch({ type: "edit", disciplineIds: [...chosen, result.id] });
                setNewKind("");
            } else {
                setKindNotice(result.message);
            }
        } catch {
            setKindNotice("We couldn't confirm whether that was added. Check the list before adding it again.");
        }
        setAddingKind(false);
    };

    const toggleKind = (id: string) => {
        const chosen = editor.draft.disciplineIds;
        if (chosen.includes(id)) dispatch({ type: "edit", disciplineIds: chosen.filter((entry) => entry !== id) });
        else if (chosen.length < 6) dispatch({ type: "edit", disciplineIds: [...chosen, id] });
    };

    /** The full form and the list: a plain link when nothing would be lost, otherwise a choice. */
    const leaveControl = (to: LeaveTo, text: string) => (dirty || saving
        ? <button type="button" className={plain} onClick={() => setLeaving(to)}>{text}</button>
        : <Link href={hrefOf(to)} className={plain}>{text}</Link>);

    const noticeKind = editor.notice.kind;
    const status = state.leave ? "Saved. Opening…"
        : saving ? "Saving…"
        : noticeKind !== "none" && noticeKind !== "saved" ? saveLine(editor)
            : dirty ? (editor.id ? `Changes not saved: ${list(unsaved)}.` : "Not saved yet.")
                : editor.id ? "Saved." : "Nothing saved yet.";
    const troubleField = noticeKind === "failed" ? questionForField(editor.notice.kind === "failed" ? editor.notice.field : null) : noticeKind === "partial" ? "kinds" : null;
    const current = screen.kind === "question" ? screen.key : null;

    const question = current ? questionOf(current) : null;
    const forward: Screen = current && questionAfter(current) ? { kind: "question", key: questionAfter(current)! } : { kind: "done" };
    const back: Screen | null = current && questionBefore(current) ? { kind: "question", key: questionBefore(current)! } : null;
    const currentDirty = current ? questionDirty(editor, current) : false;
    const others = current ? unsaved.filter((name) => name !== questionOf(current).name) : unsaved;
    const mustSave = dirty || editor.id === null;

    const onSubmit = (event: FormEvent) => {
        event.preventDefault();
        if (saving || state.createUnknown) return;
        if (mustSave) void save(forward);
        else go(forward);
    };

    return (
        <div className="space-y-5" data-guided-capture>
            <div className="space-y-2">
                <div className="flex flex-wrap gap-x-6 gap-y-1">
                    {leaveControl("list", "Back to case studies")}
                    {leaveControl("form", "Use the full form instead")}
                </div>
                <p role="status" aria-live="polite" data-save-line className={`text-base font-semibold ${noticeKind === "none" || noticeKind === "saved" ? "text-slate-100" : "text-amber-200"}`}>{status}</p>
                {state.moveHeld && dirty && <p role="alert" data-move-held className="text-base font-semibold text-amber-200">{GUIDED_MESSAGES.moveHeld}</p>}
                {state.local && <p role="alert" data-guided-refusal className="text-base font-semibold text-amber-200">{state.local.message}</p>}
                {state.local && state.local.key && state.local.key !== current && (
                    <button type="button" className={secondary} onClick={() => go({ kind: "question", key: state.local!.key! })}>Go to that question</button>
                )}
                {troubleField && troubleField !== current && (
                    <button type="button" className={secondary} onClick={() => go({ kind: "question", key: troubleField })}>Go to {questionOf(troubleField).name}</button>
                )}
                {initial?.approved && <p className={hint} data-approval-line>Approved earlier. Proposals keep using the approved version until you approve again on the full form.</p>}
            </div>

            {leavePanel && !state.leave && (
                <section className={`${card} border-amber-300`} aria-label="Before you go" data-leave>
                    <h2 className="text-lg font-bold text-slate-50">Before you go</h2>
                    {state.leaveHeld && !leaving && <p role="alert" data-leave-held className="text-base font-semibold text-amber-200">{GUIDED_MESSAGES.leaveHeld}</p>}
                    <p className={hint}>{saving ? "A save is still running." : `Not saved yet: ${list(unsaved) || "nothing"}.`}</p>
                    <div className="flex flex-wrap gap-2">
                        <button type="button" className={primary} disabled={saving || state.createUnknown} onClick={() => { const to = leavePanel; setLeaving(null); void save({ kind: "leave", to }); }}>Save, then go</button>
                        <button type="button" className={secondary} onClick={() => router.push(hrefOf(leavePanel))}>Go without saving</button>
                        <button type="button" className={secondary} onClick={stay}>Stay here</button>
                    </div>
                </section>
            )}

            {state.createUnknown && (
                <section className={`${card} border-amber-300`} aria-label="We couldn't confirm it was added" data-create-unknown>
                    <h2 className="text-lg font-bold text-slate-50">We couldn&apos;t confirm it was added</h2>
                    <p className={hint}>{GUIDED_MESSAGES.createAgainWarning}</p>
                    <div className="flex flex-wrap gap-2">
                        <a href={listHref} target="_blank" rel="noreferrer" className={secondary}>Check my case studies (opens a new tab)</a>
                        <button type="button" className={secondary} disabled={saving} onClick={() => void save(forward, true)}>It isn&apos;t there. Add it again</button>
                    </div>
                </section>
            )}

            {editor.latest && (noticeKind === "conflict" || noticeKind === "unknown") && (
                <section className={`${card} border-amber-300`} aria-label="The latest saved version" data-latest>
                    <h2 className="text-lg font-bold text-slate-50">The latest saved version</h2>
                    <p className={hint}>This is what is saved now. What you typed is still here.</p>
                    <dl className="text-base text-slate-100 space-y-1">
                        <div><dt className="font-semibold inline">Job: </dt><dd className="inline break-words">{editor.latest.content.title}</dd></div>
                        <div><dt className="font-semibold inline">What you did: </dt><dd className="inline whitespace-pre-wrap break-words">{editor.latest.content.delivered || "(nothing)"}</dd></div>
                        <div><dt className="font-semibold inline">What it meant for the client: </dt><dd className="inline whitespace-pre-wrap break-words">{editor.latest.content.value_added || "(nothing)"}</dd></div>
                        <div><dt className="font-semibold inline">Where and how long: </dt><dd className="inline break-words">{[editor.latest.content.place, editor.latest.content.duration_text].filter(Boolean).join(", ") || "(nothing)"}</dd></div>
                        <div><dt className="font-semibold inline">Kinds of work: </dt><dd className="inline">{active.filter((entry) => editor.latest!.disciplineIds.includes(entry.id)).map((entry) => entry.label).join(", ") || "(none)"}</dd></div>
                        <div><dt className="font-semibold inline">Client and price: </dt><dd className="inline break-words">{clientLines(editor.latest.content).join(" ")}</dd></div>
                    </dl>
                    <p className={hint}>Keeping your changes keeps only the answers you changed{unsaved.length > 0 ? ` (${list(unsaved)})` : ""}. Everything else will be the saved version. Nothing is saved until you press save.</p>
                    <div className="flex flex-wrap gap-2">
                        <button type="button" className={secondary} onClick={() => dispatch({ type: "latest/keep-mine" })}>Keep my changes</button>
                        <button type="button" className={secondary} onClick={() => dispatch({ type: "latest/use" })}>Use the saved version instead</button>
                    </div>
                </section>
            )}

            {screen.kind === "summary" && (
                <section className={card} aria-labelledby="guided-heading" data-guided-screen="summary">
                    <h1 id="guided-heading" ref={heading} tabIndex={-1} className="text-2xl font-bold text-slate-50 focus:outline-none">{content.title.trim() || "This past job"}</h1>
                    <p className={hint}>Here is what is saved for this job. {GUIDED_MESSAGES.notKept}</p>
                    <ul className="divide-y divide-slate-700">
                        {summaryOf(editor, (id) => active.find((entry) => entry.id === id)?.label ?? null).map((line) => (
                            <li key={line.key} className="py-3 space-y-1" data-summary={line.key}>
                                <p className="text-base font-semibold text-slate-100">{line.title}</p>
                                {line.lines.length === 0
                                    ? <p className="text-base text-slate-300">Not answered</p>
                                    : line.lines.map((text, index) => <p key={index} className="text-base text-slate-100 whitespace-pre-wrap break-words">{text}</p>)}
                                {line.unsaved && <p className="text-base font-semibold text-amber-200">Changed, not saved yet</p>}
                                <button type="button" className={secondary} aria-label={`${line.lines.length === 0 ? "Answer" : "Change"}: ${line.title}`} onClick={() => go({ kind: "question", key: line.key })}>{line.lines.length === 0 ? "Answer" : "Change"}</button>
                            </li>
                        ))}
                    </ul>
                    <div className="flex flex-wrap gap-2 border-t border-slate-700 pt-4">
                        {firstUnanswered(editor.draft)
                            ? <button type="button" className={primary} onClick={() => go({ kind: "question", key: firstUnanswered(editor.draft)! })}>Carry on</button>
                            : <button type="button" className={primary} onClick={() => go({ kind: "done" })}>Finish</button>}
                        {dirty && <button type="button" className={secondary} disabled={saving || state.createUnknown} onClick={() => void save(null)}>Save changes</button>}
                    </div>
                </section>
            )}

            {question && current && (
                <form className={card} onSubmit={onSubmit} aria-labelledby="guided-heading" data-guided-screen={current} noValidate inert={state.leave !== null}>
                    <p className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                        {question.kind === "client" ? "Optional extra" : `Question ${BASICS.findIndex((entry) => entry.key === current) + 1} of ${BASICS.length}${question.required ? "" : " (optional)"}`}
                    </p>
                    <h1 id="guided-heading" ref={heading} tabIndex={-1} className="text-2xl font-bold text-slate-50 focus:outline-none">
                        {question.field ? <label htmlFor="guided-answer">{question.title}</label> : question.title}
                    </h1>
                    <p id="guided-help" className={hint}>{question.help}{question.example ? ` For example: ${question.example}` : ""}</p>

                    {question.kind === "line" && (
                        <input id="guided-answer" className={input} value={content[question.field!]} enterKeyHint="next" autoComplete="off" aria-describedby="guided-help" onChange={(event) => dispatch({ type: "edit", content: { [question.field!]: event.target.value } })} />
                    )}
                    {question.kind === "text" && (
                        <textarea id="guided-answer" className={input} rows={6} value={content[question.field!]} aria-describedby="guided-help" onChange={(event) => dispatch({ type: "edit", content: { [question.field!]: event.target.value } })} />
                    )}
                    {question.field && question.limit && characters(content[question.field]) > question.limit * 0.8 && (
                        <p className={characters(content[question.field]) > question.limit ? "text-base font-semibold text-amber-200" : hint} data-count>
                            {characters(content[question.field]).toLocaleString("en-GB")} of {question.limit.toLocaleString("en-GB")} characters.{characters(content[question.field]) > question.limit ? " That's too long to save. Nothing has been cut." : ""}
                        </p>
                    )}

                    {question.kind === "kinds" && (
                        <div className="space-y-3">
                            {active.length > 0 ? (
                                <div className="flex flex-wrap gap-2" role="group" aria-label="Your kinds of work">
                                    {active.map((entry) => (
                                        <button key={entry.id} type="button" aria-pressed={editor.draft.disciplineIds.includes(entry.id)} className={chip(editor.draft.disciplineIds.includes(entry.id))} onClick={() => toggleKind(entry.id)}>{entry.label}</button>
                                    ))}
                                </div>
                            ) : <p className={hint}>You haven&apos;t added any kinds of work yet. Add one below, or skip this.</p>}
                            <p className={hint}>Up to 6 for one job.</p>
                            <div className="flex flex-wrap items-end gap-2">
                                <div className="min-w-0 flex-1">
                                    <label htmlFor="guided-new-kind" className="block text-base font-semibold text-slate-100">Add another kind of work</label>
                                    <input id="guided-new-kind" list="guided-kind-names" className={input} value={newKind} autoComplete="off" onChange={(event) => setNewKind(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void addKind(); } }} placeholder="e.g. Kitchen Installation" />
                                    <datalist id="guided-kind-names">{CANONICAL_WORK_NAMES.filter((name) => !disciplines.some((entry) => entry.label.toLowerCase() === name.toLowerCase())).map((name) => <option key={name} value={name} />)}</datalist>
                                </div>
                                <button type="button" className={secondary} disabled={addingKind || newKind.trim() === ""} onClick={() => void addKind()}>Add</button>
                            </div>
                            {kindNotice && <p role="alert" className="text-base font-semibold text-amber-200">{kindNotice}</p>}
                        </div>
                    )}

                    {question.kind === "client" && (
                        <div className="space-y-4">
                            <fieldset>
                                <legend className="block text-base font-semibold text-slate-100">How should we refer to the client?</legend>
                                {([["hidden", "Don't mention them"], ["described", "Describe them, without a name"], ["named", "Name them"]] as const).map(([value, text]) => (
                                    <label key={value} className="mt-1 flex items-center gap-3 min-h-11 text-base text-slate-100">
                                        <input type="radio" name="guided-client-display" className="w-5 h-5" checked={content.client_display === value} onChange={() => dispatch({ type: "edit", content: { client_display: value, ...(value === "named" ? {} : { client_named_ok: false }) } })} />
                                        {text}
                                    </label>
                                ))}
                            </fieldset>
                            {content.client_display !== "hidden" && (
                                <div>
                                    <label htmlFor="guided-client" className="block text-base font-semibold text-slate-100">{content.client_display === "named" ? "The client's name" : "How to describe them"}</label>
                                    <input id="guided-client" className={input} value={content.client_text} autoComplete="off" onChange={(event) => dispatch({ type: "edit", content: { client_text: event.target.value } })} placeholder={content.client_display === "named" ? "" : "e.g. a homeowner in Leeds"} />
                                </div>
                            )}
                            {content.client_display === "named" && (
                                <label className="flex items-start gap-3 min-h-11 text-base text-slate-100">
                                    <input type="checkbox" className="mt-1 w-5 h-5 flex-shrink-0" checked={content.client_named_ok} onChange={(event) => dispatch({ type: "edit", content: { client_named_ok: event.target.checked } })} />
                                    They&apos;ve agreed to be named
                                </label>
                            )}
                            <label className="flex items-start gap-3 min-h-11 text-base text-slate-100">
                                <input type="checkbox" className="mt-1 w-5 h-5 flex-shrink-0" checked={content.show_value} onChange={(event) => dispatch({ type: "edit", content: { show_value: event.target.checked } })} />
                                Show a price for this job
                            </label>
                            {content.show_value && (
                                <div>
                                    <label htmlFor="guided-value" className="block text-base font-semibold text-slate-100">The price to show</label>
                                    <input id="guided-value" className={input} value={content.value_text} autoComplete="off" onChange={(event) => dispatch({ type: "edit", content: { value_text: event.target.value } })} placeholder="e.g. £18,500" />
                                </div>
                            )}
                        </div>
                    )}

                    {mustSave && others.length > 0 && <p className={hint} data-also-saving>Saving will also save your changes to: {list(others)}.</p>}
                    <div className="flex flex-wrap gap-2 border-t border-slate-700 pt-4">
                        {!state.createUnknown && (
                            <button type="submit" className={primary} disabled={saving}>
                                {saving ? "Saving…" : mustSave ? "Save and next" : answered(editor.draft, current) ? "Next" : "Skip"}
                            </button>
                        )}
                        {mustSave && editor.id !== null && !currentDirty && <button type="button" className={secondary} onClick={() => go(forward)}>Skip for now</button>}
                        {back && <button type="button" className={secondary} onClick={() => go(back)}>Back</button>}
                        {editor.id !== null && <button type="button" className={secondary} onClick={() => go({ kind: "summary" })}>See all answers</button>}
                    </div>
                </form>
            )}

            {screen.kind === "done" && (
                <section className={card} aria-labelledby="guided-heading" data-guided-screen="done">
                    <h1 id="guided-heading" ref={heading} tabIndex={-1} className="text-2xl font-bold text-slate-50 focus:outline-none">That&apos;s the basics</h1>
                    {dirty ? (
                        <>
                            <p className="text-base font-semibold text-amber-200">Not saved yet: {list(unsaved)}.</p>
                            <button type="button" className={primary} disabled={saving || state.createUnknown} onClick={() => void save(null)}>{saving ? "Saving…" : "Save changes"}</button>
                        </>
                    ) : (
                        <p className="text-base text-slate-100">It&apos;s saved as a draft. Clients can&apos;t see it, and no proposal uses it, until you check and approve it on the full form.</p>
                    )}
                    <p className={hint}>This is your own wording, as you typed it. Pictures can&apos;t be added to new case studies yet.</p>
                    <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-slate-700 pt-4">
                        {leaveControl("form", "Check and approve on the full form")}
                        <button type="button" className={plain} onClick={() => go({ kind: "summary" })}>See all answers</button>
                        {leaveControl("list", "Back to case studies")}
                    </div>
                </section>
            )}
        </div>
    );
}
