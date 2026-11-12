import { unstable_rethrow } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId } from "@/lib/supabase/auth-utils";
import LibraryPageClient from "./library-page-client";

export const dynamic = "force-dynamic";

const CATALOG_UNAVAILABLE = "The cost library couldn't be loaded. Reload the page to try again.";
const RATES_UNAVAILABLE = "Your own rates couldn't be loaded, so the library isn't shown with market benchmarks in their place. Reload the page to try again.";

// A read is only trusted when it returned rows and no error; partial data alongside an error is not.
function confirmedRows<T>(result: { data: T[] | null; error: unknown }): T[] {
    if (result.error || !result.data) throw result.error ?? new Error("No rows returned.");
    return result.data;
}

// Shown instead of the library when the org, catalog or custom rates can't be confirmed,
// so benchmarks are never presented as if the organisation had no custom rates.
function LibraryUnavailable({ message }: { message: string }) {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            <div className="max-w-6xl mx-auto p-8 pt-24 space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">Cost Library</h1>
                    <p role="alert" className="text-red-300 text-sm mt-1">{message}</p>
                </div>
            </div>
        </div>
    );
}

export default async function LibraryPage() {
    const supabase = await createClient();

    let orgId: string;
    try {
        orgId = await getActiveOrganizationId();
    } catch (error) {
        unstable_rethrow(error);
        return <LibraryUnavailable message="We couldn't confirm your organisation, so the cost library and your own rates can't be shown. Reload the page to try again." />;
    }

    // The message for the read in progress, shown if it returns an error or throws.
    let unavailable = CATALOG_UNAVAILABLE;
    let categories, allItems, overrides;
    try {
        // Fetch categories
        categories = confirmedRows(await supabase
            .from("mom_categories")
            .select("*")
            .is("organization_id", null) // system categories only
            .order("sort_order", { ascending: true }));

        // Fetch all items
        allItems = confirmedRows(await supabase
            .from("mom_items")
            .select("*")
            .is("organization_id", null)
            .order("code", { ascending: true }));

        // Fetch org overrides
        unavailable = RATES_UNAVAILABLE;
        overrides = confirmedRows(await supabase
            .from("mom_item_overrides")
            .select("*")
            .eq("organization_id", orgId));
    } catch (error) {
        unstable_rethrow(error);
        return <LibraryUnavailable message={unavailable} />;
    }

    // Merge overrides into items
    const overrideMap = Object.fromEntries(overrides.map(o => [o.mom_item_id, o]));
    const itemsWithOverrides = allItems.map(item => ({
        ...item,
        override: overrideMap[item.id] || null,
    }));

    // Group items by category
    const itemsByCategory = categories.map(cat => ({
        ...cat,
        items: itemsWithOverrides.filter(i => i.category_id === cat.id),
    }));

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            <div className="max-w-6xl mx-auto p-8 pt-24 space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">Cost Library</h1>
                    <p className="text-slate-400 mt-1">
                        UK market benchmarks across {categories.length} trade categories.
                        Rates shown are market benchmarks — set your own rates to personalise your estimates.
                    </p>
                </div>
                <LibraryPageClient categoriesWithItems={itemsByCategory} />
            </div>
        </div>
    );
}
