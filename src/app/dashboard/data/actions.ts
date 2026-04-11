"use server";

import { requireAuth, getActiveOrganizationId } from "@/lib/supabase/auth-utils";
import { revalidatePath } from "next/cache";

export async function addLibraryItemAction(formData: FormData) {
    const { supabase } = await requireAuth();
    const orgId = await getActiveOrganizationId();

    const name = formData.get("name") as string;
    const unit = formData.get("unit") as string;
    const rate = parseFloat(formData.get("rate") as string);
    const type = formData.get("type") as string; // 'Labour', 'Material', 'Plant'

    // 1. Ensure Category exists
    const { data: category, error: catError } = await supabase
        .from("mom_categories")
        .upsert({
            organization_id: orgId,
            code: type.toUpperCase(),
            name: type
        }, { onConflict: 'organization_id, code' })
        .select()
        .single() as { data: any, error: any };

    if (catError) throw new Error(catError.message);

    // 2. Insert into MoM
    await supabase.from("mom_items").insert({
        organization_id: orgId,
        category_id: category.id,
        description: name,
        base_rate: rate,
        unit,
        code: `${type.substring(0, 3).toUpperCase()}-${Math.floor(Math.random() * 10000)}`
    });

    revalidatePath("/dashboard/data/labor");
    revalidatePath("/dashboard/data/materials");
}

export async function deleteLibraryItemAction(formData: FormData) {
    const { supabase } = await requireAuth();
    const orgId = await getActiveOrganizationId();
    const id = formData.get("id") as string;

    await supabase
        .from("mom_items")
        .delete()
        .eq("id", id)
        .eq("organization_id", orgId);

    revalidatePath("/dashboard/data/labor");
    revalidatePath("/dashboard/data/materials");
}
