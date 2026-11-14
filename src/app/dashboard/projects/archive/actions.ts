"use server";

import { requireAuth } from "@/lib/supabase/extended-module-auth-utils";
import { revalidatePath } from "next/cache";
// Snapshot figures (canonical contract sum, truthful null for anything that
// could not be measured) are built in a pure module so they can be tested.
import { buildArchiveSnapshotFigures } from "./archive-snapshot";

export async function archiveProjectAction(
  projectId: string,
  reason: string
): Promise<{ error?: string }> {
  const { user, supabase } = await requireAuth();

  // Gather snapshot data in parallel. Each related read keeps its error: a
  // failed read is "unavailable" in the snapshot, not a total of zero.
  const [
    { data: project },
    expenses,
    invoices,
    variations,
    finalAccount,
    estimate,
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
    // Stage 5 review patch (19 Apr 2026): pull estimate_lines so the canonical
    // helper can split direct cost from Preliminaries. estimates.total_cost
    // already sums all line totals including Prelims, so the empty-lines
    // fallback path double-counts prelims and writes an inflated
    // contract_value into archive_snapshots.
    supabase
      .from("estimates")
      .select("total_cost, overhead_pct, profit_pct, risk_pct, prelims_pct, discount_pct, estimate_lines(trade_section, line_total)")
      .eq("project_id", projectId)
      .eq("is_active", true)
      .maybeSingle(),
  ]);

  if (!project) return { error: "Project not found" };

  // archive_snapshots.contract_value is the permanent record of a project's
  // close-out value, so it comes from the canonical contract sum (Stage 5
  // hardening) and is null — not 0 — when there is no readable active estimate.
  const figures = buildArchiveSnapshotFigures({
    programmePhases: project.programme_phases,
    expenses,
    invoices,
    variations,
    finalAccount,
    estimate,
  });

  // Write snapshot
  const { error: snapError } = await supabase.from("archive_snapshots").insert({
    project_id: projectId,
    user_id: user.id,
    ...figures,
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
  const { user, supabase } = await requireAuth();

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
  const { user, supabase } = await requireAuth();

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
