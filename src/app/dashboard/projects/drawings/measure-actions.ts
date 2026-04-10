"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function saveMeasurementsAction(data: {
  projectId: string;
  drawingName: string;
  scalePxPerM: number | null;
  measurements: {
    type: string;
    label: string;
    value: number;
    unit: string;
    tradeSection: string;
    points: { x: number; y: number }[];
  }[];
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorised" };

  const rows = data.measurements.map(m => ({
    user_id:          user.id,
    project_id:       data.projectId,
    drawing_name:     data.drawingName,
    measurement_type: m.type,
    label:            m.label || "",
    value:            m.value,
    unit:             m.unit,
    trade_section:    m.tradeSection || null,
    scale_px_per_m:   data.scalePxPerM,
    point_data:       m.points,
  }));

  const { error } = await supabase.from("drawing_measurements").insert(rows);
  if (error) return { error: error.message };

  revalidatePath(`/dashboard/projects/drawings`);
  return { success: true };
}

export async function addMeasurementsToEstimateAction(
  projectId: string,
  items: {
    label: string;
    value: number;
    unit: string;
    tradeSection: string;
  }[]
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorised", added: 0 };

  // Get active estimate for project
  const { data: estimates } = await supabase
    .from("estimates")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (!estimates || estimates.length === 0) {
    return { error: "No estimate found for this project. Create an estimate first.", added: 0 };
  }

  const estimateId = estimates[0].id;

  // Get existing line count for sort_order
  const { count } = await supabase
    .from("estimate_lines")
    .select("id", { count: "exact", head: true })
    .eq("estimate_id", estimateId);

  const baseOrder = count ?? 0;

  // Build estimate lines
  const lines = items.map((item, i) => ({
    estimate_id:   estimateId,
    user_id:       user.id,
    project_id:    projectId,
    trade_section: item.tradeSection,
    description:   item.label,
    quantity:      item.value,
    unit:          item.unit,
    sort_order:    baseOrder + i,
  }));

  const { error, data: inserted } = await supabase
    .from("estimate_lines")
    .insert(lines)
    .select("id");

  if (error) return { error: error.message, added: 0 };

  revalidatePath(`/dashboard/projects/costs`);
  return { success: true, added: inserted?.length ?? items.length };
}

export async function getDrawingMeasurementsAction(projectId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorised", measurements: [] };

  const { data, error } = await supabase
    .from("drawing_measurements")
    .select("id, drawing_name, measurement_type, label, value, unit, trade_section, created_at")
    .eq("user_id", user.id)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message, measurements: [] };
  return { success: true, measurements: data ?? [] };
}

export async function deleteMeasurementAction(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorised" };

  const { error } = await supabase
    .from("drawing_measurements")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  return { success: true };
}
