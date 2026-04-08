"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function revalidate(projectId: string) {
    revalidatePath(`/dashboard/projects/programme?projectId=${projectId}`);
    revalidatePath(`/dashboard/projects/schedule?projectId=${projectId}`);
    revalidatePath(`/dashboard/projects/overview?projectId=${projectId}`);
}

export async function saveAsBuiltPhasesAction(projectId: string, phases: any[]) {
    const supabase = createClient();
    const { error } = await supabase
        .from("projects")
        .update({ programme_phases: phases })
        .eq("id", projectId);
    if (error) throw new Error(error.message);
    revalidate(projectId);
}
