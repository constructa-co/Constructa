"use server";
import { requireAuth } from "@/lib/supabase/auth-utils";
import { revalidatePath } from "next/cache";
import { PIPELINE_CHANGE_UNCONFIRMED, PIPELINE_REFRESH_UNCONFIRMED, type PipelineMutationResult } from "@/lib/pipeline-feedback";

const VALID_STATUSES = ["Lead", "Estimating", "Proposal Sent", "Active", "Won", "Completed", "Lost"];

async function confirmedStageWrite(
    projectId: string,
    update: { status: string; proposal_status?: string; proposal_accepted_at?: string },
    paths: string[],
): Promise<PipelineMutationResult> {
    try {
        const { user, supabase } = await requireAuth();
        const { data, error } = await supabase
            .from("projects")
            .update(update)
            .eq("id", projectId)
            .eq("user_id", user.id)
            .select("id, status, proposal_status, proposal_accepted_at")
            .single();
        if (error || !data || data.id !== projectId || data.status !== update.status ||
            (update.proposal_status !== undefined && data.proposal_status !== update.proposal_status) ||
            (update.proposal_accepted_at !== undefined && Date.parse(data.proposal_accepted_at ?? "") !== Date.parse(update.proposal_accepted_at))) {
            return { success: false, error: PIPELINE_CHANGE_UNCONFIRMED };
        }
    } catch {
        return { success: false, error: PIPELINE_CHANGE_UNCONFIRMED };
    }
    // A cache failure after the returned-row acknowledgement must not turn
    // an already confirmed database write into an "unsaved" response.
    try { paths.forEach(path => revalidatePath(path)); }
    catch { return { success: true, warning: PIPELINE_REFRESH_UNCONFIRMED }; }
    return { success: true };
}

export async function updateStatusAction(projectId: string, newStatus: string): Promise<PipelineMutationResult> {
    if (!VALID_STATUSES.includes(newStatus)) {
        return { success: false, error: "Invalid status" };
    }
    return confirmedStageWrite(projectId, { status: newStatus }, ["/dashboard"]);
}

export async function markAsWonAction(projectId: string): Promise<PipelineMutationResult> {
    return confirmedStageWrite(projectId, {
            status: "Active",
            proposal_status: "accepted",
            proposal_accepted_at: new Date().toISOString(),
        }, ["/dashboard", "/dashboard/live", "/dashboard/projects/p-and-l"]);
}

export async function updateTypeAction(formData: FormData) {
    const { user, supabase } = await requireAuth();
    const id = formData.get("id") as string;
    const newType = formData.get("type") as string;

    await supabase
        .from("projects")
        .update({ project_type: newType })
        .eq("id", id)
        .eq("user_id", user.id);
    revalidatePath("/dashboard");
}
