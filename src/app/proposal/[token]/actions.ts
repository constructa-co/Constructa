"use server";

import { createClient } from "@/lib/supabase/server";

export async function acceptProposalAction(token: string, clientName: string) {
    const supabase = createClient();

    // Find the project by token (no auth needed — public)
    const { data: project } = await supabase
        .from("projects")
        .select("id, proposal_accepted_at")
        .eq("proposal_token", token)
        .single();

    if (!project) {
        return { success: false, error: "Proposal not found" };
    }

    if (project.proposal_accepted_at) {
        return { success: false, error: "Already accepted" };
    }

    await supabase
        .from("projects")
        .update({
            proposal_accepted_at: new Date().toISOString(),
            proposal_accepted_by: clientName || "Client",
        })
        .eq("id", project.id);

    return { success: true };
}
