"use server";

import { requireAuth } from "@/lib/supabase/auth-utils";
import { revalidatePath } from "next/cache";

export async function updateProjectAction(formData: FormData) {
    const { user, supabase } = await requireAuth();

    const projectId = formData.get("projectId") as string;

    const potentialValueRaw = formData.get("potential_value") as string;
    const potentialValue = potentialValueRaw ? parseFloat(potentialValueRaw) : null;

    const startDateRaw = formData.get("start_date") as string;
    const startDate = startDateRaw || null;

    const updates: Record<string, any> = {
        name: formData.get("name") as string,
        status: formData.get("status") as string,
        project_type: formData.get("project_type") as string,
        start_date: startDate,
        potential_value: potentialValue,
        payment_terms: formData.get("payment_terms") as string,

        // Client fields
        client_name: formData.get("client_name") as string,
        client_email: formData.get("client_email") as string || null,
        client_phone: formData.get("client_phone") as string || null,
        client_address: formData.get("client_address") as string || null,
        site_address: formData.get("site_address") as string || null,

        // Scope description
        scope_description: formData.get("scope") as string || null,
    };

    // Remove empty strings to avoid overwriting with blank
    Object.keys(updates).forEach(key => {
        if (updates[key] === "") updates[key] = null;
    });

    const { error } = await supabase
        .from("projects")
        .update(updates)
        .eq("id", projectId)
        .eq("user_id", user.id);

    if (error) console.error("Settings update error:", error);

    revalidatePath(`/dashboard/projects/settings?projectId=${projectId}`);
    return { success: !error };
}
