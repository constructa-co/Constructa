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

export async function updateTypeAction(formData: FormData) {
    const supabase = createClient();
    const id = formData.get("id") as string;
    const newType = formData.get("type") as string;

    await supabase.from("projects").update({ project_type: newType }).eq("id", id);
    revalidatePath("/dashboard");
}
