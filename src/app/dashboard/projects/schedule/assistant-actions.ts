"use server";

import type { PlanningTurnResult } from "@/lib/server/planning-request";

/**
 * One turn of the Programme page's planning conversation (A055). The request
 * carries identifiers, the contractor's words, their transcript and a
 * fingerprint only. The server authorises the owner, rebuilds the saved
 * programme and chooses the generator itself: there is none approved yet, so
 * this answers "off" after its checks. Nothing is written.
 */
export async function planningAssistantTurnAction(input: unknown): Promise<PlanningTurnResult> {
    // Loaded here so importing this action from the page loads no server code.
    const [{ handlePlanningTurn }, { approvedPlanningGenerator }] = await Promise.all([
        import("@/lib/server/planning-request"), import("@/lib/server/job-assistant-transport"),
    ]);
    return handlePlanningTurn(input, { prepare: () => approvedPlanningGenerator() });
}
