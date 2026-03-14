"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateProjectAction(formData: FormData) {
    const supabase = createClient();
    const projectId = formData.get("projectId") as string;

    const updates = {
        name: formData.get("projectName") as string,
        description: formData.get("description") as string,
        client_name: formData.get("clientName") as string,
        status: formData.get("status") as string,

        // CRM
        client_email: formData.get("clientEmail") as string,
        client_phone: formData.get("clientPhone") as string,
        site_address: formData.get("siteAddress") as string,
        start_date: formData.get("startDate") as string || null,
        end_date: formData.get("endDate") as string || null,

        // T&C
        exclusions: formData.get("exclusions") as string,
        clarifications: formData.get("clarifications") as string
    };

    const { error } = await supabase.from("projects").update(updates).eq("id", projectId);

    revalidatePath("/dashboard/projects/settings");
}
