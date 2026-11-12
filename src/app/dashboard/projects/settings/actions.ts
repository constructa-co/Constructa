"use server";

import { requireAuth } from "@/lib/supabase/auth-utils";
import { revalidatePath } from "next/cache";
import { requireEditableProjectAccess } from "@/lib/supabase/project-resource-access";
import { precontractLockMessage } from "@/lib/project-editability";

export async function updateProjectAction(formData: FormData) {
    const projectId = formData.get("projectId") as string;
    if (formData.has("status")) return { success: false, error: "Save the project status separately." };
    let access;
    try {
        access = await requireEditableProjectAccess(projectId);
    } catch (error) {
        const lockReason = precontractLockMessage(error);
        if (lockReason) return { success: false, lockReason };
        throw error;
    }

    const potentialValueRaw = formData.get("potential_value") as string;
    const potentialValue = potentialValueRaw ? parseFloat(potentialValueRaw) : null;

    const startDateRaw = formData.get("start_date") as string;
    const startDate = startDateRaw || null;

    const updates: Record<string, any> = {
        name: formData.get("name") as string,
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

        // P1-1 — VAT Domestic Reverse Charge toggle (HMRC VAT Notice 735).
        // When true, proposal and invoice PDFs suppress the 20% VAT line.
        is_vat_reverse_charge: formData.get("is_vat_reverse_charge") === "on",
    };

    // Remove empty strings to avoid overwriting with blank
    Object.keys(updates).forEach(key => {
        if (updates[key] === "") updates[key] = null;
    });

    return saveSettingsUpdate(access, projectId, updates);
}

export async function updateProjectStatusAction(formData: FormData) {
    const access = await requireAuth();
    const projectId = formData.get("projectId");
    const status = formData.get("status");
    if (typeof projectId !== "string" || !projectId || typeof status !== "string") return { success: false };
    return saveSettingsUpdate(access, projectId, { status: status === "" ? null : status });
}

async function saveSettingsUpdate(access: Awaited<ReturnType<typeof requireAuth>>, projectId: string, updates: Record<string, unknown>) {
    const { user, supabase } = access;
    const { data, error } = await supabase
        .from("projects")
        .update(updates)
        .eq("id", projectId)
        .eq("user_id", user.id)
        .select("id")
        .single();

    if (error) console.error("Settings update error:", error);
    if (error || !data || data.id !== projectId) return { success: false };

    revalidatePath(`/dashboard/projects/settings?projectId=${projectId}`);
    return { success: true };
}
