"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createVariationAction(data: { project_id: string; title: string; description: string; amount: number }) {
    const supabase = createClient();

    const { error } = await supabase.from("variations").insert([data]);

    if (error) throw new Error(error.message);

    revalidatePath(`/dashboard/projects/variations?projectId=${data.project_id}`);
    revalidatePath(`/dashboard/foundations?projectId=${data.project_id}`); // Revalidate overview
    return { success: true };
}

export async function updateVariationStatusAction(variationId: string, status: string, projectId: string) {
    const supabase = createClient();

    const { error } = await supabase.from("variations").update({ status }).eq("id", variationId);

    if (error) throw new Error(error.message);

    revalidatePath(`/dashboard/projects/variations?projectId=${projectId}`);
    revalidatePath(`/dashboard/foundations?projectId=${projectId}`);
    return { success: true };
}

export async function deleteVariationAction(variationId: string, projectId: string) {
    const supabase = createClient();

    const { error } = await supabase.from("variations").delete().eq("id", variationId);

    if (error) throw new Error(error.message);

    revalidatePath(`/dashboard/projects/variations?projectId=${projectId}`);
    revalidatePath(`/dashboard/foundations?projectId=${projectId}`);
    return { success: true };
}
