"use server";

import { requireAuth, getActiveOrganizationId } from "@/lib/supabase/auth-utils";
import { revalidatePath } from "next/cache";

export async function addResourceAction(formData: FormData) {
    try {
        const { supabase } = await requireAuth();
        const orgId = await getActiveOrganizationId();

        const type = formData.get("type") as string; // 'Labour' or 'Plant'
        const desc = formData.get("description") as string;
        const rate = parseFloat(formData.get("rate") as string);
        const unit = formData.get("unit") as string || (type === 'Labour' ? 'hour' : 'day');

        // 1. Ensure Category exists for this Org
        const { data: category, error: catError } = await supabase
            .from("mom_categories")
            .upsert({
                organization_id: orgId,
                code: type.toUpperCase(),
                name: type
            }, { onConflict: 'organization_id, code' })
            .select()
            .single() as { data: any, error: any };

        if (catError) throw new Error(`Category error: ${catError.message}`);

        // 2. Insert into MoM Items
        const { error } = await supabase.from("mom_items").insert({
            organization_id: orgId,
            category_id: category.id,
            description: desc,
            base_rate: rate,
            unit: unit,
            code: `${type.substring(0, 3).toUpperCase()}-${Math.floor(Math.random() * 10000)}`
        });

        if (error) throw new Error(`Database Error: ${error.message}`);

        revalidatePath("/dashboard/resources");
    } catch (e: any) {
        console.error("addResourceAction Failed:", e);
        throw new Error(e.message || "Failed to add resource.");
    }
}

export async function deleteResourceAction(formData: FormData) {
    try {
        const id = formData.get("id") as string;
        const { supabase } = await requireAuth();
        const orgId = await getActiveOrganizationId();

        const { error } = await supabase
            .from("mom_items")
            .delete()
            .eq("id", id)
            .eq("organization_id", orgId);

        if (error) throw new Error(error.message);

        revalidatePath("/dashboard/resources");
    } catch (e) {
        console.error("deleteResourceAction Failed:", e);
    }
}
