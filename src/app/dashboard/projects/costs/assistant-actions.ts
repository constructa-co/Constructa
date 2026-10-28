"use server";

import type { PricingTurnResult } from "@/lib/server/pricing-request";

/**
 * One turn of the Estimate page's pricing conversation (A055). The request
 * carries identifiers, the contractor's words, their transcript and a
 * fingerprint only. The server authorises the owner, rebuilds the saved job
 * and selected estimate, and chooses the generator itself: there is none
 * approved yet, so this answers "off" after its checks. Nothing is written.
 */
export async function pricingAssistantTurnAction(input: unknown): Promise<PricingTurnResult> {
    // Loaded here so importing this action from the page loads no server code.
    const [{ handlePricingTurn }, { approvedPricingGenerator }] = await Promise.all([
        import("@/lib/server/pricing-request"), import("@/lib/server/job-assistant-transport"),
    ]);
    return handlePricingTurn(input, approvedPricingGenerator() ?? undefined);
}
