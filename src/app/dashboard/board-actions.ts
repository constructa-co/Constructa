"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateStatusAction(projectId: string, newStatus: string) {
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
