"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function archiveProjectAction(
  projectId: string,
  reason: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Gather snapshot data in parallel
  const [
    { data: project },
    { data: expenses },
    { data: invoices },
    { data: variations },
    { data: finalAccount },
    { data: estimate },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("*, programme_phases")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("project_expenses")
      .select("amount")
      .eq("project_id", projectId),
    supabase
      .from("invoices")
      .select("amount, status, net_due, retention_held")
      .eq("project_id", projectId),
    supabase
      .from("variations")
      .select("amount, status")
      .eq("project_id", projectId),
    supabase
      .from("final_accounts")
      .select("agreed_amount, status")
      .eq("project_id", projectId)
      .maybeSingle(),
    supabase
      .from("estimates")
      .select("total_cost, overhead_pct, profit_pct, risk_pct, prelims_pct, discount_pct")
      .eq("project_id", projectId)
      .eq("is_active", true)
      .maybeSingle(),
  ]);

  if (!project) return { error: "Project not found" };

  // Compute financial snapshot
  const totalCosts = (expenses ?? []).reduce((s, e) => s + (e.amount ?? 0), 0);
  const totalInvoiced = (invoices ?? []).reduce((s, i) => s + (i.amount ?? 0), 0);
  const totalPaid = (invoices ?? [])
    .filter((i) => i.status === "Paid")
    .reduce((s, i) => s + (i.amount ?? 0), 0);
  const retentionOutstanding = (invoices ?? []).reduce(
    (s, i) => s + (i.retention_held ?? 0),
    0
  );
  const approvedVarTotal = (variations ?? [])
    .filter((v) => v.status === "Approved")
    .reduce((s, v) => s + (v.amount ?? 0), 0);
  const varCount = (variations ?? []).length;

  // Contract value from active estimate
  let contractValue = 0;
  if (estimate) {
    const base = estimate.total_cost ?? 0;
    const prelims = base * ((estimate.prelims_pct ?? 0) / 100);
    const budget = base + prelims;
    const overhead = budget * ((estimate.overhead_pct ?? 0) / 100);
    const risk = (budget + overhead) * ((estimate.risk_pct ?? 0) / 100);
    const profit = (budget + overhead + risk) * ((estimate.profit_pct ?? 0) / 100);
    const discount = (budget + overhead + risk + profit) * ((estimate.discount_pct ?? 0) / 100);
    contractValue = budget + overhead + risk + profit - discount;
  }

  const grossMarginPct =
    contractValue > 0 ? ((contractValue - totalCosts) / contractValue) * 100 : 0;

  // Programme duration from phases JSONB
  let plannedDays = 0;
  let actualDays = 0;
  let delayDays = 0;
  const phases: Array<{
    startOffset?: number;
    manualDays?: number;
    calculatedDays?: number;
    actual_start_date?: string;
    actual_finish_date?: string;
  }> = project.programme_phases ?? [];

  if (phases.length > 0) {
    const lastPhase = phases.reduce(
      (max, p) => {
        const end = (p.startOffset ?? 0) + (p.manualDays ?? p.calculatedDays ?? 0);
        return end > max ? end : max;
      },
      0
    );
    plannedDays = lastPhase;

    const phasesWithActual = phases.filter(
      (p) => p.actual_start_date && p.actual_finish_date
    );
    if (phasesWithActual.length > 0) {
      const starts = phasesWithActual.map(
        (p) => new Date(p.actual_start_date!).getTime()
      );
      const ends = phasesWithActual.map(
        (p) => new Date(p.actual_finish_date!).getTime()
      );
      actualDays = Math.round(
        (Math.max(...ends) - Math.min(...starts)) / (1000 * 60 * 60 * 24)
      );
      delayDays = Math.max(0, actualDays - plannedDays);
    }
  }

  // Write snapshot
  const { error: snapError } = await supabase.from("archive_snapshots").insert({
    project_id: projectId,
    user_id: user.id,
    contract_value: contractValue,
    total_costs_posted: totalCosts,
    gross_margin_pct: grossMarginPct,
    total_invoiced: totalInvoiced,
    total_paid: totalPaid,
    retention_outstanding: retentionOutstanding,
    final_account_amount: finalAccount?.agreed_amount ?? null,
    final_account_status: finalAccount?.status ?? null,
    planned_duration_days: plannedDays,
    actual_duration_days: actualDays,
    programme_delay_days: delayDays,
    variation_count: varCount,
    approved_variation_total: approvedVarTotal,
    notes: reason || null,
    snapshot_date: new Date().toISOString(),
  });

  if (snapError) return { error: snapError.message };

  // Mark project archived
  const { error: archiveError } = await supabase
    .from("projects")
    .update({
      is_archived: true,
      archived_at: new Date().toISOString(),
      archived_by: user.id,
      archive_reason: reason || null,
      status: "completed",
    })
    .eq("id", projectId)
    .eq("user_id", user.id);

  if (archiveError) return { error: archiveError.message };

  revalidatePath("/dashboard/projects/archive");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/home");
  return {};
}

export async function restoreProjectAction(
  projectId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("projects")
    .update({
      is_archived: false,
      archived_at: null,
      archived_by: null,
      archive_reason: null,
    })
    .eq("id", projectId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/projects/archive");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/home");
  return {};
}

export async function getArchivedProjectsAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("projects")
    .select(`
      id, name, client_name, site_address, project_type,
      archived_at, archive_reason, start_date,
      archive_snapshots (
        contract_value, total_costs_posted, gross_margin_pct,
        total_invoiced, total_paid, retention_outstanding,
        final_account_amount, final_account_status,
        planned_duration_days, actual_duration_days, programme_delay_days,
        variation_count, approved_variation_total, snapshot_date
      )
    `)
    .eq("user_id", user.id)
    .eq("is_archived", true)
    .order("archived_at", { ascending: false });

  return data ?? [];
}
