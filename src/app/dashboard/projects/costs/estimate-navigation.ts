import type { EstimatingState } from "@/lib/simple-estimate";

export const ESTIMATE_LEAVE_WARNING = "This estimate has an open edit or a save that is not confirmed.\n\nPress Cancel to stay here, or OK to leave without saving the open edits.";

export function hasOpenEstimateWork(state: Pick<EstimatingState, "ops" | "adjustments">): boolean {
    return Object.keys(state.ops).length > 0 || state.adjustments.draft !== null || state.adjustments.status !== "idle";
}
