"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateDependencyAction(formData: FormData) {
    const supabase = createClient();
    const predecessor = formData.get("predecessor") as string;
    const successor = formData.get("successor") as string;
    const duration = formData.get("duration") as string;

    // 1. Update Duration
    if (duration) {
        await supabase.from("estimates").update({ manual_duration_days: parseInt(duration) }).eq("id", successor);
    }

    // 2. Update Link (If selected)
    if (predecessor && predecessor !== "none") {
        await supabase.from("estimate_dependencies").delete().eq("successor_id", successor);
        await supabase.from("estimate_dependencies").insert({
            predecessor_id: predecessor,
            successor_id: successor,
            lag_days: 0
        });
    } else if (predecessor === "none") {
        await supabase.from("estimate_dependencies").delete().eq("successor_id", successor);
    }

    revalidatePath("/dashboard/projects/schedule");
}

export async function updatePhasesAction(
    projectId: string,
    phases: { name: string; calculatedDays: number; manualDays: number | null; manhours: number; startOffset: number }[]
): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
        .from("projects")
        .update({ timeline_phases: phases })
        .eq("id", projectId);

    if (error) console.error("Update phases error:", error);
    revalidatePath("/dashboard/projects/schedule");
}
