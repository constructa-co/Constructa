import { createClient } from "@/lib/supabase/server";
import LibraryTable from "../library-table";

export const dynamic = "force-dynamic";

export default async function LaborPage() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Fetch Labour Items
    const { data } = await supabase
        .from("cost_library")
        .select("*")
        .eq("user_id", user?.id)
        .eq("resource_type", "Labour")
        .order("name", { ascending: true });

    return (
        <div className="max-w-4xl mx-auto p-8 pt-24">
            <h1 className="text-3xl font-bold mb-2 text-slate-900">Labour Rates</h1>
            <p className="text-slate-500 mb-8">Manage your standard hourly/daily rates for your team.</p>
            <LibraryTable data={data || []} type="Labour" />
        </div>
    );
}
