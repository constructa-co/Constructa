"use client";

import Link from "next/link";
import { buildProposalPayload, draftFromProject, MAX_PAYMENT_STAGES, type PaymentStageDraft } from "@/lib/proposal-review";
import { roundMoney } from "@/lib/financial";
import { useReducerStore } from "@/lib/use-reducer-store";
import type { WorkspaceStyles } from "@/lib/workspace-styles";
import { savePricingPaymentStagesAction } from "../proposal/actions";

type Schedule = unknown[] | null;
type State = { saved: Schedule; rows: PaymentStageDraft[]; editing: boolean; pending: boolean; uncertain: boolean; message: string };
function patchState(state: State, patch: Partial<State>): State { return { ...state, ...patch }; }
function rowsFrom(saved: Schedule): PaymentStageDraft[] {
    return draftFromProject({ id: "pricing", name: "", payment_schedule: saved }, () => crypto.randomUUID()).payments;
}
function editableSchedule(value: unknown): value is Schedule {
    return value === null || (Array.isArray(value) && value.length <= MAX_PAYMENT_STAGES && value.every(row =>
        row && typeof row === "object" && typeof row.stage === "string" && typeof row.id === "string" &&
        typeof row.description === "string" && typeof row.percentage === "number" && row.percentage > 0 && row.percentage <= 100 &&
        !(Number(row.amount) > 0)));
}

export default function PricingPaymentStages({ projectId, schedule, lockReason, styles: s, onWorkChange, save = savePricingPaymentStagesAction }: {
    projectId: string; schedule: unknown; lockReason: string | null; styles: WorkspaceStyles;
    onWorkChange: (open: boolean) => void; save?: typeof savePricingPaymentStagesAction;
}) {
    const supported = editableSchedule(schedule);
    const [state, store] = useReducerStore(patchState, () => ({ saved: supported ? schedule : null,
        rows: supported ? rowsFrom(schedule) : [], editing: false, pending: false, uncertain: false, message: "" }));
    const proposalHref = `/dashboard/projects/proposal?projectId=${encodeURIComponent(projectId)}#review-payments`;
    const builtDraft = supported && state.editing ? buildProposalPayload({
        ...draftFromProject({ id: projectId, name: "", payment_schedule: null }, () => "draft-total"), payments: state.rows,
    }) : null;
    const draftPercentageTotal = builtDraft?.ok && builtDraft.payload.paymentSchedule?.length
        ? roundMoney(builtDraft.payload.paymentSchedule.reduce((sum, row) => sum + row.percentage, 0)) : null;
    const change = (rows: PaymentStageDraft[]) => {
        const fresh = store.getState();
        if (!fresh.editing || fresh.pending || fresh.uncertain || lockReason || !supported) return;
        store.dispatch({ rows, message: "" });
    };
    const submit = async () => {
        const fresh = store.getState();
        if (!fresh.editing || fresh.pending || fresh.uncertain || lockReason || !supported) return;
        const draft = draftFromProject({ id: projectId, name: "", payment_schedule: null }, () => crypto.randomUUID());
        const built = buildProposalPayload({ ...draft, payments: fresh.rows });
        if (!built.ok) { store.dispatch({ message: Object.values(built.fieldErrors).join(" ") }); return; }
        store.dispatch({ pending: true, message: "Saving payment stages..." });
        try {
            const result = await save(projectId, fresh.saved, built.payload.paymentSchedule ?? []);
            if (!result.success) { store.dispatch({ pending: false, uncertain: !!result.uncertain, message: result.error }); return; }
            store.dispatch({ saved: result.paymentSchedule, rows: rowsFrom(result.paymentSchedule), editing: false, pending: false,
                message: result.paymentSchedule.length ? "Payment stages saved for this project's proposal." : "Saved with no payment stages. The proposal will still need payment stages before sending." });
            onWorkChange(false);
        } catch {
            store.dispatch({ pending: false, uncertain: true, message: "The save wasn't confirmed. It may have saved. Your draft is retained; reload to check before saving again." });
        }
    };
    return <section className={`${s.card} p-4 sm:p-6`} aria-labelledby="pricing-payments-title" data-pricing-payments>
        <h2 id="pricing-payments-title" className={`text-lg font-bold ${s.heading}`}>Payment stages</h2>
        <p className={`mt-2 text-sm ${s.muted}`}>Choose when the client pays while building the price. These stages belong to the project, across all estimate versions. No deposit or completion terms are chosen for you.</p>
        {lockReason ? <p className={`mt-3 text-sm ${s.muted}`}>{lockReason}</p> : !supported ?
            <p className={`mt-3 text-sm ${s.muted}`}>Existing fixed-amount or legacy stages are kept unchanged. <Link href={proposalHref} className="underline">Review them in the proposal</Link>.</p> : <>
            {!state.editing ? <>
                {state.saved?.length ? <ul className={`my-3 space-y-2 ${s.body}`}>{state.rows.map(row => <li key={row.key}><strong>{row.stage} - {row.percentage}%</strong>{row.when && <p className="text-sm break-words">{row.when}</p>}</li>)}</ul>
                    : <p className={`my-3 text-sm ${s.muted}`}>No payment stages saved yet. You will need them before sending the proposal.</p>}
                <button type="button" className={s.secondaryButton} onClick={() => {
                    if (lockReason || !supported || store.getState().editing) return;
                    store.dispatch({ editing: true, message: "" }); onWorkChange(true);
                }}>{state.saved?.length ? "Edit payment stages" : "Set payment stages"}</button>
            </> : <form className="mt-4 space-y-4" onSubmit={event => { event.preventDefault(); void submit(); }}>
                <p className={`text-sm ${s.muted}`}>Unsaved payment-stage draft. Enter your own stages and percentages; the total must not exceed 100%.</p>
                <p className={`text-sm ${s.muted}`}>Draft percentage total (not saved): <output aria-label="Draft percentage total (not saved)" aria-live="polite">{draftPercentageTotal === null ? "Check the stage names and percentages." : `${draftPercentageTotal}%`}</output></p>
                <fieldset disabled={state.pending || state.uncertain} className="space-y-4 min-w-0">
                    {state.rows.map((row, index) => <div key={row.key} className="grid gap-3 sm:grid-cols-2">
                        <label className={s.label}>Stage {index + 1}<input aria-label={`Stage ${index + 1} name`} maxLength={200} className={s.input} value={row.stage}
                            onChange={event => change(store.getState().rows.map(r => r.key === row.key ? { ...r, stage: event.target.value } : r))} /></label>
                        <label className={s.label}>Share (%)<input aria-label={`Stage ${index + 1} percentage`} inputMode="decimal" className={s.input} value={row.percentage}
                            onChange={event => change(store.getState().rows.map(r => r.key === row.key ? { ...r, percentage: event.target.value } : r))} /></label>
                        <label className={`${s.label} sm:col-span-2`}>When payment is due<input aria-label={`Stage ${index + 1} due`} maxLength={1000} className={s.input} value={row.when}
                            onChange={event => change(store.getState().rows.map(r => r.key === row.key ? { ...r, when: event.target.value } : r))} /></label>
                        <button type="button" className={`${s.quietButton} justify-self-start`} onClick={() => change(store.getState().rows.filter(r => r.key !== row.key))}>Remove stage {index + 1}</button>
                    </div>)}
                    <button type="button" className={s.secondaryButton} disabled={state.rows.length >= MAX_PAYMENT_STAGES} onClick={() => {
                        const rows = store.getState().rows;
                        if (rows.length < MAX_PAYMENT_STAGES) change([...rows, { key: crypto.randomUUID(), stage: "", when: "", percentage: "" }]);
                    }}>Add payment stage</button>
                </fieldset>
                <div className="flex flex-wrap gap-3">
                    <button type="submit" className={s.primaryButton} disabled={state.pending || state.uncertain}>{state.pending ? "Saving..." : "Save payment stages"}</button>
                    <button type="button" className={s.quietButton} disabled={state.pending || state.uncertain} onClick={() => {
                        const fresh = store.getState(); if (fresh.pending || fresh.uncertain) return;
                        store.dispatch({ editing: false, rows: rowsFrom(fresh.saved), message: "" }); onWorkChange(false);
                    }}>Cancel</button>
                </div>
            </form>}
        </>}
        {state.message && <p role={state.editing && !state.pending ? "alert" : "status"} className={`mt-3 text-sm ${state.uncertain ? s.errorText : s.body}`}>{state.message}</p>}
    </section>;
}
