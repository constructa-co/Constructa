"use client";

import { useReducerStore } from "@/lib/use-reducer-store";
import { pricingScopeNoteDraft, pricingScopeNoteError, type PricingScopeNotesSource, type PricingScopeNotes } from "@/lib/pricing-scope-notes";
import { TEXT_LIMITS } from "@/lib/proposal-review";
import type { WorkspaceStyles } from "@/lib/workspace-styles";
import { savePricingScopeNotesAction } from "../proposal/actions";

type State = { saved: PricingScopeNotesSource; draft: PricingScopeNotes; editing: boolean; pending: boolean; uncertain: boolean; message: string };
function patchState(state: State, patch: Partial<State>): State { return { ...state, ...patch }; }

export default function PricingScopeNotesEditor({ projectId, source, lockReason, styles: s, onWorkChange, save = savePricingScopeNotesAction }: {
    projectId: string; source: PricingScopeNotesSource; lockReason: string | null; styles: WorkspaceStyles;
    onWorkChange: (open: boolean) => void; save?: typeof savePricingScopeNotesAction;
}) {
    const [state, store] = useReducerStore(patchState, () => ({ saved: source, draft: pricingScopeNoteDraft(source), editing: false, pending: false, uncertain: false, message: "" }));
    const savedNotes = pricingScopeNoteDraft(state.saved);
    const submit = async () => {
        const fresh = store.getState();
        if (!fresh.editing || fresh.pending || fresh.uncertain || lockReason) return;
        const error = pricingScopeNoteError(fresh.saved, fresh.draft);
        if (error) { store.dispatch({ message: error }); return; }
        store.dispatch({ pending: true, message: "Saving notes..." });
        try {
            const result = await save(projectId, fresh.saved, fresh.draft);
            if (!result.success) { store.dispatch({ pending: false, uncertain: !!result.uncertain, message: result.error }); return; }
            store.dispatch({ saved: result.source, draft: pricingScopeNoteDraft(result.source), pending: false, editing: false, message: "Exclusions and clarifications saved for the proposal." });
            onWorkChange(false);
        } catch {
            store.dispatch({ pending: false, uncertain: true, message: "The save wasn't confirmed. It may have saved. Your draft is retained; reload to check before saving again." });
        }
    };
    return <section data-pricing-scope-notes aria-labelledby="pricing-scope-notes-title" className={`${s.card} p-4 sm:p-5`}>
        <h2 id="pricing-scope-notes-title" className={`text-lg font-bold ${s.heading}`}>Exclusions and clarifications</h2>
        <p className={`mt-2 text-sm ${s.muted}`}>Record what this price does not include and anything it depends on. These project-wide notes carry into the proposal; no standard conditions are added for you.</p>
        {!state.editing ? <>
            <div className="my-4 grid gap-4 sm:grid-cols-2">
                <div><h3 className={`text-sm font-semibold ${s.heading}`}>Not included</h3><p className={`mt-1 text-sm whitespace-pre-wrap break-words ${s.body}`}>{savedNotes.exclusions || "No exclusions saved."}</p></div>
                <div><h3 className={`text-sm font-semibold ${s.heading}`}>Clarifications</h3><p className={`mt-1 text-sm whitespace-pre-wrap break-words ${s.body}`}>{savedNotes.clarifications || "No clarifications saved."}</p></div>
            </div>
            {lockReason ? <p className={`text-sm ${s.muted}`}>{lockReason}</p> : <button type="button" className={s.secondaryButton} onClick={() => {
                if (lockReason || store.getState().editing) return;
                store.dispatch({ editing: true, message: "" }); onWorkChange(true);
            }}>Review price notes</button>}
        </> : <form className="mt-4 space-y-4" onSubmit={event => { event.preventDefault(); void submit(); }}>
            <p className={`text-sm ${s.muted}`}>Unsaved notes. One item per line. Save explicitly to use this wording in the proposal.</p>
            {(state.saved.contract_exclusions?.trim() || state.saved.contract_clarifications?.trim()) && <p className={`text-sm ${s.muted}`}>Existing contract notes are used wherever proposal notes are blank. This editor can save reviewed proposal wording, but does not remove or change those contract notes.</p>}
            <fieldset disabled={state.pending || state.uncertain || !!lockReason} className="grid min-w-0 gap-4 sm:grid-cols-2">
                {(["exclusions", "clarifications"] as const).map(field => <label key={field} className={s.label}>
                    {field === "exclusions" ? "What's not included" : "Clarifications"}
                    <textarea rows={5} maxLength={TEXT_LIMITS[field]} className={s.textarea} value={state.draft[field]}
                        onChange={event => {
                            const fresh = store.getState(); if (fresh.pending || fresh.uncertain || !fresh.editing || lockReason) return;
                            store.dispatch({ draft: { ...fresh.draft, [field]: event.target.value }, message: "" });
                        }} />
                </label>)}
            </fieldset>
            <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={state.pending || state.uncertain || !!lockReason} className={s.primaryButton}>{state.pending ? "Saving..." : "Save price notes"}</button>
                <button type="button" disabled={state.pending || state.uncertain} className={s.quietButton} onClick={() => {
                    const fresh = store.getState(); if (fresh.pending || fresh.uncertain) return;
                    store.dispatch({ editing: false, draft: pricingScopeNoteDraft(fresh.saved), message: "" }); onWorkChange(false);
                }}>Cancel</button>
            </div>
        </form>}
        {state.message && <p role={state.editing && !state.pending ? "alert" : "status"} className={`mt-3 text-sm ${state.uncertain ? s.errorText : s.body}`}>{state.message}</p>}
    </section>;
}
