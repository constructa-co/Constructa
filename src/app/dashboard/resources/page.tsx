import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId } from "@/lib/supabase/auth-utils";
import ClientResources from "./client-page";

export const dynamic = "force-dynamic";

export default async function ResourcesPage() {
    const supabase = createClient();
    const orgId = await getActiveOrganizationId();

    // Fetch Organization's Resources from MoM
    const { data: resources } = await supabase
        .from("mom_items")
        .select("*, category:mom_categories!category_id(*)")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });

    // Heuristic filtering: Look for categories containing 'Labour' or 'Plant'
    const labour = resources?.filter(r => 
        r.category?.name?.toLowerCase().includes('labour') || 
        r.code?.toLowerCase().startsWith('lab')
    ) || [];
    
    const plant = resources?.filter(r => 
        r.category?.name?.toLowerCase().includes('plant') || 
        r.code?.toLowerCase().startsWith('pla')
    ) || [];

    return (
        <div className="max-w-5xl mx-auto p-8 space-y-8 pt-24 text-black">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 uppercase italic">Company Resources</h1>
            </div>
            <ClientResources labour={labour} plant={plant} />
        </div>
    );
}
