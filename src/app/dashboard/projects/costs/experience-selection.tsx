"use client";

import { useEffect, useRef } from "react";
import { useReducerStore } from "@/lib/use-reducer-store";
import { pricingExperienceChangeError, sameExperienceSource, type PricingExperienceSource } from "@/lib/pricing-experience";
import type { WorkspaceStyles } from "@/lib/workspace-styles";
import type { savePricingExperienceAction } from "./experience-actions";

const saveExperience: typeof savePricingExperienceAction = async (...args) => (await import("./experience-actions")).savePricingExperienceAction(...args);

type State = { projectId: string; context: string; saved: PricingExperienceSource; draft: string[]; editing: boolean; pending: boolean; uncertain: boolean; message: string };
const patchState = (state: State, patch: Partial<State>): State => ({ ...state, ...patch });

export default function PricingExperienceEditor({ projectId, source, lockReason, styles: s, onWorkChange, save = saveExperience }: {
    projectId: string; source: PricingExperienceSource; lockReason: string | null; styles: WorkspaceStyles;
    onWorkChange: (open: boolean) => void; save?: typeof savePricingExperienceAction;
}) {
    const context = JSON.stringify({ projectId, catalogKey: source.catalogKey, selected: source.selected });
    const latest = useRef({ projectId, source, context, lockReason });
    const active = useRef(true);
    useEffect(() => { latest.current = { projectId, source, context, lockReason }; }, [projectId, source, context, lockReason]);
    useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
    const [state, store] = useReducerStore(patchState, () => ({ projectId, context, saved: source, draft: [...(source.selected ?? [])], editing: false, pending: false, uncertain: false, message: "" }));
    const sourceChanged = projectId !== state.projectId || (context !== state.context && !sameExperienceSource(source, state.saved));
    const submit = async () => {
        const fresh = store.getState();
        if (!active.current || !fresh.editing || fresh.pending || fresh.uncertain || latest.current.lockReason || fresh.context !== latest.current.context) return;
        const problem = pricingExperienceChangeError(fresh.saved, fresh.draft);
        if (problem) { store.dispatch({ message: problem }); return; }
        store.dispatch({ pending: true, message: "Saving experience choices..." });
        try {
            const result = await save(projectId, { catalogKey: fresh.saved.catalogKey, selected: fresh.saved.selected }, fresh.draft);
            if (!active.current) return;
            if (latest.current.projectId !== fresh.projectId) throw Error("Project changed");
            if (!result.success) { store.dispatch({ pending: false, uncertain: !!result.uncertain, message: result.error }); return; }
            if (!result.source || result.source.catalogKey !== fresh.saved.catalogKey || JSON.stringify(result.source.selected) !== JSON.stringify(fresh.draft)) throw Error("Different acknowledgement");
            if (latest.current.context !== fresh.context && !sameExperienceSource(latest.current.source, result.source)) throw Error("Sources changed");
            store.dispatch({ context: latest.current.context, saved: result.source, draft: [...(result.source.selected ?? [])], pending: false, editing: false, message: "Experience choices saved for the proposal." });
            onWorkChange(false);
        } catch {
            if (!active.current) return;
            store.dispatch({ pending: false, uncertain: true, message: "The selection save wasn't confirmed. It may have saved. Your draft is retained; reload before saving again." });
        }
    };
    return <section data-pricing-experience aria-labelledby="pricing-experience-title" className={`${s.card} p-4 sm:p-5`}>
        <h2 id="pricing-experience-title" className={`text-lg font-bold ${s.heading}`}>Relevant experience</h2>
        <p className={`mt-2 text-sm ${s.muted}`}>Choose from your saved past jobs while pricing. No job history is generated or changed here. Choosing does not save or send a proposal.</p>
        {sourceChanged && <p role="alert" className={`mt-3 text-sm ${s.errorText}`}>The project, choices or experience sources changed. Your draft is retained; reload to review before editing again.</p>}
        {!state.editing ? <>
            <p className={`my-4 text-sm ${s.body}`}>{(state.saved.selected ?? []).length} saved selection values. This is not a count of jobs that will appear.</p>
            {lockReason ? <p className={s.muted}>{lockReason}</p> : <button type="button" className={s.secondaryButton} disabled={sourceChanged} onClick={() => {
                const fresh = store.getState();
                if (!active.current || fresh.editing || latest.current.lockReason || fresh.projectId !== latest.current.projectId
                    || (fresh.context !== latest.current.context && !sameExperienceSource(latest.current.source, fresh.saved))) return;
                store.dispatch({ context: latest.current.context, editing: true, message: "" }); onWorkChange(true);
            }}>Review relevant experience</button>}
        </> : <form className="mt-4 space-y-4" onSubmit={event => { event.preventDefault(); void submit(); }}>
            <p className={`text-sm ${s.muted}`}>Unsaved experience choices. Each identity keeps its existing meaning; older jobs use the existing first-six display rule.</p>
            <fieldset disabled={state.pending || state.uncertain || !!lockReason || sourceChanged} className="space-y-3">
                <legend className={s.label}>Saved jobs to include</legend>
                {state.saved.options.length === 0 && <p className={s.muted}>No selectable saved jobs are available here.</p>}
                {state.saved.options.map(option => <label key={option.tick} className={`flex items-start gap-3 ${s.body}`}>
                    <input type="checkbox" checked={state.draft.includes(option.tick)} onChange={() => {
                        const fresh = store.getState();
                        if (!active.current || !fresh.editing || fresh.pending || fresh.uncertain || latest.current.lockReason || fresh.context !== latest.current.context
                            || !fresh.saved.options.some(item => item.tick === option.tick)) return;
                        store.dispatch({ draft: fresh.draft.includes(option.tick) ? fresh.draft.filter(tick => tick !== option.tick) : [...fresh.draft, option.tick], message: "" });
                    }} />
                    <span className="min-w-0 break-words"><span className="font-semibold">{option.title}</span>
                        {option.detail && <span className="block text-sm">{option.detail}</span>}
                        <span className={`block text-xs ${s.muted}`}>Saved choice: {option.tick}</span></span>
                </label>)}
            </fieldset>
            {state.saved.retained.length > 0 && <div className={`text-sm ${s.muted}`}>
                <p>Unavailable saved choices are kept unchanged here. Review them on the proposal page; they have not been dropped.</p>
                <p className="break-words whitespace-pre-wrap">{state.saved.retained.join(", ")}</p>
            </div>}
            <p className={s.label}>Current saved proposal checks</p>
            {state.saved.notes.map((note, index) => <p key={index} className={`text-sm ${s.muted}`}>{note}</p>)}
            <a className={s.quietButton} href={`/dashboard/projects/proposal?projectId=${encodeURIComponent(projectId)}`}>Review experience on proposal</a>
            <div className="flex flex-wrap gap-3">
                <button type="submit" className={s.primaryButton} disabled={state.pending || state.uncertain || !!lockReason || sourceChanged}>{state.pending ? "Saving..." : "Save experience choices"}</button>
                <button type="button" className={s.quietButton} disabled={state.pending || state.uncertain} onClick={() => {
                    const fresh = store.getState(); if (!active.current || fresh.pending || fresh.uncertain) return;
                    store.dispatch({ editing: false, draft: [...(fresh.saved.selected ?? [])], message: "" }); onWorkChange(false);
                }}>Cancel</button>
            </div>
        </form>}
        {state.message && <p role={state.editing && !state.pending ? "alert" : "status"} className={`mt-3 text-sm ${state.uncertain ? s.errorText : s.body}`}>{state.message}</p>}
    </section>;
}
