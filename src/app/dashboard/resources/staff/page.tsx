import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import StaffResourcesClient from "./staff-client";

export const dynamic = "force-dynamic";

export default async function StaffResourcesPage() {
  const supabase = createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("staff_resources")
    .select("*")
    .eq("user_id", user.id)
    .order("name", { ascending: true });

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 min-h-screen">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
          Labour Resource Catalogue
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Build your team cost profiles — salary, on-costs and chargeout rates
        </p>
      </div>
      <StaffResourcesClient staff={data ?? []} />
    </div>
  );
}
