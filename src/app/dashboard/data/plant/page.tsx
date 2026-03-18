import { createClient } from "@/lib/supabase/server";
import LibraryTable from "../library-table";

export const dynamic = "force-dynamic";

export default async function PlantPage() {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;

    // Fetch ONLY Plant Items
    const { data } = await supabase
        .from("cost_library")
        .select("*")
        .eq("user_id", user?.id)
        .eq("resource_type", "Plant")
        .order("name", { ascending: true });

    return (
        <div className="max-w-4xl mx-auto p-8 pt-24">
            <h1 className="text-3xl font-bold mb-2 text-slate-900">Plant & Machinery</h1>
            <p className="text-slate-500 mb-8">Manage hire rates for excavators, dumpers, and tools.</p>
            <LibraryTable data={data || []} type="Plant" />
        </div>
    );
}
