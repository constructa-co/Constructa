"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { LibraryResult, StudyView } from "@/lib/case-library/service";
import { STATE_LABEL, studyState } from "@/lib/case-library/status";
import type { StoredDiscipline } from "@/lib/case-library/store";
import { archiveCaseStudyAction, archiveDisciplineAction, saveDisciplineAction, startFromOlderCaseStudyAction } from "./library-actions";

export interface PanelServer {
    archiveStudy: (input: { id: unknown; revision: unknown; archived: unknown }) => Promise<LibraryResult>;
    saveDiscipline: (input: { id: unknown; revision: unknown; label: unknown }) => Promise<LibraryResult>;
    archiveDiscipline: (input: { id: unknown; revision: unknown; archived: unknown }) => Promise<LibraryResult>;
    startFromOlder: (input: { index: unknown }) => Promise<LibraryResult>;
}
const realServer: PanelServer = { archiveStudy: archiveCaseStudyAction, saveDiscipline: saveDisciplineAction, archiveDiscipline: archiveDisciplineAction, startFromOlder: startFromOlderCaseStudyAction };

export interface OlderEntry { index: number; title: string }

const card = "bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-4";
const hint = "text-sm text-slate-300";
const input = "w-full min-h-11 rounded-lg border border-slate-500 bg-slate-950 px-3 py-2 text-base text-slate-50 placeholder:text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
const ring = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
const primary = `inline-flex items-center min-h-11 px-4 rounded-lg bg-blue-700 hover:bg-blue-800 text-base font-semibold text-white ${ring}`;
const secondary = `inline-flex items-center min-h-11 px-3 rounded-lg border border-slate-400 text-sm font-semibold text-slate-100 hover:bg-white/5 disabled:opacity-60 ${ring}`;

/**
 * The library half of the Case Studies page: the contractor's case studies
 * and their kinds of work. The older case studies and their editor are a
 * separate, unchanged part of the page.
 */
export default function LibraryPanel({ available, studies, disciplines: loadedDisciplines, older, basePath, server = realServer }: {
    /** False when the library could not be read. It is then "not available", never shown as empty. */
    available: boolean;
    studies: StudyView[];
    disciplines: StoredDiscipline[];
    /** Older case studies with a title, by their place, that a new version can be started from. */
    older: OlderEntry[];
    basePath: string;
    /** Defaults to the real server actions; replaced only by tests and the fixture harness. */
    server?: PanelServer;
}) {
    const router = useRouter();
    // After an action the page is asked for fresh data. Until it arrives, the list of kinds of
    // work the action returned is shown; once fresh data arrives, that is what is shown.
    const [returned, setReturned] = useState<{ from: StoredDiscipline[]; value: StoredDiscipline[] } | null>(null);
    const disciplines = returned && returned.from === loadedDisciplines ? returned.value : loadedDisciplines;
    const [notice, setNotice] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [adding, setAdding] = useState("");
    const [renaming, setRenaming] = useState<{ id: string; label: string } | null>(null);

    if (!available) {
        return (
            <section className={card} data-library="unavailable" aria-label="Your case studies">
                <h2 className="text-xl font-bold text-slate-50">Your case studies</h2>
                <p role="status" className="text-base text-amber-200">The new case-study library isn&apos;t available right now. Your older case studies below still work.</p>
            </section>
        );
    }

    const labelsOf = (study: StudyView) => disciplines.filter((entry) => !entry.archived && study.disciplineIds.includes(entry.id)).map((entry) => entry.label);
    const adopted = new Set(studies.filter((study) => !study.archived && study.legacyIndex !== null).map((study) => study.legacyIndex));

    /** Runs one action at a time and shows what it said. A request that fails outright is "not known", never "nothing changed". */
    const act = async (run: () => Promise<LibraryResult>, after?: (result: LibraryResult) => void) => {
        if (busy) return;
        setBusy(true);
        setNotice(null);
        try {
            const result = await run();
            setNotice(result.message);
            if (result.disciplines) setReturned({ from: loadedDisciplines, value: result.disciplines });
            after?.(result);
            router.refresh();
        } catch {
            setNotice("We couldn't confirm whether that happened. Reload the page to see, before trying again.");
        }
        setBusy(false);
    };

    return (
        <div className="space-y-6" data-library="available">
            <section className={card} aria-label="Your case studies">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-xl font-bold text-slate-50">Your case studies</h2>
                    <Link href={`${basePath}/new`} className={primary}>Add a past job</Link>
                </div>
                <p className={hint}>Write a past job once, approve it, and choose it for any proposal. Pictures can&apos;t be added to these yet.</p>
                <p role="status" aria-live="polite" data-library-notice className={notice ? "text-base font-semibold text-slate-100" : "sr-only"}>{notice ?? ""}</p>

                {studies.length === 0 ? (
                    <p className="text-base text-slate-200">You haven&apos;t added any here yet.</p>
                ) : (
                    <ul className="space-y-3">
                        {studies.map((study) => {
                            const { state, changes } = studyState(study, labelsOf(study));
                            const labels = labelsOf(study);
                            return (
                                <li key={study.id} className="rounded-lg border border-slate-700 p-4 space-y-2" data-study={study.id} data-state={state}>
                                    <p className="text-lg font-semibold text-slate-50 break-words">{study.content.title}</p>
                                    <p className="text-base text-slate-100" data-study-state>{STATE_LABEL[state]}{changes.length > 0 ? `: ${changes.join(", ")}` : ""}</p>
                                    {labels.length > 0 && <p className={hint}>Kinds of work: {labels.join(", ")}</p>}
                                    {study.approved && study.approved.disciplines.join("|") !== labels.join("|") && (
                                        <p className={hint}>Approved as: {study.approved.disciplines.join(", ") || "no kinds of work"}</p>
                                    )}
                                    {study.legacyIndex !== null && <p className={hint}>New version of an older case study.</p>}
                                    <div className="flex flex-wrap gap-2">
                                        {!study.archived && <Link href={`${basePath}/${study.id}`} className={secondary}>{state === "draft" ? "Edit and approve" : "Open"}</Link>}
                                        <button type="button" className={secondary} disabled={busy} aria-label={`${study.archived ? "Bring back" : "Archive"} ${study.content.title}`} onClick={() => act(() => server.archiveStudy({ id: study.id, revision: study.revision, archived: !study.archived }))}>{study.archived ? "Bring back" : "Archive"}</button>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>

            <section className={card} aria-label="Kinds of work" data-kinds>
                <h2 className="text-xl font-bold text-slate-50">Kinds of work</h2>
                <p className={hint}>Your own list. Tag a case study with these so you can find the right ones for a job. Up to 12.</p>
                <ul className="space-y-2">
                    {disciplines.map((entry) => (
                        <li key={entry.id} className="flex flex-wrap items-center gap-2" data-kind={entry.label}>
                            {renaming?.id === entry.id ? (
                                <>
                                    <label htmlFor={`kind-${entry.id}`} className="sr-only">New name for {entry.label}</label>
                                    <input id={`kind-${entry.id}`} className={`${input} flex-1 min-w-0`} value={renaming.label} maxLength={80} onChange={(event) => setRenaming({ id: entry.id, label: event.target.value })} />
                                    <button type="button" className={secondary} disabled={busy} onClick={() => act(() => server.saveDiscipline({ id: entry.id, revision: entry.revision, label: renaming.label }), (result) => { if (result.status === "saved") setRenaming(null); })}>Save name</button>
                                    <button type="button" className={secondary} onClick={() => setRenaming(null)}>Cancel</button>
                                </>
                            ) : (
                                <>
                                    <span className={`flex-1 min-w-0 break-words text-base ${entry.archived ? "text-slate-300" : "text-slate-50"}`}>{entry.label}{entry.archived ? " (archived)" : ""}</span>
                                    {!entry.archived && <button type="button" className={secondary} disabled={busy} aria-label={`Rename ${entry.label}`} onClick={() => setRenaming({ id: entry.id, label: entry.label })}>Rename</button>}
                                    <button type="button" className={secondary} disabled={busy} aria-label={`${entry.archived ? "Bring back" : "Archive"} ${entry.label}`} onClick={() => act(() => server.archiveDiscipline({ id: entry.id, revision: entry.revision, archived: !entry.archived }))}>{entry.archived ? "Bring back" : "Archive"}</button>
                                </>
                            )}
                        </li>
                    ))}
                </ul>
                <div className="flex flex-wrap items-end gap-2">
                    <div className="flex-1 min-w-0">
                        <label htmlFor="kind-new" className="block text-base font-semibold text-slate-100">Add a kind of work</label>
                        <input id="kind-new" className={`${input} mt-2`} value={adding} maxLength={80} onChange={(event) => setAdding(event.target.value)} placeholder="e.g. Kitchen Installation" />
                    </div>
                    <button type="button" className={secondary} disabled={busy || adding.trim() === ""} onClick={() => act(() => server.saveDiscipline({ id: null, revision: 0, label: adding }), (result) => { if (result.status === "saved") setAdding(""); })}>Add</button>
                </div>
            </section>

            {older.length > 0 && (
                <section className={card} aria-label="Start a new version of an older case study" data-start-from-older>
                    <h2 className="text-xl font-bold text-slate-50">Start a new version of an older case study</h2>
                    <p className={hint}>This copies its wording into a new draft for you to check and approve. The client is left out and no price is shown unless you choose otherwise. The older one is not changed and can still be chosen.</p>
                    <ul className="space-y-2">
                        {older.map((entry) => (
                            <li key={entry.index} className="flex flex-wrap items-center gap-2">
                                <span className="flex-1 min-w-0 break-words text-base text-slate-50">{entry.title}</span>
                                {adopted.has(entry.index)
                                    ? <span className={hint}>New version started</span>
                                    : <button type="button" className={secondary} disabled={busy} aria-label={`Start a new version of ${entry.title}`} onClick={() => act(() => server.startFromOlder({ index: entry.index }), (result) => { if (result.status === "saved" && result.id) router.push(`${basePath}/${result.id}`); })}>Start a new version</button>}
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </div>
    );
}
