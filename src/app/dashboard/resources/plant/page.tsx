import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PlantResourcesClient from "./plant-client";

export const dynamic = "force-dynamic";

export default async function PlantResourcesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data } = await supabase
    .from("plant_resources")
    .select("*")
    .eq("user_id", user.id)
    .order("name", { ascending: true });

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-100">Plant &amp; Equipment Register</h1>
          <p className="text-slate-500 text-sm mt-1">
            Track owned assets — depreciation, running costs and daily chargeout rates
          </p>
        </div>

        <PlantResourcesClient plant={data ?? []} />
      </div>
    </div>
  );
}
