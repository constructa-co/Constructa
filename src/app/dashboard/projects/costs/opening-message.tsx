"use client";

import { useEffect, useRef } from "react";
import { useReducerStore } from "@/lib/use-reducer-store";
import { TEXT_LIMITS } from "@/lib/proposal-review";
import type { WorkspaceStyles } from "@/lib/workspace-styles";
import { savePricingOpeningAction } from "../proposal/actions";

type State = { projectId: string; context: string; saved: string | null; draft: string; editing: boolean; pending: boolean; uncertain: boolean; message: string };
const patchState = (state: State, patch: Partial<State>): State => ({ ...state, ...patch });

export default function PricingOpeningEditor({ projectId, source, lockReason, styles: s, onWorkChange, save = savePricingOpeningAction }: {
    projectId: string; source: string | null; lockReason: string | null; styles: WorkspaceStyles;
    onWorkChange: (open: boolean) => void; save?: typeof savePricingOpeningAction;
}) {
    const context = JSON.stringify({ projectId, source });
    const latest = useRef({ projectId, source, context, lockReason });
    const active = useRef(true);
    useEffect(() => { latest.current = { projectId, source, context, lockReason }; }, [projectId, source, context, lockReason]);
    useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
    const [state, store] = useReducerStore(patchState, () => ({ projectId, context, saved: source, draft: source ?? "", editing: false, pending: false, uncertain: false, message: "" }));
    const sourceChanged = projectId !== state.projectId || (context !== state.context && source !== state.saved);
    const submit = async () => {
        const fresh = store.getState();
        if (!active.current || !fresh.editing || fresh.pending || fresh.uncertain || lockReason || latest.current.lockReason || fresh.context !== latest.current.context) return;
        if (fresh.draft.length > TEXT_LIMITS.introduction) { store.dispatch({ message: "Keep the opening message to 20,000 characters or fewer. Nothing has been shortened." }); return; }
        store.dispatch({ pending: true, message: "Saving opening message..." });
        try {
            const result = await save(projectId, fresh.saved, fresh.draft);
            if (!active.current) return;
            if (latest.current.projectId !== fresh.projectId) throw Error("Project changed while saving");
            if (!result.success) { store.dispatch({ pending: false, uncertain: !!result.uncertain, message: result.error }); return; }
            if (result.introduction !== (fresh.draft.trim() || null)) throw Error("Opening message acknowledgement differs");
            if (latest.current.context !== fresh.context && latest.current.source !== result.introduction) throw Error("Opening changed while saving");
            store.dispatch({ context: latest.current.context, saved: result.introduction, draft: result.introduction ?? "", pending: false, editing: false, message: "Opening message saved for the proposal." });
            onWorkChange(false);
        } catch {
            if (!active.current) return;
            store.dispatch({ pending: false, uncertain: true, message: "The save wasn't confirmed. It may have saved. Your draft is retained; reload to check before saving again." });
        }
    };
    return <section data-pricing-opening aria-labelledby="pricing-opening-title" className={`${s.card} p-4 sm:p-5`}>
        <h2 id="pricing-opening-title" className={`text-lg font-bold ${s.heading}`}>Proposal opening message</h2>
        <p className={`mt-2 text-sm ${s.muted}`}>Prepare the first message your client reads while you price the work. Only your reviewed wording is saved; no standard or generated copy is added.</p>
        {sourceChanged && <p role="alert" className={`mt-3 text-sm ${s.errorText}`}>The project or saved opening changed. Your text is retained; reload to review the saved message before editing again.</p>}
        {!state.editing ? <>
            <p className={`my-4 text-sm whitespace-pre-wrap break-words ${s.body}`}>{state.saved || "No opening message saved."}</p>
            {lockReason ? <p className={`text-sm ${s.muted}`}>{lockReason}</p> : <button type="button" disabled={sourceChanged} className={s.secondaryButton} onClick={() => {
                const fresh = store.getState();
                if (!active.current || fresh.editing || latest.current.lockReason || fresh.projectId !== latest.current.projectId
                    || (fresh.context !== latest.current.context && latest.current.source !== fresh.saved)) return;
                store.dispatch({ context: latest.current.context, editing: true, message: "" }); onWorkChange(true);
            }}>Review opening message</button>}
        </> : <form className="mt-4 space-y-4" onSubmit={event => { event.preventDefault(); void submit(); }}>
            <p className={`text-sm ${s.muted}`}>Unsaved opening message. Save explicitly to use it in the proposal.</p>
            <label htmlFor="pricing-opening-text" className={s.label}>Opening message</label>
            <textarea id="pricing-opening-text" rows={5} maxLength={TEXT_LIMITS.introduction} className={s.textarea}
                disabled={state.pending || state.uncertain || !!lockReason || sourceChanged} value={state.draft} onChange={event => {
                    const fresh = store.getState();
                    if (!active.current || !fresh.editing || fresh.pending || fresh.uncertain || latest.current.lockReason || fresh.context !== latest.current.context) return;
                    store.dispatch({ draft: event.target.value, message: "" });
                }} />
            <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={state.pending || state.uncertain || !!lockReason || sourceChanged} className={s.primaryButton}>{state.pending ? "Saving..." : "Save opening message"}</button>
                <button type="button" disabled={state.pending || state.uncertain} className={s.quietButton} onClick={() => {
                    const fresh = store.getState(); if (!active.current || fresh.pending || fresh.uncertain) return;
                    store.dispatch({ editing: false, draft: fresh.saved ?? "", message: "" }); onWorkChange(false);
                }}>Cancel</button>
            </div>
        </form>}
        {state.message && <p role={state.editing && !state.pending ? "alert" : "status"} className={`mt-3 text-sm ${state.uncertain ? s.errorText : s.body}`}>{state.message}</p>}
    </section>;
}
