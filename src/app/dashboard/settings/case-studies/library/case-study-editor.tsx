"use client";

import Link from "next/link";
import { useEffect, useReducer, useRef, useState } from "react";
import { newDraft, type ApprovedCaseStudy, type CaseStudyContent } from "@/lib/case-library/content";
import { editorReducer, initialEditorState, isDirty, saveLine } from "@/lib/case-library/editor-state";
import { CANONICAL_WORK_NAMES } from "@/lib/case-library/labels";
import type { ApprovalCheck, LibraryResult, StudyView } from "@/lib/case-library/service";
import { asProposalCaseStudy, changesSinceApproval } from "@/lib/case-library/status";
import type { StoredDiscipline } from "@/lib/case-library/store";
import { approveCaseStudyAction, checkCaseStudyAction, createCaseStudyAction, saveCaseStudyAction, saveDisciplineAction } from "../library-actions";

export interface EditorServer {
    create: (input: { content: unknown; disciplineIds: unknown }) => Promise<LibraryResult>;
    save: (input: { id: unknown; revision: unknown; content: unknown; disciplineIds: unknown }) => Promise<LibraryResult>;
    check: (id: string) => Promise<{ status: "ok"; check: ApprovalCheck } | LibraryResult>;
    approve: (input: { id: unknown; revision: unknown; confirmed: unknown }) => Promise<LibraryResult>;
    addDiscipline: (input: { id: null; revision: 0; label: unknown }) => Promise<LibraryResult>;
}

const realServer: EditorServer = { create: createCaseStudyAction, save: saveCaseStudyAction, check: checkCaseStudyAction, approve: approveCaseStudyAction, addDiscipline: saveDisciplineAction };

const card = "bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-4";
const label = "block text-base font-semibold text-slate-100";
const hint = "text-sm text-slate-300";
const input = "mt-2 w-full min-h-11 rounded-lg border border-slate-500 bg-slate-950 px-3 py-2 text-base text-slate-50 placeholder:text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
const primary = "min-h-11 px-4 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-base font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
const secondary = "min-h-11 px-4 rounded-lg border border-slate-400 text-base font-semibold text-slate-100 hover:bg-white/5 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
const chip = (on: boolean) => `min-h-11 px-3 rounded-full border text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${on ? "bg-blue-700 border-blue-400 text-white" : "border-slate-400 text-slate-100 hover:bg-white/5"}`;

/** An approved copy as a proposal would carry it, under the proposal's own headings. */
export function ApprovedPreview({ approved }: { approved: ApprovedCaseStudy }) {
    const study = asProposalCaseStudy(approved);
    if (!study) return <p className="text-base text-amber-200">This can&apos;t be shown yet. Check each box above.</p>;
    const facts = [["Type of work", study.project_type], ["Location", study.location], ["Client", study.client], ["Value", study.contract_value], ["Programme", study.duration]].filter((fact): fact is [string, string] => Boolean(fact[1]));
    return (
        <div data-approved-preview className="rounded-lg bg-white text-stone-900 p-4 space-y-3">
            <h4 className="text-xl font-semibold break-words">{study.title}</h4>
            {facts.length > 0 && (
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                    {facts.map(([name, value]) => (<div key={name}><dt className="font-semibold">{name}</dt><dd className="break-words">{value}</dd></div>))}
                </dl>
            )}
            {study.delivered && (<div><p className="text-sm font-semibold uppercase tracking-wide">What we delivered</p><p className="text-base whitespace-pre-wrap break-words">{study.delivered}</p></div>)}
            {study.value_added && (<div><p className="text-sm font-semibold uppercase tracking-wide">Value added</p><p className="text-base whitespace-pre-wrap break-words">{study.value_added}</p></div>)}
        </div>
    );
}

export default function CaseStudyEditor({ initial, disciplines: initialDisciplines, server = realServer, listHref, onCreated }: {
    initial: StudyView | null;
    disciplines: StoredDiscipline[];
    /** Defaults to the real server actions; replaced only by tests and the fixture harness. */
    server?: EditorServer;
    listHref: string;
    onCreated?: (id: string) => void;
}) {
    const [state, dispatch] = useReducer(editorReducer, undefined, () => initialEditorState(initial, newDraft("")));
    const [disciplines, setDisciplines] = useState(initialDisciplines);
    const [approved, setApproved] = useState<{ copy: ApprovedCaseStudy; revision: number } | null>(initial?.approved ? { copy: initial.approved, revision: initial.approvedRevision ?? 0 } : null);
    const [more, setMore] = useState(Boolean(initial && (initial.content.client_display !== "hidden" || initial.content.show_value || initial.content.client_text || initial.content.value_text)));
    const [newKind, setNewKind] = useState("");
    const [kindNotice, setKindNotice] = useState<string | null>(null);
    const [check, setCheck] = useState<ApprovalCheck | null>(null);
    const [checkNotice, setCheckNotice] = useState<string | null>(null);
    const [confirmed, setConfirmed] = useState(false);
    const [working, setWorking] = useState(false);
    const stateRef = useRef(state);
    useEffect(() => { stateRef.current = state; });

    const dirty = isDirty(state);
    const content = state.draft.content;
    const active = disciplines.filter((entry) => !entry.archived);
    const busy = state.saving !== null || working;
    const set = (patch: Partial<CaseStudyContent>) => { dispatch({ type: "edit", content: patch }); setCheck(null); };

    // Leaving with something typed and not saved asks first.
    useEffect(() => {
        if (!dirty) return;
        const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [dirty]);

    const save = async () => {
        const now = stateRef.current;
        // One save at a time: a second press while one is running does nothing.
        if (now.saving) return;
        const token = now.nextToken;
        dispatch({ type: "save/start" });
        const sent = { content: now.draft.content, disciplineIds: now.draft.disciplineIds };
        let result: LibraryResult;
        try {
            result = now.id ? await server.save({ id: now.id, revision: now.revision, ...sent }) : await server.create(sent);
        } catch {
            // The request itself failed. Whether it reached the server is not known.
            result = { status: "unknown", message: "We couldn't confirm whether this was saved. Your wording is still here. Check your connection, then try again." };
        }
        dispatch({ type: "save/reply", token, result });
        if (result.disciplines) setDisciplines(result.disciplines);
        if (!now.id && result.id && (result.status === "saved" || result.status === "partial")) onCreated?.(result.id);
    };

    const addKind = async (text: string) => {
        if (working) return;
        setWorking(true);
        setKindNotice(null);
        try {
            const result = await server.addDiscipline({ id: null, revision: 0, label: text });
            if (result.disciplines) setDisciplines(result.disciplines);
            if (result.status === "saved" && result.id) {
                if (stateRef.current.draft.disciplineIds.length < 6) dispatch({ type: "edit", disciplineIds: [...stateRef.current.draft.disciplineIds, result.id] });
                setNewKind("");
            } else {
                setKindNotice(result.message);
            }
        } catch {
            setKindNotice("We couldn't confirm whether that was added. Check the list before adding it again.");
        }
        setWorking(false);
    };

    const openCheck = async () => {
        if (!state.id || dirty || busy) return;
        setWorking(true);
        setCheckNotice(null);
        setConfirmed(false);
        try {
            const result = await server.check(state.id);
            if (result.status === "ok") {
                setCheck(result.check);
                dispatch({ type: "adopt", view: result.check.study });
            } else {
                setCheck(null);
                setCheckNotice(result.message);
            }
        } catch {
            setCheckNotice("We couldn't load the latest saved version. Try again.");
        }
        setWorking(false);
    };

    const approve = async () => {
        if (!check || working) return;
        setWorking(true);
        setCheckNotice(null);
        try {
            // The revision named is the one this check was loaded at, not whatever the screen holds now.
            const result = await server.approve({ id: check.study.id, revision: check.study.revision, confirmed });
            if (result.status === "approved") {
                setApproved({ copy: result.latest?.approved ?? check.wouldApprove, revision: check.study.revision });
                setCheck(null);
                setCheckNotice(result.message);
                if (result.latest) dispatch({ type: "adopt", view: result.latest });
            } else {
                setCheckNotice(result.message);
                // Anything other than a missing tick means what was shown may be out of date: load it again.
                if (result.status !== "unconfirmed") {
                    const again = await server.check(check.study.id);
                    setConfirmed(false);
                    if (again.status === "ok") { setCheck(again.check); dispatch({ type: "adopt", view: again.check.study }); } else setCheck(null);
                }
            }
        } catch {
            setCheckNotice("We couldn't confirm whether this was approved. Check its status on the Case Studies page before trying again.");
        }
        setWorking(false);
    };

    const toggleKind = (id: string) => {
        const chosen = state.draft.disciplineIds;
        if (chosen.includes(id)) dispatch({ type: "edit", disciplineIds: chosen.filter((entry) => entry !== id) });
        else if (chosen.length < 6) dispatch({ type: "edit", disciplineIds: [...chosen, id] });
        setCheck(null);
    };

    const currentLabels = active.filter((entry) => state.saved.disciplineIds.includes(entry.id)).map((entry) => entry.label);
    const sinceApproval = approved ? changesSinceApproval(approved.copy, state.saved.content, currentLabels) : [];
    const noticeTone = state.notice.kind === "saved" || state.notice.kind === "none" ? "text-slate-100" : "text-amber-200";
    const invalid = (field: string) => (state.notice.kind === "failed" && state.notice.field === field ? { "aria-invalid": true as const } : {});
    const suggestions = CANONICAL_WORK_NAMES.filter((name) => !disciplines.some((entry) => entry.label.toLowerCase() === name.toLowerCase()));

    return (
        <div className="space-y-5" data-case-study-editor>
            <div className="space-y-2">
                <Link href={listHref} className="inline-flex items-center min-h-11 text-base font-semibold text-blue-200 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">Back to case studies</Link>
                <h1 className="text-2xl font-bold text-slate-50">{state.id ? "Edit this past job" : "Add a past job"}</h1>
                <p role="status" aria-live="polite" data-save-line className={`text-base font-semibold ${noticeTone}`}>{saveLine(state)}</p>
                {approved && (
                    <p className="text-base text-slate-200" data-approval-line>
                        {sinceApproval.length === 0 && !dirty
                            ? "Approved. Proposals use this version."
                            : `Approved earlier. Proposals keep using the approved version until you approve again.${sinceApproval.length > 0 ? ` Changed since: ${sinceApproval.join(", ")}.` : ""}`}
                    </p>
                )}
            </div>

            {state.latest && (state.notice.kind === "conflict" || state.notice.kind === "unknown") && (
                <section className={`${card} border-amber-300`} aria-label="The latest saved version" data-latest>
                    <h2 className="text-lg font-bold text-slate-50">The latest saved version</h2>
                    <p className={hint}>This is what is saved now. What you typed is still in the boxes below.</p>
                    <dl className="text-base text-slate-100 space-y-1">
                        <div><dt className="font-semibold inline">Job: </dt><dd className="inline break-words">{state.latest.content.title}</dd></div>
                        <div><dt className="font-semibold inline">What you did: </dt><dd className="inline whitespace-pre-wrap break-words">{state.latest.content.delivered || "(nothing)"}</dd></div>
                        <div><dt className="font-semibold inline">Kinds of work: </dt><dd className="inline">{active.filter((entry) => state.latest!.disciplineIds.includes(entry.id)).map((entry) => entry.label).join(", ") || "(none)"}</dd></div>
                    </dl>
                    <div className="flex flex-wrap gap-2">
                        <button type="button" className={secondary} onClick={() => dispatch({ type: "latest/keep-mine" })}>Keep what I typed</button>
                        <button type="button" className={secondary} onClick={() => dispatch({ type: "latest/use" })}>Use the saved version instead</button>
                    </div>
                </section>
            )}

            <section className={card} aria-label="The job">
                <div>
                    <label htmlFor="cs-title" className={label}>What was the job?</label>
                    <input id="cs-title" className={input} value={content.title} maxLength={200} onChange={(event) => set({ title: event.target.value })} placeholder="e.g. Kitchen refit, 14 Example Road" {...invalid("title")} />
                </div>

                <fieldset>
                    <legend className={label}>What kind of work was it? <span className="font-normal text-slate-300">(optional, up to 6)</span></legend>
                    <p className={hint}>This helps you pick the right past jobs for each proposal.</p>
                    {active.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                            {active.map((entry) => (
                                <button key={entry.id} type="button" aria-pressed={state.draft.disciplineIds.includes(entry.id)} className={chip(state.draft.disciplineIds.includes(entry.id))} onClick={() => toggleKind(entry.id)}>{entry.label}</button>
                            ))}
                        </div>
                    )}
                    <div className="mt-3 flex flex-wrap items-end gap-2">
                        <div className="min-w-0 flex-1">
                            <label htmlFor="cs-new-kind" className="block text-sm font-semibold text-slate-100">Add another kind of work</label>
                            <input id="cs-new-kind" list="cs-kind-names" className={input} value={newKind} maxLength={80} onChange={(event) => setNewKind(event.target.value)} placeholder="e.g. Kitchen Installation" />
                            <datalist id="cs-kind-names">{suggestions.map((name) => <option key={name} value={name} />)}</datalist>
                        </div>
                        <button type="button" className={secondary} disabled={working || newKind.trim() === ""} onClick={() => addKind(newKind)}>Add</button>
                    </div>
                    {kindNotice && <p role="alert" className="mt-2 text-base font-semibold text-amber-200">{kindNotice}</p>}
                </fieldset>

                <div>
                    <label htmlFor="cs-delivered" className={label}>What did you do? <span className="font-normal text-slate-300">(optional)</span></label>
                    <textarea id="cs-delivered" className={input} rows={5} value={content.delivered} maxLength={5000} onChange={(event) => set({ delivered: event.target.value })} {...invalid("delivered")} />
                </div>
                <div>
                    <label htmlFor="cs-value-added" className={label}>What did it mean for the client? <span className="font-normal text-slate-300">(optional)</span></label>
                    <textarea id="cs-value-added" className={input} rows={3} value={content.value_added} maxLength={5000} onChange={(event) => set({ value_added: event.target.value })} {...invalid("value_added")} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="cs-place" className={label}>Roughly where? <span className="font-normal text-slate-300">(optional)</span></label>
                        <input id="cs-place" className={input} value={content.place} maxLength={200} onChange={(event) => set({ place: event.target.value })} placeholder="Town or area, not the address" {...invalid("place")} />
                    </div>
                    <div>
                        <label htmlFor="cs-duration" className={label}>How long did it take? <span className="font-normal text-slate-300">(optional)</span></label>
                        <input id="cs-duration" className={input} value={content.duration_text} maxLength={100} onChange={(event) => set({ duration_text: event.target.value })} placeholder="e.g. 3 weeks" {...invalid("duration_text")} />
                    </div>
                </div>

                <div>
                    <button type="button" className={secondary} aria-expanded={more} aria-controls="cs-more" onClick={() => setMore(!more)}>{more ? "Hide client and price" : "More, if you want: client and price"}</button>
                    {!more && <p className={`${hint} mt-2`}>Unless you change it here, the client is not mentioned and no price is shown.</p>}
                </div>
                {more && (
                    <div id="cs-more" className="space-y-4 border-t border-slate-700 pt-4">
                        <fieldset>
                            <legend className={label}>How should we refer to the client?</legend>
                            {([["hidden", "Don't mention them"], ["described", "Describe them, without a name"], ["named", "Name them"]] as const).map(([value, text]) => (
                                <label key={value} className="mt-1 flex items-center gap-3 min-h-11 text-base text-slate-100">
                                    <input type="radio" name="cs-client-display" className="w-5 h-5" checked={content.client_display === value} onChange={() => set({ client_display: value, ...(value === "named" ? {} : { client_named_ok: false }) })} />
                                    {text}
                                </label>
                            ))}
                        </fieldset>
                        {content.client_display !== "hidden" && (
                            <div>
                                <label htmlFor="cs-client" className={label}>{content.client_display === "named" ? "The client's name" : "How to describe them"}</label>
                                <input id="cs-client" className={input} value={content.client_text} maxLength={200} onChange={(event) => set({ client_text: event.target.value })} placeholder={content.client_display === "named" ? "" : "e.g. a homeowner in Leeds"} {...invalid("client_text")} />
                            </div>
                        )}
                        {content.client_display === "named" && (
                            <label className="flex items-start gap-3 min-h-11 text-base text-slate-100">
                                <input type="checkbox" className="mt-1 w-5 h-5 flex-shrink-0" checked={content.client_named_ok} onChange={(event) => set({ client_named_ok: event.target.checked })} />
                                They&apos;ve agreed to be named
                            </label>
                        )}
                        <label className="flex items-start gap-3 min-h-11 text-base text-slate-100">
                            <input type="checkbox" className="mt-1 w-5 h-5 flex-shrink-0" checked={content.show_value} onChange={(event) => set({ show_value: event.target.checked })} />
                            Show a price for this job
                        </label>
                        {content.show_value && (
                            <div>
                                <label htmlFor="cs-value" className={label}>The price to show</label>
                                <input id="cs-value" className={input} value={content.value_text} maxLength={50} onChange={(event) => set({ value_text: event.target.value })} placeholder="e.g. £18,500" {...invalid("value_text")} />
                            </div>
                        )}
                    </div>
                )}

                <div className="flex flex-wrap items-center gap-3 border-t border-slate-700 pt-4">
                    <button type="button" className={primary} disabled={state.saving !== null || (!dirty && state.id !== null)} onClick={save}>
                        {state.saving ? "Saving…" : state.notice.kind !== "none" && state.notice.kind !== "saved" ? "Try again" : "Save draft"}
                    </button>
                    <p className={hint}>Saving doesn&apos;t show this to clients. Approving does.</p>
                </div>
            </section>

            <section className={card} aria-label="Check and approve" data-approve>
                <h2 className="text-lg font-bold text-slate-50">Check and approve</h2>
                {!state.id || dirty ? (
                    <p className={hint}>Save your draft first. Then check exactly what clients would see, and approve it.</p>
                ) : !check ? (
                    <button type="button" className={secondary} disabled={busy} onClick={openCheck}>Check what clients would see</button>
                ) : (
                    <div className="space-y-4">
                        <p className={hint}>This is the saved version, loaded just now, as a proposal would show it.</p>
                        <ApprovedPreview approved={check.wouldApprove} />
                        <ul className="list-disc pl-5 text-base text-slate-100 space-y-1" data-approve-facts>
                            <li>{check.wouldApprove.client_display === "hidden" ? "The client isn't mentioned." : check.wouldApprove.client_display === "named" ? "The client is named." : "The client is described, not named."}</li>
                            <li>{check.wouldApprove.show_value ? "A price is shown." : "No price is shown."}</li>
                            <li>Kinds of work, in this order: {check.labels.length > 0 ? check.labels.join(", ") : "none"}.</li>
                            <li>Pictures can&apos;t be added to new case studies yet.</li>
                        </ul>
                        {check.problem ? (
                            <p role="alert" className="text-base font-semibold text-amber-200">{check.problem}</p>
                        ) : (
                            <>
                                <label className="flex items-start gap-3 min-h-11 text-base text-slate-100">
                                    <input type="checkbox" className="mt-1 w-5 h-5 flex-shrink-0" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
                                    This is accurate and I&apos;m happy for clients to see it
                                </label>
                                <button type="button" className={primary} disabled={working} onClick={approve}>Approve</button>
                            </>
                        )}
                    </div>
                )}
                {checkNotice && <p role="status" aria-live="polite" data-check-notice className="text-base font-semibold text-slate-100">{checkNotice}</p>}
            </section>
        </div>
    );
}
