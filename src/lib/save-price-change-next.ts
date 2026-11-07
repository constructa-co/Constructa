import type { Estimate, EstimateLine } from "@/app/dashboard/projects/costs/types";
import {
    currentEstimate, draftFromLine, isSimpleEditable, lineTotal, submitPriceLine,
    type EstimatingServer, type EstimatingStore, type LineOp,
} from "./simple-estimate";

export function nextEditableSavedLine(estimate: Estimate | null, lineId: string): EstimateLine | null {
    if (!estimate || estimate.is_client_boq) return null;
    const index = estimate.estimate_lines.findIndex(line => line.id === lineId);
    if (index < 0 || !isSimpleEditable(estimate.estimate_lines[index], estimate)) return null;
    return estimate.estimate_lines.slice(index + 1).find(line => isSimpleEditable(line, estimate)) ?? null;
}

export interface ReviewedPriceNext {
    estimate: Estimate;
    lineId: string;
    op: LineOp;
    nextId: string;
    revision: string;
}

const UNCONFIRMED = "The line may have saved, but this response cannot confirm the reviewed change. Your draft is retained; reload to reconcile it.";

export async function savePriceAndChangeNext(
    store: EstimatingStore,
    server: Pick<EstimatingServer, "saveLine" | "updateLine">,
    projectId: string,
    reviewed: ReviewedPriceNext,
    allowed: () => boolean,
): Promise<EstimateLine | null> {
    const initial = store.getState(), estimate = currentEstimate(initial);
    const key = reviewed.lineId, op = initial.ops[key];
    const clean = () => {
        const state = store.getState();
        return allowed() && !state.advancedOpen && !state.adjustments.draft
            && !Object.values(state.ops).some(item => item.status === "saving" && item !== pending);
    };
    let pending: LineOp | undefined;
    if (!estimate || estimate !== reviewed.estimate || estimate.project_id !== projectId || estimate.is_client_boq
        || JSON.stringify(estimate) !== reviewed.revision || op !== reviewed.op || op.kind !== "edit" || op.status === "saving"
        || nextEditableSavedLine(estimate, key)?.id !== reviewed.nextId || initial.ops[reviewed.nextId] || !clean()) return null;
    const rows = estimate.estimate_lines.map(line => ({ id: line.id, revision: JSON.stringify(line) }));
    const basis = JSON.stringify({ ...estimate, estimate_lines: null, total_cost: null });
    const otherOps = Object.entries(initial.ops).filter(([id]) => id !== key);
    const otherWorkUnchanged = () => {
        const entries = Object.entries(store.getState().ops).filter(([id]) => id !== key);
        return entries.length === otherOps.length && entries.every(([id, value]) => initial.ops[id] === value);
    };
    const pendingContext = () => {
        const state = store.getState();
        return clean() && otherWorkUnchanged() && state.activeEstimateId === initial.activeEstimateId
            && currentEstimate(state) === estimate && JSON.stringify(estimate) === reviewed.revision && state.ops[key] === pending;
    };
    // Only this opt-in action tightens acknowledgement; ordinary Save is unchanged.
    const guardedStore: EstimatingStore = {
        getState: store.getState,
        dispatch: action => {
            const current = store.getState().ops[key];
            if (current !== op && current !== pending) return;
            if (action.type === "line/saved" && !pendingContext()) {
                store.dispatch({ type: "op/failed", key, error: UNCONFIRMED });
                return;
            }
            store.dispatch(action);
            if (action.type === "op/saving") pending = store.getState().ops[key];
        },
    };
    const saved = await submitPriceLine(guardedStore, {
        saveLine: server.saveLine,
        updateLine: async (estimateId, lineId, input) => {
            const result = await server.updateLine(estimateId, lineId, input);
            if (!pendingContext()) return { ok: false, error: UNCONFIRMED };
            if (!result.ok) return result;
            if (result.warning) return { ok: false, error: result.warning + " Your draft is retained; check the saved values before continuing." };
            const line = result.line;
            if (!line || line.id !== key || line.description !== input.description || line.quantity !== input.quantity
                || line.unit !== input.unit || line.unit_rate !== input.unit_rate || line.line_total !== lineTotal(input.quantity, input.unit_rate)) {
                return { ok: false, error: UNCONFIRMED };
            }
            return result;
        },
    }, projectId, key);
    const state = store.getState(), current = currentEstimate(state);
    if (!saved || state.ops[key] || !current || current.id !== estimate.id || current.project_id !== projectId || !clean()
        || !otherWorkUnchanged() || state.activeEstimateId !== initial.activeEstimateId || current.is_client_boq
        || JSON.stringify({ ...current, estimate_lines: null, total_cost: null }) !== basis
        || current.estimate_lines.length !== rows.length
        || current.estimate_lines.some((line, index) => line.id !== rows[index].id || (line.id !== key && JSON.stringify(line) !== rows[index].revision))
        || state.ops[reviewed.nextId]) return null;
    const next = nextEditableSavedLine(current, key);
    if (!next || next.id !== reviewed.nextId) return null;
    store.dispatch({ type: "op/open", key: next.id, kind: "edit", lineId: next.id, draft: draftFromLine(next) });
    return next;
}
