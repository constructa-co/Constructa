"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const VALID_STATUSES = ["Lead", "Estimating", "Proposal Sent", "Active", "Won", "Completed", "Lost"];

export async function updateStatusAction(projectId: string, newStatus: string) {
    if (!VALID_STATUSES.includes(newStatus)) {
        return { success: false, error: "Invalid status" };
    }
    const supabase = createClient();
    await supabase.from("projects").update({ status: newStatus }).eq("id", projectId);
    revalidatePath("/dashboard");
    return { success: true };
}

export async function markAsWonAction(projectId: string) {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) return { success: false, error: "Not authenticated" };

    await supabase
        .from("projects")
        .update({
            status: "Active",
            proposal_status: "accepted",
            proposal_accepted_at: new Date().toISOString(),
        })
        .eq("id", projectId)
        .eq("user_id", authData.user.id);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/live");
    revalidatePath("/dashboard/projects/p-and-l");
    return { success: true };
}

export async function updateTypeAction(formData: FormData) {
    const supabase = createClient();
    const id = formData.get("id") as string;
    const newType = formData.get("type") as string;

    await supabase.from("projects").update({ project_type: newType }).eq("id", id);
    revalidatePath("/dashboard");
}
