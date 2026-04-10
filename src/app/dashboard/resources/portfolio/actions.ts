"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ── Allocations ───────────────────────────────────────────────────────────────

export async function upsertAllocationAction(data: {
  id?: string;
  project_id: string;
  staff_resource_id?: string | null;
  role_placeholder?: string;
  trade_section?: string;
  phase_name?: string;
  start_date: string;
  end_date: string;
  days_allocated: number;
  days_per_week?: number;
  is_confirmed?: boolean;
  notes?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorised" };

  const payload = {
    user_id:           user.id,
    project_id:        data.project_id,
    staff_resource_id: data.staff_resource_id || null,
    role_placeholder:  data.role_placeholder || null,
    trade_section:     data.trade_section || null,
    phase_name:        data.phase_name || null,
    start_date:        data.start_date,
    end_date:          data.end_date,
    days_allocated:    data.days_allocated,
    days_per_week:     data.days_per_week ?? 5,
    is_confirmed:      data.is_confirmed ?? true,
    notes:             data.notes || null,
    updated_at:        new Date().toISOString(),
  };

  if (data.id) {
    const { error } = await supabase
      .from("resource_allocations")
      .update(payload)
      .eq("id", data.id)
      .eq("user_id", user.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("resource_allocations")
      .insert(payload);
    if (error) return { error: error.message };
  }

  revalidatePath("/dashboard/resources/portfolio");
  return { success: true };
}

export async function deleteAllocationAction(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorised" };

  const { error } = await supabase
    .from("resource_allocations")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/resources/portfolio");
  return { success: true };
}

// ── Absences ──────────────────────────────────────────────────────────────────

export async function upsertAbsenceAction(data: {
  id?: string;
  staff_resource_id: string;
  absence_type: string;
  start_date: string;
  end_date: string;
  notes?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorised" };

  const payload = {
    user_id:           user.id,
    staff_resource_id: data.staff_resource_id,
    absence_type:      data.absence_type,
    start_date:        data.start_date,
    end_date:          data.end_date,
    notes:             data.notes || null,
  };

  if (data.id) {
    const { error } = await supabase
      .from("staff_absence")
      .update(payload)
      .eq("id", data.id)
      .eq("user_id", user.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("staff_absence")
      .insert(payload);
    if (error) return { error: error.message };
  }

  revalidatePath("/dashboard/resources/portfolio");
  return { success: true };
}

export async function deleteAbsenceAction(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorised" };

  const { error } = await supabase
    .from("staff_absence")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/resources/portfolio");
  return { success: true };
}

// ── Update staff_type ─────────────────────────────────────────────────────────

export async function updateStaffTypeAction(staffId: string, staffType: "direct_labour" | "overhead") {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorised" };

  const { error } = await supabase
    .from("staff_resources")
    .update({ staff_type: staffType })
    .eq("id", staffId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/resources/portfolio");
  return { success: true };
}
