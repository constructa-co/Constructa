"use server";

import type { BriefTurnResult } from "@/lib/server/brief-request";

/**
 * One turn of the Brief page's conversation (A055). The request carries
 * identifiers, the contractor's words, their transcript and a fingerprint
 * only. The server authorises the owner, rebuilds the SAVED brief and chooses
 * the generator itself: there is none approved yet, so this answers "off"
 * after its checks. Nothing is saved, applied or sent.
 */
export async function briefAssistantTurnAction(input: unknown): Promise<BriefTurnResult> {
    // Loaded here so importing this action from the page loads no server code.
    const [{ handleBriefTurn }, { approvedBriefGenerator }] = await Promise.all([
        import("@/lib/server/brief-request"), import("@/lib/server/job-assistant-transport"),
    ]);
    return handleBriefTurn(input, approvedBriefGenerator() ?? undefined);
}
