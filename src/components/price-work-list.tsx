"use client";

import { useRef, useState } from "react";
import { MAX_SCOPE_LENGTH } from "@/lib/guided-brief";
import { reviewPricingSuggestion, type PricingReviewContext } from "@/lib/pricing-review";
import type { WorkspaceStyles } from "@/lib/workspace-styles";

export interface WorkDescriptionRange { start: number; end: number }

/** Plain descriptions only: never interpret pasted columns, prices or headings. */
export function reviewWorkDescriptionList(source: string):
    { ok: true; items: WorkDescriptionRange[] } | { ok: false; error: string } {
    if (source.length > MAX_SCOPE_LENGTH) return { ok: false, error: `Use no more than ${MAX_SCOPE_LENGTH} characters. Nothing has been truncated.` };
    if (source.includes("\t")) return { ok: false, error: "Paste descriptions only, one per line, not spreadsheet columns. No quantities or prices are imported." };
    const items: WorkDescriptionRange[] = [];
    const rows = source.split(/\r\n|\n|\r/);
    let start = 0;
    for (const row of rows) {
        const end = start + row.length;
        if (row.trim()) items.push({ start, end });
        start = end + (source.slice(end, end + 2) === "\r\n" ? 2 : 1);
    }
    if (!items.length) return { ok: false, error: "Enter at least one work description." };
    // Reuse the existing exact-source, control-character and 500-character checks.
    const context: PricingReviewContext = { projectId: "local-review", estimateId: null, work: "", contractorMessage: source, existingWork: [], revision: "", clientBoQ: false };
    for (let index = 0; index < items.length; index++) {
        const reviewed = reviewPricingSuggestion(context, { message: "", suggestions: [{ source: "contractorMessage", ...items[index] }] });
        if (!reviewed.ok) return { ok: false, error: `Description ${index + 1}: ${reviewed.error}` };
    }
    return { ok: true, items };
}

interface Props {
    context: PricingReviewContext;
    blocked: boolean;
    blockedHelp: string;
    styles: WorkspaceStyles;
    onWorkChange: (open: boolean) => void;
    onOpen: (source: string, range: WorkDescriptionRange, revision: string) => { ok: true } | { ok: false; error: string };
}

export default function PriceWorkList({ context, blocked, blockedHelp, styles, onWorkChange, onOpen }: Props) {
    const [source, setSource] = useState("");
    const sourceRef = useRef("");
    const [review, setReview] = useState<{ source: string; items: WorkDescriptionRange[] } | null>(null);
    const [message, setMessage] = useState("");
    return (
        <details className="mt-4 min-w-0" data-price-work-list>
            <summary className={`cursor-pointer py-2 text-base font-semibold ${styles.body}`}>Price a list of work descriptions</summary>
            <p id="price-work-list-help" className={`mt-2 text-sm ${styles.muted}`}>Type or paste one complete description per line, including its limits and exclusions. Review the list, then open one unpriced draft at a time. This does not interpret scope, create sections or import quantities or prices.</p>
            <label htmlFor="price-work-list-source" className={`mt-3 block text-sm font-semibold ${styles.body}`}>Work descriptions</label>
            <textarea id="price-work-list-source" rows={5} value={source} aria-describedby="price-work-list-help"
                className={`${styles.input} mt-2 w-full min-w-0 resize-y text-base`} onChange={event => {
                    const value = event.currentTarget.value;
                    sourceRef.current = value;
                    setSource(value); setReview(null); setMessage(""); onWorkChange(value.length > 0);
                }} />
            <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className={styles.secondaryButton} onClick={() => {
                    const result = reviewWorkDescriptionList(source);
                    setReview(result.ok ? { source, items: result.items } : null);
                    setMessage(result.ok ? "" : result.error);
                }}>Review descriptions</button>
                <button type="button" className={styles.quietButton} disabled={!source} onClick={() => {
                    sourceRef.current = "";
                    setSource(""); setReview(null); setMessage(""); onWorkChange(false);
                }}>Clear list</button>
            </div>
            <p className={`mt-2 text-sm ${styles.muted}`}>This list is not saved. Closing this panel keeps it here; leaving the job discards it. Use the price line&apos;s Save to return and choose another description. Cancel keeps the list and does not save that draft.</p>
            {review && <ol className="mt-3 space-y-3" aria-label="Reviewed work descriptions">
                {review.items.map((range, index) => {
                    const description = review.source.slice(range.start, range.end).replace(/\s+/g, " ").trim();
                    const alreadySaved = context.existingWork.some(line => line.description === description);
                    return <li key={range.start} className={`${styles.inset} min-w-0 p-3`}>
                        <p className={`whitespace-pre-wrap break-words text-base ${styles.body}`}>{index + 1}. {description}</p>
                        {alreadySaved && <p className={`mt-1 text-sm ${styles.muted}`}>Identical wording is already in this estimate. Check it before adding another line.</p>}
                        <button type="button" className={`${styles.secondaryButton} mt-2`} disabled={blocked}
                            aria-label={`Open description ${index + 1} as an unpriced draft`} onClick={() => {
                                if (sourceRef.current !== review.source) { setMessage("The list changed. Review the current descriptions first."); return; }
                                if (blocked) { setMessage(blockedHelp); return; }
                                const result = onOpen(review.source, range, context.revision);
                                setMessage(result.ok ? "One draft opened, not saved. Enter its price and use Save, or Cancel before choosing another description." : result.error);
                            }}>Open unpriced draft</button>
                    </li>;
                })}
            </ol>}
            {blocked && <p className={`mt-2 text-sm ${styles.muted}`}>{blockedHelp}</p>}
            {message && <p role="status" className={`mt-2 break-words text-sm ${styles.body}`}>{message}</p>}
        </details>
    );
}
