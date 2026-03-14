import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId } from "@/lib/supabase/auth-utils";
import LibraryTable from "../library-table";

export const dynamic = "force-dynamic";

export default async function LaborPage() {
    const supabase = createClient();
    const orgId = await getActiveOrganizationId();

    // Fetch Organization's Labour from MoM
    const { data } = await supabase
        .from("mom_items")
        .select("*, category:mom_categories!category_id(*)")
        .eq("organization_id", orgId)
        .order("description", { ascending: true });

    // Filter for Labour (Case-insensitive match or code prefix)
    const laborOnly = data?.filter(r => 
        r.category?.name?.toLowerCase().includes('labour') || 
        r.code?.toLowerCase().startsWith('lab')
    ) || [];

    return (
        <div className="max-w-4xl mx-auto p-8 pt-24 text-black">
            <h1 className="text-3xl font-bold mb-2 text-slate-900 uppercase italic">Labour Rates</h1>
            <p className="text-slate-500 mb-8 font-bold uppercase text-[10px]">Team Organization Master Rates</p>
            <LibraryTable data={laborOnly} type="Labour" />
        </div>
    );
}
