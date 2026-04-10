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

    projectIds.length > 0
      ? supabase
          .from("invoices")
          .select("id, project_id, invoice_number, status, amount_due, date_issued, date_paid")
          .in("project_id", projectIds)
          .order("date_issued", { ascending: false })
      : { data: [] },

    projectIds.length > 0
      ? supabase
          .from("variations")
          .select("id, project_id, description, status, amount, created_at")
          .in("project_id", projectIds)
      : { data: [] },

    projectIds.length > 0
      ? supabase
          .from("estimates")
          .select("id, project_id, total_cost, is_active, overhead_pct, risk_pct, profit_pct, discount_pct")
          .in("project_id", projectIds)
      : { data: [] },

    projectIds.length > 0
      ? supabase
          .from("staff_resources")
          .select("id, project_id, name, role, days_allocated, day_rate, staff_type")
          .in("project_id", projectIds)
      : { data: [] },

    projectIds.length > 0
      ? supabase
          .from("project_expenses")
          .select("id, project_id, category, amount, date, status")
          .in("project_id", projectIds)
          .eq("status", "actual")
      : { data: [] },
  ]);

  return (
    <ReportingClient
      initialProjectId={projectId ?? null}
      projects={projects ?? []}
      progressReports={progressReports ?? []}
      sitePhotos={sitePhotos ?? []}
      invoices={invoices ?? []}
      variations={variations ?? []}
      estimates={estimates ?? []}
      staffResources={staffResources ?? []}
      expenses={expenses ?? []}
    />
  );
}
