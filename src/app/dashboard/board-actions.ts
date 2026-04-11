"use server";
import { requireAuth } from "@/lib/supabase/auth-utils";
import { revalidatePath } from "next/cache";

const VALID_STATUSES = ["Lead", "Estimating", "Proposal Sent", "Active", "Won", "Completed", "Lost"];

export async function updateStatusAction(projectId: string, newStatus: string) {
    if (!VALID_STATUSES.includes(newStatus)) {
        return { success: false, error: "Invalid status" };
    }
    const { user, supabase } = await requireAuth();
    // Scope to user so one user can't move another user's projects even if they
    // guess the id (RLS already blocks this but defence-in-depth).
    await supabase
        .from("projects")
        .update({ status: newStatus })
        .eq("id", projectId)
        .eq("user_id", user.id);
    revalidatePath("/dashboard");
    return { success: true };
}

export async function markAsWonAction(projectId: string) {
    const { user, supabase } = await requireAuth();

    await supabase
        .from("projects")
        .update({
            status: "Active",
            proposal_status: "accepted",
            proposal_accepted_at: new Date().toISOString(),
        })
        .eq("id", projectId)
        .eq("user_id", user.id);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/live");
    revalidatePath("/dashboard/projects/p-and-l");
    return { success: true };
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
