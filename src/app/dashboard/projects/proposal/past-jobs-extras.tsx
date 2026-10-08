"use client";

import type { PastJobs } from "@/lib/case-library/past-jobs";

/**
 * The parts of "Relevant experience" that the case-study library adds: the
 * contractor's approved case studies to choose from, any they chose that can
 * no longer be sent, and what is true about the count. It renders nothing at
 * all for a proposal that has none of these, so the older list is as it was.
 *
 * Nothing here ticks or unticks on its own. A case study that cannot be sent
 * stays ticked until the contractor unticks it.
 */
export default function PastJobsExtras({ jobs, unapproved, busy, onToggle, classes }: {
    jobs: PastJobs;
    /** Case studies not yet approved. A count only. */
    unapproved: number;
    busy: boolean;
    onToggle: (tick: string) => void;
    classes: { body: string; muted: string; notice: string; button: string };
}) {
    const nothing = jobs.library.length === 0 && jobs.cannotSend.length === 0 && jobs.notes.length === 0 && !jobs.blocked && unapproved === 0;
    if (nothing) return null;

    return (
        <div className="mt-4 space-y-4" data-past-jobs-extras>
            {jobs.library.length > 0 && (
                <div>
                    <p className={`text-sm font-semibold ${classes.body}`}>From your case-study library</p>
                    <ul className="space-y-1">
                        {jobs.library.map((option) => (
                            <li key={option.tick}>
                                <label className={`flex items-start gap-3 min-h-11 py-2 text-base ${classes.body}`}>
                                    <input type="checkbox" className="mt-1 w-5 h-5 flex-shrink-0" checked={option.ticked} disabled={busy} onChange={() => onToggle(option.tick)} />
                                    <span className="min-w-0 break-words">
                                        <span className="font-semibold">{option.title}</span>
                                        {option.labels.length > 0 && <span className={classes.muted}> · {option.labels.join(", ")}</span>}
                                        {option.startedFromOlder && <span className={classes.muted}> · new version of an older case study above</span>}
                                    </span>
                                </label>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {jobs.cannotSend.length > 0 && (
                <div role="alert" className={`${classes.notice} space-y-3`} data-past-jobs-cannot-send>
                    <p className="text-base font-semibold">Chosen, but can&apos;t be sent</p>
                    <ul className="space-y-3">
                        {jobs.cannotSend.map((entry) => (
                            <li key={entry.tick} className="space-y-2">
                                <p className="text-base">{entry.message}</p>
                                <button type="button" className={`${classes.button} min-h-11 text-sm`} disabled={busy} onClick={() => onToggle(entry.tick)}>Untick it</button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {jobs.blocked && jobs.cannotSend.length === 0 && <p role="alert" className={`${classes.notice} text-base`} data-past-jobs-blocked>{jobs.blocked}</p>}

            {(jobs.olderMatched > 0 || jobs.libraryChosen > 0) && (
                <p className={`text-sm ${classes.muted}`} data-past-jobs-count>
                    Showing {jobs.olderShown + jobs.libraryChosen} past {jobs.olderShown + jobs.libraryChosen === 1 ? "job" : "jobs"}
                    {jobs.library.length > 0 ? ` (${jobs.olderShown} older, ${jobs.libraryChosen} from your library)` : ""}. A proposal shows up to 6.
                </p>
            )}
            {jobs.notes.map((note) => <p key={note} className={`text-sm ${classes.body}`} data-past-jobs-note>{note}</p>)}
            {unapproved > 0 && (
                <p className={`text-sm ${classes.muted}`} data-past-jobs-unapproved>
                    {unapproved === 1 ? "1 case study in your library isn't approved yet, so it can't be chosen." : `${unapproved} case studies in your library aren't approved yet, so they can't be chosen.`}
                </p>
            )}
        </div>
    );
}
