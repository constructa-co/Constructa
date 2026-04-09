import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import MaterialsClient from "./materials-client";

export const dynamic = "force-dynamic";

export default async function MaterialsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  // Fetch all material prices — read-only reference data
  const { data: materials } = await admin
    .from("material_prices")
    .select("id, trade_category, material, description, unit, region, price_low, price_mid, price_high, supplier_note, source_date")
    .order("trade_category")
    .order("material");

  // Distinct trade categories and regions for filters
  const categories = Array.from(new Set((materials ?? []).map(m => m.trade_category))).sort();
  const regions    = Array.from(new Set((materials ?? []).map(m => m.region))).sort();

  return (
    <MaterialsClient
      materials={materials ?? []}
      categories={categories}
      regions={regions}
    />
  );
}
