"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Acknowledge an obligation from the supervisor portal.
 * Validated by token (no requireAuth — public route).
 */
export async function acknowledgeObligationAction(
    token: string,
    obligationId: string,
    acknowledgedBy: string,
): Promise<{ success: boolean; error?: string }> {
    if (!token || !obligationId || !acknowledgedBy.trim()) {
        return { success: false, error: "Missing required fields" };
    }

    const supabase = createClient();

    // Validate token exists and get the project_id
    const { data: invite } = await supabase
        .from("supervisor_tokens")
        .select("project_id")
        .eq("token", token)
        .single();

    if (!invite) {
        return { success: false, error: "Invalid or expired token" };
    }

    // Validate obligation belongs to the same project
    const { data: obligation } = await supabase
        .from("contract_obligations")
        .select("id, project_id")
        .eq("id", obligationId)
        .eq("project_id", invite.project_id)
        .single();

    if (!obligation) {
        return { success: false, error: "Obligation not found for this project" };
    }

    // Record acknowledgment
    const { error } = await supabase
        .from("contract_obligations")
        .update({
            acknowledged_at: new Date().toISOString(),
            acknowledged_by: acknowledgedBy.trim(),
        })
        .eq("id", obligationId);

    if (error) {
        return { success: false, error: error.message };
    }

    return { success: true };
}
