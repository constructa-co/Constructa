import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId } from "@/lib/supabase/auth-utils";
import LibraryPageClient from "./library-page-client";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
    const supabase = createClient();

    let orgId: string | null = null;
    try { orgId = await getActiveOrganizationId(); } catch {}

    // Fetch categories
    const { data: categories } = await supabase
        .from("mom_categories")
        .select("*")
        .is("organization_id", null) // system categories only
        .order("sort_order", { ascending: true });

    // Fetch all items
    const { data: allItems } = await supabase
        .from("mom_items")
        .select("*")
        .is("organization_id", null)
        .order("code", { ascending: true });

    // Fetch org overrides
    let overrides: any[] = [];
    if (orgId) {
        const { data } = await supabase
            .from("mom_item_overrides")
            .select("*")
            .eq("organization_id", orgId);
        overrides = data || [];
    }

    // Merge overrides into items
    const overrideMap = Object.fromEntries(overrides.map(o => [o.mom_item_id, o]));
    const itemsWithOverrides = (allItems || []).map(item => ({
        ...item,
        override: overrideMap[item.id] || null,
    }));

    // Group items by category
    const itemsByCategory = (categories || []).map(cat => ({
        ...cat,
        items: itemsWithOverrides.filter(i => i.category_id === cat.id),
    }));

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            <div className="max-w-6xl mx-auto p-8 pt-24 space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">Cost Library</h1>
                    <p className="text-slate-400 mt-1">
                        UK market benchmarks across {categories?.length || 0} trade categories.
                        Rates shown are market benchmarks — set your own rates to personalise your estimates.
                    </p>
                </div>
                <LibraryPageClient categoriesWithItems={itemsByCategory} />
            </div>
        </div>
    );
}
