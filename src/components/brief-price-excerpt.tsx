"use client";

import { useState } from "react";
import { PRICING_REVIEW_OPEN, PRICING_REVIEW_STALE, reviewPricingSuggestion, type PendingPricingReview, type PricingReviewContext } from "@/lib/pricing-review";
import type { WorkspaceStyles } from "@/lib/workspace-styles";

interface Props {
    context: PricingReviewContext;
    blocked: boolean;
    blockedHelp?: string;
    styles: WorkspaceStyles;
    onOpen: (pending: PendingPricingReview) => { ok: true } | { ok: false; error: string };
}

export default function BriefPriceExcerpt({ context, blocked, blockedHelp, styles, onOpen }: Props) {
    const [pending, setPending] = useState<PendingPricingReview | null>(null);
    const [error, setError] = useState("");
    const current = !!pending && pending.revision === context.revision;
    const message = pending && !current ? PRICING_REVIEW_STALE : error;

    return (
        <details className="mt-4 min-w-0" data-brief-excerpt>
            <summary className={`cursor-pointer py-2 text-base font-semibold ${styles.body}`}>Choose part of the saved brief for one price line</summary>
            <p id="brief-excerpt-help" className={`mt-2 text-sm ${styles.muted}`}>Highlight one complete piece of work, including any limits or exclusions that belong with it. This copies your wording; it does not interpret the brief or generate activities.</p>
            <label htmlFor="brief-excerpt-source" className={`mt-3 block text-sm font-semibold ${styles.body}`}>Saved work description (read only)</label>
            <textarea id="brief-excerpt-source" value={context.work} readOnly rows={6} aria-describedby="brief-excerpt-help"
                className={`${styles.input} mt-2 min-h-40 w-full min-w-0 resize-y text-base`}
                onSelect={event => {
                    const source = event.currentTarget;
                    if (source.value !== context.work) { setPending(null); setError(PRICING_REVIEW_STALE); return; }
                    if (source.selectionEnd <= source.selectionStart) { setPending(null); setError(""); return; }
                    const reviewed = reviewPricingSuggestion(context, { message: "", suggestions: [{ source: "briefWork", start: source.selectionStart, end: source.selectionEnd }] });
                    setPending(reviewed.ok ? reviewed.value : null);
                    setError(reviewed.ok ? "" : reviewed.error);
                }} />
            {current && pending && (
                <div className="mt-3 min-w-0" aria-live="polite">
                    <p className={`text-sm font-semibold ${styles.body}`}>Selected wording</p>
                    <blockquote className={`mt-1 whitespace-pre-wrap break-words border-l-2 border-emerald-600 pl-3 text-base ${styles.body}`}>{pending.suggestions[0].description}</blockquote>
                </div>
            )}
            <p className={`mt-2 text-sm ${styles.muted}`}>Choose up to 500 characters for one line. Nothing is truncated. Opening a draft does not save, assign a price or add other activities.</p>
            {blocked && <p className={`mt-2 text-sm ${styles.muted}`}>{blockedHelp || PRICING_REVIEW_OPEN}</p>}
            {message && <p role="alert" className={`mt-2 break-words text-sm ${styles.errorText}`}>{message}</p>}
            <button type="button" className={`${styles.secondaryButton} mt-3`} disabled={!current || blocked}
                onClick={() => {
                    if (!pending || !current) { setError("Select current saved work before opening a draft."); return; }
                    if (blocked) { setError(blockedHelp || PRICING_REVIEW_OPEN); return; }
                    const result = onOpen(pending);
                    setError(result.ok ? "" : result.error);
                }}>
                Open selected work as an unpriced draft
            </button>
        </details>
    );
}
