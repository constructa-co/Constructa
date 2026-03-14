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
        // Upsert logic or simple insert for MVP
        // First clear existing predecessors for this MVP (Single predecessor chain is easier to manage)
        await supabase.from("estimate_dependencies").delete().eq("successor_id", successor);
        await supabase.from("estimate_dependencies").insert({
            predecessor_id: predecessor,
            successor_id: successor,
            lag_days: 0 // Default
        });
    } else if (predecessor === "none") {
        await supabase.from("estimate_dependencies").delete().eq("successor_id", successor);
    }

    revalidatePath("/dashboard/projects/schedule");
}
