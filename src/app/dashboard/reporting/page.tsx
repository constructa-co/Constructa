import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ReportingClient from "./reporting-client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function ReportingPage({
  searchParams,
}: {
  searchParams: { projectId?: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { projectId } = searchParams;

  // Fetch all projects for selectors
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, client_name, project_type, status, start_date, potential_value")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const projectIds = (projects ?? []).map((p: any) => p.id);

  const [
    { data: progressReports },
    { data: sitePhotos },
    { data: invoices },
    { data: variations },
    { data: estimates },
    { data: staffResources },
    { data: expenses },
  ] = await Promise.all([
    supabase
      .from("progress_reports")
      .select("*")
      .eq("user_id", user.id)
      .order("week_ending", { ascending: false })
      .limit(100),

    supabase
      .from("site_photos")
      .select("*")
      .eq("user_id", user.id)
      .order("uploaded_at", { ascending: false })
      .limit(200),

    // Stage 2 hardening (19 Apr 2026): column names aligned to live schema.
    // Was selecting amount_due/date_issued/date_paid — none of those exist on
    // the invoices table. Using amount + net_due (billing writes net_due for
    // AfP valuations), created_at for issued date, due_date + paid_date.
    projectIds.length > 0
      ? supabase
          .from("invoices")
          .select("id, project_id, invoice_number, status, amount, net_due, due_date, paid_date, created_at")
          .in("project_id", projectIds)
          .order("created_at", { ascending: false })
      : { data: [] },

    projectIds.length > 0
      ? supabase
          .from("variations")
          .select("id, project_id, description, status, amount, created_at")
          .in("project_id", projectIds)
      : { data: [] },

    // Stage 5 hardening (19 Apr 2026): added prelims_pct + estimate_lines so
    // reporting-client can use the canonical computeContractSumValue helper
    // instead of two hand-rolled compound functions that were missing the
    // prelims summand. Figures now align with billing / proposal /
    // final-account / management-accounts.
    projectIds.length > 0
      ? supabase
          .from("estimates")
          .select("id, project_id, total_cost, is_active, prelims_pct, overhead_pct, risk_pct, profit_pct, discount_pct, estimate_lines(trade_section, line_total)")
          .in("project_id", projectIds)
      : { data: [] },

    // Stage 2 hardening (19 Apr 2026): previously queried staff_resources with
    // project_id/days_allocated — both columns do not exist on staff_resources.
    // Per-project allocations live on resource_allocations (Sprint 51). Query
    // that instead and flatten the staff embed into the existing shape the
    // client expects.
    projectIds.length > 0
      ? supabase
          .from("resource_allocations")
          .select(
            "id, project_id, days_allocated, role_placeholder, " +
              "staff_resources(name, role, day_rate, staff_type)"
          )
          .in("project_id", projectIds)
      : { data: [] },

    // Stage 2 hardening (19 Apr 2026): swapped category/date/status → cost_type/
    // expense_date/cost_status to match live schema. The status filter stays as
    // "actual" to exclude committed-but-not-incurred costs, but on the live
    // column cost_status.
    projectIds.length > 0
      ? supabase
          .from("project_expenses")
          .select("id, project_id, cost_type, trade_section, amount, expense_date, cost_status")
          .in("project_id", projectIds)
          .eq("cost_status", "actual")
      : { data: [] },
  ]);

  // Flatten the resource_allocations embed into the flat StaffResource shape
  // the client already consumes. role_placeholder is used as role fallback
  // when no named staff record is linked (e.g. bid-stage allocations).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const staffRows = (staffResources ?? []).map((r: any) => {
    const staff = Array.isArray(r.staff_resources) ? r.staff_resources[0] : r.staff_resources;
    return {
      id: r.id,
      project_id: r.project_id,
      name: staff?.name ?? r.role_placeholder ?? "Unnamed",
      role: staff?.role ?? r.role_placeholder ?? null,
      days_allocated: r.days_allocated ?? 0,
      day_rate: staff?.day_rate ?? null,
      staff_type: staff?.staff_type ?? null,
    };
  });

  return (
    <ReportingClient
      initialProjectId={projectId ?? null}
      projects={projects ?? []}
      progressReports={progressReports ?? []}
      sitePhotos={sitePhotos ?? []}
      invoices={invoices ?? []}
      variations={variations ?? []}
      estimates={estimates ?? []}
      staffResources={staffRows}
      expenses={expenses ?? []}
    />
  );
}
