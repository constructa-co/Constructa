"use server";

import { requireAuth } from "@/lib/supabase/auth-utils";
import { revalidatePath } from "next/cache";

// ─── Site Photos ──────────────────────────────────────────────────────────────

export async function uploadSitePhotoAction(data: {
  projectId: string;
  storagePath: string;
  caption?: string;
  takenAt?: string;
  weekEnding?: string;
}) {
  const { user, supabase } = await requireAuth();

  const { error } = await supabase.from("site_photos").insert({
    user_id:      user.id,
    project_id:   data.projectId,
    storage_path: data.storagePath,
    caption:      data.caption ?? null,
    taken_at:     data.takenAt ?? null,
    week_ending:  data.weekEnding ?? null,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/reporting");
  return { success: true };
}

export async function deleteSitePhotoAction(id: string) {
  const { user, supabase } = await requireAuth();

  const { data: photo } = await supabase
    .from("site_photos")
    .select("storage_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!photo) return { error: "Not found" };

  // Remove from storage
  await supabase.storage.from("site-photos").remove([photo.storage_path]);

  const { error } = await supabase
    .from("site_photos")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/reporting");
  return { success: true };
}

// ─── Progress Reports ─────────────────────────────────────────────────────────

export async function upsertProgressReportAction(data: {
  id?: string;
  projectId: string;
  reportType?: string;
  weekEnding: string;
  overallProgress?: number;
  workCompleted?: string;
  workPlanned?: string;
  issuesRisks?: string;
  instructionsReceived?: string;
  weatherDaysLost?: number;
  labourHeadcount?: number;
}) {
  const { user, supabase } = await requireAuth();

  const row = {
    user_id:               user.id,
    project_id:            data.projectId,
    report_type:           data.reportType ?? "weekly",
    week_ending:           data.weekEnding,
    overall_progress:      data.overallProgress ?? null,
    work_completed:        data.workCompleted ?? null,
    work_planned:          data.workPlanned ?? null,
    issues_risks:          data.issuesRisks ?? null,
    instructions_received: data.instructionsReceived ?? null,
    weather_days_lost:     data.weatherDaysLost ?? 0,
    labour_headcount:      data.labourHeadcount ?? 0,
    updated_at:            new Date().toISOString(),
  };

  let result;
  if (data.id) {
    result = await supabase
      .from("progress_reports")
      .update(row)
      .eq("id", data.id)
      .eq("user_id", user.id)
      .select("id")
      .single();
  } else {
    result = await supabase
      .from("progress_reports")
      .insert(row)
      .select("id")
      .single();
  }

  if (result.error) return { error: result.error.message };
  revalidatePath("/dashboard/reporting");
  return { success: true, id: result.data?.id };
}

export async function deleteProgressReportAction(id: string) {
  const { user, supabase } = await requireAuth();

  const { error } = await supabase
    .from("progress_reports")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/reporting");
  return { success: true };
}
