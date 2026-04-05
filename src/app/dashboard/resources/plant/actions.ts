"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface PlantResourceInput {
  id?: string;
  name: string;
  category: "heavy_plant" | "light_plant" | "lifting" | "temp_works" | "light_tools" | "specialist_tools" | "other";
  description?: string | null;
  // Rate mode
  rate_mode: string;               // 'simple' | 'full'
  daily_chargeout_rate: number;    // used in simple mode
  // Full buildup fields
  purchase_price: number;
  depreciation_years: number;
  residual_value: number;
  finance_cost_annual: number;
  maintenance_annual: number;
  insurance_annual: number;
  other_annual_costs: number;
  utilisation_months: number;
  working_days_per_month: number;
  profit_uplift_pct: number;
  notes?: string | null;
  is_active?: boolean;
}

export async function upsertPlantResourceAction(
  data: PlantResourceInput
): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;
  if (!user) return { error: "Not authenticated" };

  const payload = {
    user_id: user.id,
    name: data.name,
    category: data.category,
    description: data.description ?? null,
    rate_mode: data.rate_mode,
    daily_chargeout_rate: data.daily_chargeout_rate,
    purchase_price: data.purchase_price,
    depreciation_years: data.depreciation_years,
    residual_value: data.residual_value,
    finance_cost_annual: data.finance_cost_annual,
    maintenance_annual: data.maintenance_annual,
    insurance_annual: data.insurance_annual,
    other_annual_costs: data.other_annual_costs,
    utilisation_months: data.utilisation_months,
    working_days_per_month: data.working_days_per_month,
    profit_uplift_pct: data.profit_uplift_pct,
    notes: data.notes ?? null,
    is_active: data.is_active ?? true,
  };

  let error: { message: string } | null = null;

  if (data.id) {
    const result = await supabase
      .from("plant_resources")
      .update(payload)
      .eq("id", data.id)
      .eq("user_id", user.id);
    error = result.error;
  } else {
    const result = await supabase.from("plant_resources").insert(payload);
    error = result.error;
  }

  if (error) return { error: error.message };

  revalidatePath("/dashboard/resources/plant");
  return {};
}

export async function deletePlantResourceAction(id: string): Promise<void> {
  const supabase = createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;
  if (!user) return;

  await supabase
    .from("plant_resources")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  revalidatePath("/dashboard/resources/plant");
}
