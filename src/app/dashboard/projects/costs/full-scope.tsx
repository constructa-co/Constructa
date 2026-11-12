"use client";

import { useEffect, useRef } from "react";
import { useReducerStore } from "@/lib/use-reducer-store";
import { pricingFullScopeDraft, pricingFullScopeError, sameFullScopeSource, type PricingFullScopeSource } from "@/lib/pricing-full-scope";
import { TEXT_LIMITS } from "@/lib/proposal-review";
import type { WorkspaceStyles } from "@/lib/workspace-styles";
import { savePricingFullScopeAction } from "../proposal/actions";

type State = { projectId: string; context: string; saved: PricingFullScopeSource; draft: string; editing: boolean; pending: boolean; uncertain: boolean; message: string };
const patchState = (state: State, patch: Partial<State>): State => ({ ...state, ...patch });

export default function PricingFullScopeEditor({ projectId, source, lockReason, styles: s, onWorkChange, save = savePricingFullScopeAction }: {
    projectId: string; source: PricingFullScopeSource; lockReason: string | null; styles: WorkspaceStyles;
    onWorkChange: (open: boolean) => void; save?: typeof savePricingFullScopeAction;
}) {
    const context = JSON.stringify({ projectId, source });
    const latest = useRef({ projectId, source, context, lockReason });
    const active = useRef(true);
    useEffect(() => { latest.current = { projectId, source, context, lockReason }; }, [projectId, source, context, lockReason]);
    useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
    const [state, store] = useReducerStore(patchState, () => ({ projectId, context, saved: source, draft: pricingFullScopeDraft(source), editing: false, pending: false, uncertain: false, message: "" }));
    const sourceChanged = projectId !== state.projectId || (context !== state.context && !sameFullScopeSource(source, state.saved));
    const submit = async () => {
        const fresh = store.getState();
        if (!active.current || !fresh.editing || fresh.pending || fresh.uncertain || lockReason || latest.current.lockReason || fresh.context !== latest.current.context) return;
        const validation = pricingFullScopeError(fresh.saved, fresh.draft);
        if (validation) { store.dispatch({ message: validation }); return; }
        store.dispatch({ pending: true, message: "Saving scope..." });
        try {
            const result = await save(projectId, fresh.saved, fresh.draft);
            if (!active.current) return;
            if (latest.current.projectId !== fresh.projectId) throw Error("Project changed while saving");
            if (!result.success) { store.dispatch({ pending: false, uncertain: !!result.uncertain, message: result.error }); return; }
            if (!result.source || !sameFullScopeSource(result.source, { ...fresh.saved, scope_text: fresh.draft.trim() || null })) throw Error("Scope acknowledgement differs");
            if (latest.current.context !== fresh.context && !sameFullScopeSource(latest.current.source, result.source)) throw Error("Scope or brief changed while saving");
            store.dispatch({ context: latest.current.context, saved: result.source, draft: pricingFullScopeDraft(result.source), pending: false, editing: false, message: "Scope saved for the proposal." });
            onWorkChange(false);
        } catch {
            if (!active.current) return;
            store.dispatch({ pending: false, uncertain: true, message: "The save wasn't confirmed. It may have saved. Your draft is retained; reload to check before saving again." });
        }
    };
    return <section data-pricing-full-scope aria-labelledby="pricing-full-scope-title" className={`${s.card} p-4 sm:p-5`}>
        <h2 id="pricing-full-scope-title" className={`text-lg font-bold ${s.heading}`}>Full proposal scope</h2>
        <p className={`mt-2 text-sm ${s.muted}`}>Review the full scope while pricing. An existing saved scope takes priority; otherwise this shows only the work from the saved brief. No new wording is generated and the brief is not changed.</p>
        {sourceChanged && <p role="alert" className={`mt-3 text-sm ${s.errorText}`}>The project, saved scope or brief changed. Your text is retained; reload to review the saved scope and brief before editing again.</p>}
        {!state.editing ? <>
            <p className={`my-4 text-sm whitespace-pre-wrap break-words ${s.body}`}>{pricingFullScopeDraft(state.saved) || "No proposal scope or brief work saved."}</p>
            {lockReason ? <p className={`text-sm ${s.muted}`}>{lockReason}</p> : <button type="button" disabled={sourceChanged} className={s.secondaryButton} onClick={() => {
                const fresh = store.getState();
                if (!active.current || fresh.editing || latest.current.lockReason || fresh.projectId !== latest.current.projectId
                    || (fresh.context !== latest.current.context && !sameFullScopeSource(latest.current.source, fresh.saved))) return;
                store.dispatch({ context: latest.current.context, editing: true, message: "" }); onWorkChange(true);
            }}>Review full scope</button>}
        </> : <form className="mt-4 space-y-4" onSubmit={event => { event.preventDefault(); void submit(); }}>
            <p className={`text-sm ${s.muted}`}>Unsaved scope draft. Opening this review does not copy or save the brief. Save explicitly to use your reviewed scope in the proposal.</p>
            <label htmlFor="pricing-full-scope-text" className={s.label}>Scope</label>
            <textarea id="pricing-full-scope-text" rows={5} maxLength={TEXT_LIMITS.scope} className={s.textarea}
                disabled={state.pending || state.uncertain || !!lockReason || sourceChanged} value={state.draft} onChange={event => {
                    const fresh = store.getState();
                    if (!active.current || !fresh.editing || fresh.pending || fresh.uncertain || latest.current.lockReason || fresh.context !== latest.current.context) return;
                    store.dispatch({ draft: event.target.value, message: "" });
                }} />
            <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={state.pending || state.uncertain || !!lockReason || sourceChanged} className={s.primaryButton}>{state.pending ? "Saving..." : "Save scope"}</button>
                <button type="button" disabled={state.pending || state.uncertain} className={s.quietButton} onClick={() => {
                    const fresh = store.getState(); if (!active.current || fresh.pending || fresh.uncertain) return;
                    store.dispatch({ editing: false, draft: pricingFullScopeDraft(fresh.saved), message: "" }); onWorkChange(false);
                }}>Cancel</button>
            </div>
        </form>}
        {state.message && <p role={state.editing && !state.pending ? "alert" : "status"} className={`mt-3 text-sm ${state.uncertain ? s.errorText : s.body}`}>{state.message}</p>}
    </section>;
}
