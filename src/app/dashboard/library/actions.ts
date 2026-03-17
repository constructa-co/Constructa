"use server";

import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId } from "@/lib/supabase/auth-utils";
import { revalidatePath } from "next/cache";

/**
 * Fetches all items from the MoM library for the current organization.
 */
export async function getCostLibraryAction() {
    const supabase = createClient();
    const orgId = await getActiveOrganizationId();

    const { data, error } = await supabase
        .from("mom_items")
        .select(`
            *,
            category:mom_categories!category_id (
                id,
                name,
                code,
                parent:mom_categories!parent_id (
                    id,
                    name,
                    code
                )
            )
        `)
        .eq("organization_id", orgId)
        .order("code");

    if (error) {
        throw new Error(error.message);
    }

    // Transform for UI backward compatibility if needed
    return data.map((item: any) => ({
        ...item,
        category_name: item.category?.name,
        parent_category_name: item.category?.parent?.name,
        // Map back to the old "flat" structure for the UI
        category: item.category?.parent ? `${item.category.parent.name} > ${item.category.name}` : item.category?.name,
        rate: item.base_rate
    }));
}

/**
 * Deletes an item from the MoM library.
 */
export async function deleteCostLibraryItemAction(id: string) {
    const supabase = createClient();
    const orgId = await getActiveOrganizationId();

    const { error } = await supabase
        .from("mom_items")
        .delete()
        .eq("id", id)
        .eq("organization_id", orgId);

    if (error) {
        throw new Error(error.message);
    }

    revalidatePath("/dashboard/library");
}

/**
 * Bulk imports items into the Nested MoM structure.
 */
export async function bulkAddMoMItemsAction(items: any[]) {
    const supabase = createClient();
    const orgId = await getActiveOrganizationId();
    
    let count = 0;

    for (const item of items) {
        const levels = item.levels || []; // e.g. ["1. Preliminaries", "Site Setup & Welfare"]
        let parentId = null;

        // 1. Ensure categories exist
        for (let i = 0; i < levels.length; i++) {
            const levelName = levels[i];
            const levelCode = levelName.split(' ')[0] || levelName.toLowerCase().replace(/\s+/g, '_');

            const { data: category, error: catError } = await supabase
                .from("mom_categories")
                .upsert({
                    organization_id: orgId,
                    parent_id: parentId,
                    code: levelCode,
                    name: levelName
                }, { onConflict: 'organization_id, code' })
                .select()
                .single() as { data: any, error: any };

            if (catError) {
                console.error("Category creation error:", catError);
                continue;
            }
            parentId = category.id;
        }

        // 2. Insert item
        const { error: itemError } = await supabase
            .from("mom_items")
            .upsert({
                organization_id: orgId,
                category_id: parentId,
                code: item.code || `ITEM-${Math.random().toString(36).substr(2, 9)}`,
                description: item.description,
                unit: item.unit || 'Each',
                base_rate: item.rate
            }, { onConflict: 'organization_id, code' });

        if (!itemError) count++;
    }

    revalidatePath("/dashboard/library");
    return { count };
}

// ── SPRINT 1: Custom Rate Override Actions ────────────────────────────────────

export async function upsertRateOverrideAction(formData: FormData) {
    "use server";
    const supabase = createClient();
    const orgId = await getActiveOrganizationId();

    const momItemId = formData.get("mom_item_id") as string;
    const customRate = parseFloat(formData.get("custom_rate") as string);
    const notes = (formData.get("notes") as string) || null;

    if (!momItemId || isNaN(customRate) || customRate < 0) {
        return { error: "Invalid rate value." };
    }

    const { error } = await supabase
        .from("mom_item_overrides")
        .upsert({
            organization_id: orgId,
            mom_item_id: momItemId,
            custom_rate: customRate,
            notes,
            updated_at: new Date().toISOString(),
        }, { onConflict: "organization_id,mom_item_id" });

    if (error) return { error: error.message };

    revalidatePath("/dashboard/library");
    return { success: true };
}

export async function deleteRateOverrideAction(formData: FormData) {
    "use server";
    const supabase = createClient();
    const orgId = await getActiveOrganizationId();

    const momItemId = formData.get("mom_item_id") as string;

    await supabase
        .from("mom_item_overrides")
        .delete()
        .eq("organization_id", orgId)
        .eq("mom_item_id", momItemId);

    revalidatePath("/dashboard/library");
    return { success: true };
}
