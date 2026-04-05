"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface StaffResourceInput {
  id?: string;
  name: string;
  role?: string | null;
  annual_salary: number;
  employer_ni_pct: number;
  employer_pension_pct: number;
  company_car_annual: number;
  it_costs_annual: number;
  life_insurance_annual: number;
  other_benefits_annual: number;
  annual_working_days: number;
  holiday_days: number;
  public_holiday_days: number;
  overhead_absorption_pct: number;
  profit_uplift_pct: number;
  notes?: string | null;
  is_active?: boolean;
}

export async function upsertStaffResourceAction(
  data: StaffResourceInput
): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;
  if (!user) return { error: "Not authenticated" };

  const payload = {
    user_id: user.id,
    name: data.name,
    role: data.role ?? null,
    annual_salary: data.annual_salary,
    employer_ni_pct: data.employer_ni_pct,
    employer_pension_pct: data.employer_pension_pct,
    company_car_annual: data.company_car_annual,
    it_costs_annual: data.it_costs_annual,
    life_insurance_annual: data.life_insurance_annual,
    other_benefits_annual: data.other_benefits_annual,
    annual_working_days: data.annual_working_days,
    holiday_days: data.holiday_days,
    public_holiday_days: data.public_holiday_days,
    overhead_absorption_pct: data.overhead_absorption_pct,
    profit_uplift_pct: data.profit_uplift_pct,
    notes: data.notes ?? null,
    is_active: data.is_active ?? true,
  };

  let error: { message: string } | null = null;

  if (data.id) {
    const result = await supabase
      .from("staff_resources")
      .update(payload)
      .eq("id", data.id)
      .eq("user_id", user.id);
    error = result.error;
  } else {
    const result = await supabase.from("staff_resources").insert(payload);
    error = result.error;
  }

  if (error) return { error: error.message };

  revalidatePath("/dashboard/resources/staff");
  return {};
}

export async function deleteStaffResourceAction(id: string): Promise<void> {
  const supabase = createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;
  if (!user) return;

  await supabase
    .from("staff_resources")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  revalidatePath("/dashboard/resources/staff");
}
