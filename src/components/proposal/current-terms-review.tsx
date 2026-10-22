import type { WorkspaceStyles } from "@/lib/workspace-styles";

interface ShownTerm {
    title: string;
    body: string;
    hidden?: boolean;
}

/**
 * The terms the client would read, in full, as the draft stands now. Read
 * only: it holds no state and changes nothing, so it stays usable when the
 * proposal is locked. A native disclosure is used because the review form
 * disables its buttons once pre-contract information is locked.
 *
 * Numbering and outer whitespace follow the published document: clauses are
 * numbered 1, 2, 3… in the order shown, and each title and wording is trimmed
 * at its ends only. Hidden terms are never listed.
 */
export default function CurrentTermsReview({ terms, styles: s }: { terms: ReadonlyArray<ShownTerm>; styles: WorkspaceStyles }) {
    const shown = terms.filter((clause) => !clause.hidden);
    return (
        <details className={`${s.inset} p-4`} data-current-terms>
            <summary className={`min-h-11 flex items-center cursor-pointer text-sm font-semibold ${s.heading}`}>
                Read the terms in full ({shown.length})
            </summary>
            <p className={`mt-3 text-sm ${s.muted}`}>
                The wording in this proposal now, including any changes not saved yet. It is not a legal check of the terms or a confirmed original version of them.
            </p>
            {shown.length === 0 ? (
                <p className={`mt-3 text-sm ${s.body}`} data-current-terms-empty>No terms are shown to the client.</p>
            ) : (
                <ol className="mt-3 space-y-3">
                    {shown.map((clause, index) => {
                        const title = clause.title.trim();
                        const body = clause.body.trim();
                        return (
                            <li key={index} className="min-w-0" data-current-term>
                                <h3 className={`text-sm font-semibold break-words ${s.heading}`}>
                                    {index + 1}. {title || <span className={s.muted}>No title yet</span>}
                                </h3>
                                <p className={`mt-0.5 text-sm whitespace-pre-wrap break-words ${body ? s.body : s.muted}`}>
                                    {body || "No wording yet."}
                                </p>
                            </li>
                        );
                    })}
                </ol>
            )}
        </details>
    );
}
