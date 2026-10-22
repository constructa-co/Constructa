"use client";

import { useEffect, useRef, useState } from "react";
import { prepareSavedLineReuse, reviewSavedLine, type ReviewedSavedLine, type SavedLineReuseContext } from "@/lib/saved-line-reuse";
import type { WorkspaceStyles } from "@/lib/workspace-styles";

type Context = { ok: true; value: SavedLineReuseContext } | { ok: false; error: string };
export default function SavedLineReuse({ context, blocked, blockReason, onOpen, s }: {
    context: Context; blocked: boolean; blockReason?: string | null; onOpen: (reviewed: ReviewedSavedLine) => { ok: true } | { ok: false; error: string }; s: WorkspaceStyles;
}) {
    const [review, setReview] = useState<ReviewedSavedLine | null>(null);
    const reviewRef = useRef<ReviewedSavedLine | null>(null);
    const [message, setMessage] = useState("");
    const latest = useRef({ context, blocked, onOpen });
    const active = useRef(true);
    useEffect(() => { latest.current = { context, blocked, onOpen }; }, [context, blocked, onOpen]);
    useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
    const prepared = review && context.ok ? prepareSavedLineReuse(review, context.value, false) : null;
    return <details className={`my-3 ${s.inset} p-3`} data-saved-line-reuse>
        <summary className={`min-h-11 cursor-pointer ${s.body}`}>Reuse saved wording (optional)</summary>
        <p className={`mt-2 text-sm ${s.muted}`}>Review wording and activity from one existing simple line, then open one unpriced draft. No prices, quantities, rates, resources or saved row identities are copied. The original line is unchanged.</p>
        {!context.ok ? <p role="alert" className={s.muted}>{context.error}</p> : <>
            <label htmlFor="saved-line-reuse-source" className={`block mt-3 ${s.label}`}>Existing line to review</label>
            <select id="saved-line-reuse-source" className={s.input} value={review?.lineId ?? ""} disabled={blocked || context.value.review.clientBoQ} onChange={event => {
                const fresh = latest.current;
                if (!active.current || fresh.blocked || !fresh.context.ok || fresh.context.value.review.clientBoQ) return;
                const source = fresh.context.value.sources.find(line => line.lineId === event.target.value);
                const next = source ? reviewSavedLine(source, fresh.context.value) : null;
                reviewRef.current = next; setReview(next); setMessage("");
            }}>
                <option value="">Choose saved wording to review...</option>
                {context.value.sources.map((line, index) => <option key={line.lineId} value={line.lineId}>{index + 1}. {line.description || "No description"}{line.activity ? ` / ${line.activity}` : ""}</option>)}
            </select>
            {context.value.review.clientBoQ && <p className={s.muted}>Use the existing client BoQ workflow for this estimate.</p>}
            {context.value.sources.length === 0 && !context.value.review.clientBoQ && <p className={s.muted}>No saved simple lines are available here.</p>}
        </>}
        {review && <div className="mt-3 space-y-3" data-saved-line-review>
            <p className={s.label}>Saved source wording</p>
            <p className={`whitespace-pre-wrap break-words ${s.body}`}>{review.description}</p>
            <p className={s.muted}>Saved activity: {review.activity || "General (existing default)"}</p>
            {prepared?.ok && <>
                <p className={s.label}>New draft description</p>
                <p className={`break-words ${s.body}`}>{prepared.value.description}</p>
                <p className={`text-sm ${s.muted}`}>The existing single-line review joins whitespace without shortening words. After opening, review and edit the draft, enter its own price, then Save explicitly.</p>
            </>}
            {prepared && !prepared.ok && <p role="alert" className={s.errorText}>{prepared.error}</p>}
            <div className="flex flex-wrap gap-2">
                <button type="button" className={s.secondaryButton} disabled={blocked || !prepared?.ok} onClick={() => {
                    const fresh = latest.current;
                    if (!active.current || !reviewRef.current || reviewRef.current !== review || fresh.blocked || !fresh.context.ok) return;
                    const checked = prepareSavedLineReuse(review, fresh.context.value, false);
                    if (!checked.ok) { setMessage(checked.error); return; }
                    reviewRef.current = null;
                    const result = fresh.onOpen(review);
                    if (result.ok) { setReview(null); setMessage("Unpriced draft opened for review. Save it separately in the price row."); }
                    else { reviewRef.current = review; setMessage(result.error); }
                }}>Open unpriced draft</button>
                <button type="button" className={s.quietButton} onClick={() => {
                    if (!active.current || reviewRef.current !== review) return;
                    reviewRef.current = null; setReview(null); setMessage("");
                }}>Cancel wording review</button>
            </div>
        </div>}
        {blocked && <p className={`mt-2 text-sm ${s.muted}`}>{blockReason || "Finish or cancel open estimating or proposal work before opening another draft."}</p>}
        {message && <p role="status" className={`mt-3 text-sm ${s.body}`}>{message}</p>}
    </details>;
}
