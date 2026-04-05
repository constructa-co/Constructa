"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface StaffResourceInput {
  id?: string;
  // Profile
  title?: string;
  first_name?: string | null;
  last_name?: string | null;
  name: string;                     // derived: "Title FirstName LastName"
  job_title?: string | null;
  role?: string | null;             // legacy alias for job_title
  // Rate mode
  rate_mode: string;                // 'simple' | 'full'
  // Simple mode
  hourly_chargeout_rate: number;
  overtime_chargeout_rate: number;
  // Full buildup
  annual_salary: number;
  employer_ni_pct: number;
  employer_pension_pct: number;
  company_car_annual: number;
  car_allowance_annual: number;
  mobile_phone_annual: number;
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
    title: data.title ?? "Mr",
    first_name: data.first_name ?? null,
    last_name: data.last_name ?? null,
    name: data.name,
    job_title: data.job_title ?? null,
    role: data.job_title ?? data.role ?? null,
    rate_mode: data.rate_mode,
    hourly_chargeout_rate: data.hourly_chargeout_rate,
    overtime_chargeout_rate: data.overtime_chargeout_rate,
    annual_salary: data.annual_salary,
    employer_ni_pct: data.employer_ni_pct,
    employer_pension_pct: data.employer_pension_pct,
    company_car_annual: data.company_car_annual,
    car_allowance_annual: data.car_allowance_annual,
    mobile_phone_annual: data.mobile_phone_annual,
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
    updated_at: new Date().toISOString(),
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
