import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import IntelligenceClient from "./intelligence-client";

export const dynamic = "force-dynamic";

export default async function IntelligencePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  // ── Fetch this contractor's closed/live project data ──────────────────────
  const { data: projects } = await supabase
    .from("projects")
    .select("id, project_type, contract_value, status")
    .in("status", ["active", "completed", "closed"]);

  const projectIds = (projects ?? []).map(p => p.id);

  // Gross margin data from P&L
  const { data: plRows } = projectIds.length > 0
    ? await supabase
        .from("project_pl_snapshots")
        .select("project_id, gross_margin_pct")
        .in("project_id", projectIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  // Variation data
  const { data: varRows } = projectIds.length > 0
    ? await supabase
        .from("variations")
        .select("project_id, value, status")
        .in("project_id", projectIds)
    : { data: [] };

  // Programme data
  const { data: schedRows } = projectIds.length > 0
    ? await supabase
        .from("project_schedules")
        .select("project_id, planned_end_date, actual_end_date")
        .in("project_id", projectIds)
        .not("actual_end_date", "is", null)
    : { data: [] };

  // ── Fetch industry benchmarks ─────────────────────────────────────────────
  const { data: benchmarks } = await admin
    .from("project_benchmarks")
    .select(
      "project_type, contract_value_band, gross_margin_pct, variation_rate_pct, programme_delay_days"
    );

  // ── Profile: consent ──────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from("profiles")
    .select("data_consent")
    .eq("id", user.id)
    .single();

  return (
    <IntelligenceClient
      projects={projects ?? []}
      plRows={plRows ?? []}
      varRows={varRows ?? []}
      schedRows={schedRows ?? []}
      benchmarks={benchmarks ?? []}
      hasConsent={profile?.data_consent ?? false}
    />
  );
}
