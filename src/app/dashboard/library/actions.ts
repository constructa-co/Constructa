"use server";

import { requireAuth, getActiveOrganizationId } from "@/lib/supabase/auth-utils";
import { revalidatePath } from "next/cache";

/**
 * Fetches all items from the MoM library for the current organization.
 */
export async function getCostLibraryAction() {
    const { supabase } = await requireAuth();
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
    const { supabase } = await requireAuth();
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
 *
 * P2-7 — previously did N × (M+1) queries (one upsert per category at
 * every level of the hierarchy per item, plus one per item). 100 items
 * × 3 levels = ~400 round trips to Supabase. Now batches by depth:
 *   - 1 query per category depth to upsert that level's unique nodes
 *   - 1 query to upsert all items
 * Typical 100-item library import: ~4 queries instead of ~400.
 */
export async function bulkAddMoMItemsAction(items: any[]) {
    const { supabase } = await requireAuth();
    const orgId = await getActiveOrganizationId();

    const codeFromName = (name: string): string =>
        name.split(" ")[0] || name.toLowerCase().replace(/\s+/g, "_");

    // ── 1. Collect unique category paths per depth ─────────────────────
    // Each unique (orgId, code) combination needs exactly one upsert.
    // Track dependencies so depth N's parentCode resolves to depth N-1's
    // upserted id.
    type CategoryNode = {
        depth: number;
        code: string;
        name: string;
        parentCode: string | null;
    };
    const nodesByDepth = new Map<number, Map<string, CategoryNode>>();
    let maxDepth = 0;

    for (const item of items) {
        const levels: string[] = item.levels || [];
        let parentCode: string | null = null;
        for (let i = 0; i < levels.length; i++) {
            const name = levels[i];
            const code = codeFromName(name);
            if (!nodesByDepth.has(i)) nodesByDepth.set(i, new Map());
            const depthMap = nodesByDepth.get(i)!;
            if (!depthMap.has(code)) {
                depthMap.set(code, { depth: i, code, name, parentCode });
            }
            parentCode = code;
            if (i > maxDepth) maxDepth = i;
        }
    }

    // ── 2. Upsert categories level-by-level ────────────────────────────
    // Each level needs its parent ids resolved from the previous level's
    // upsert result. One query per level = O(maxDepth + 1) queries total
    // (typically 3-4) regardless of item count.
    const codeToId = new Map<string, string>();

    for (let depth = 0; depth <= maxDepth; depth++) {
        const nodes = nodesByDepth.get(depth);
        if (!nodes || nodes.size === 0) continue;

        const rows = Array.from(nodes.values()).map(n => ({
            organization_id: orgId,
            parent_id: n.parentCode ? (codeToId.get(n.parentCode) ?? null) : null,
            code: n.code,
            name: n.name,
        }));

        const { data: upserted, error } = await supabase
            .from("mom_categories")
            .upsert(rows, { onConflict: "organization_id, code" })
            .select("id, code");

        if (error) {
            console.error(`[bulkAddMoMItems] category upsert depth ${depth} failed`, error);
            continue;
        }

        for (const row of (upserted ?? []) as { id: string; code: string }[]) {
            codeToId.set(row.code, row.id);
        }
    }

    // ── 3. Bulk upsert all items in a single query ─────────────────────
    const itemRows = items.map((item) => {
        const levels: string[] = item.levels || [];
        const leafCode = levels.length > 0 ? codeFromName(levels[levels.length - 1]) : null;
        return {
            organization_id: orgId,
            category_id: leafCode ? (codeToId.get(leafCode) ?? null) : null,
            code: item.code || `ITEM-${Math.random().toString(36).substr(2, 9)}`,
            description: item.description,
            unit: item.unit || "Each",
            base_rate: item.rate,
        };
    });

    let count = 0;
    if (itemRows.length > 0) {
        const { data: insertedItems, error } = await supabase
            .from("mom_items")
            .upsert(itemRows, { onConflict: "organization_id, code" })
            .select("id");

        if (error) {
            console.error("[bulkAddMoMItems] item upsert failed", error);
        } else {
            count = (insertedItems ?? []).length;
        }
    }

    revalidatePath("/dashboard/library");
    return { count };
}

// ── SPRINT 1: Custom Rate Override Actions ────────────────────────────────────

export async function upsertRateOverrideAction(formData: FormData) {
    "use server";
    const { supabase } = await requireAuth();
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
    const { supabase } = await requireAuth();
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
