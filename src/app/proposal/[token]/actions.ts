"use server";

import { createClient } from "@/lib/supabase/server";

export async function acceptProposalAction(
    token: string,
    clientName: string,
    clientEmail: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = createClient();

    const { data: project } = await supabase
        .from("projects")
        .select("id, name, proposal_accepted_at, user_id, client_name")
        .eq("proposal_token", token)
        .single();

    if (!project) return { success: false, error: "Proposal not found" };
    if (project.proposal_accepted_at)
        return { success: false, error: "This proposal has already been accepted" };

    const acceptedAt = new Date().toISOString();

    await supabase
        .from("projects")
        .update({
            proposal_accepted_at: acceptedAt,
            proposal_accepted_by: clientName || "Client",
            client_email: clientEmail || null,
            proposal_status: "accepted",
        })
        .eq("id", project.id);

    return { success: true };
}
