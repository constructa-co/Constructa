"use server";

import { requireAuth } from "@/lib/supabase/auth-utils";
import { revalidatePath } from "next/cache";

export async function createTemplateAction(formData: FormData) {
    const { user, supabase } = await requireAuth();

    const name = formData.get("name") as string;
    const description = formData.get("description") as string;

    const { data, error } = await supabase.from("templates").insert({
        user_id: user.id,
        name,
        description
    }).select().single();

    if (error) throw new Error(error.message);

    revalidatePath("/dashboard/library/templates");
    return data;
}

export async function deleteTemplateAction(templateId: string) {
    const { user, supabase } = await requireAuth();

    const { error } = await supabase.from("templates").delete().eq("id", templateId).eq("user_id", user.id);

    if (error) throw new Error(error.message);

    revalidatePath("/dashboard/library/templates");
}

export async function addItemsToTemplateAction(templateId: string, items: { category: string; description: string; unit: string; unit_cost: number; quantity: number }[]) {
    const { user, supabase } = await requireAuth();

    // Verify ownership
    const { data: template } = await supabase.from("templates").select("id").eq("id", templateId).eq("user_id", user.id).single();
    if (!template) throw new Error("Template not found or unauthorized");

    const rows = items.map(item => ({
        template_id: templateId,
        ...item
    }));

    const { error } = await supabase.from("template_items").insert(rows);

    if (error) throw new Error(error.message);

    revalidatePath(`/dashboard/library/templates/${templateId}`);
}

export async function removeTemplateItemAction(itemId: string, templateId: string) {
    const { user, supabase } = await requireAuth();

    const { error } = await supabase.from("template_items").delete().eq("id", itemId);

    if (error) throw new Error(error.message);

    revalidatePath(`/dashboard/library/templates/${templateId}`);
}

export async function applyTemplateAction(templateId: string, projectId: string) {
    const { user, supabase } = await requireAuth();

    // 1. Fetch template items
    const { data: items, error: fetchError } = await supabase
        .from("template_items")
        .select("*")
        .eq("template_id", templateId);

    if (fetchError) throw new Error(fetchError.message);
    if (!items || items.length === 0) throw new Error("Template is empty");

    // 2. Fetch or Create the main estimate for the project
    // (In our current system, we assume there's a default version or we use the first one)
    const { data: estimates } = await supabase
        .from("estimates")
        .select("id")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true })
        .limit(1);

    let estimateId;
    if (estimates && estimates.length > 0) {
        estimateId = estimates[0].id;
    } else {
        // Create a default estimate if none exists
        const { data: newEst } = await supabase.from("estimates").insert({
            project_id: projectId,
            version_name: "Original Estimate",
            total_cost: 0
        }).select().single();
        estimateId = newEst.id;
    }

    // 3. Insert items into estimate_lines
    const rows = items.map(item => ({
        estimate_id: estimateId,
        project_id: projectId,
        category: item.category,
        description: item.description,
        unit: item.unit,
        unit_cost: item.unit_cost, // This is for local reference if needed, but the column is unit_rate
        unit_rate: item.unit_cost,
        quantity: item.quantity
    }));

    const { error: insertError } = await supabase.from("estimate_lines").insert(rows);

    if (insertError) throw new Error(insertError.message);

    revalidatePath(`/dashboard/foundations?projectId=${projectId}`);
    return { success: true, count: rows.length };
}
