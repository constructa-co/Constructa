import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProjectPicker from "@/components/project-picker";
import ContractAdminClient from "./contract-admin-client";
import { computeContractSum } from "@/lib/financial";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function ContractAdminPage({
  searchParams,
}: {
  searchParams: { projectId?: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { projectId } = searchParams;

  // projects table has no updated_at or end_date columns — ordering/selecting either
  // silently nulls the whole query. Use created_at and omit end_date.
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, client_name, project_type, start_date, potential_value")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (!projectId) {
    return (
      <ProjectPicker
        projects={projects ?? []}
        targetPath="/dashboard/projects/contract-admin"
        title="Contract Administration"
        description="Select a project to manage contractual obligations, events, communications and claims"
      />
    );
  }

  const [
    { data: contractSettings },
    { data: obligations },
    { data: events },
    { data: communications },
    { data: claimsList },
    { data: project },
    { data: variations },
    { data: expenses },
  ] = await Promise.all([
    supabase
      .from("contract_settings")
      .select("*")
      .eq("project_id", projectId)
      .single(),

    supabase
      .from("contract_obligations")
      .select("*")
      .eq("project_id", projectId)
      .order("due_date", { ascending: true }),

    supabase
      .from("contract_events")
      .select("*")
      .eq("project_id", projectId)
      .order("date_raised", { ascending: false }),

    supabase
      .from("contract_communications")
      .select("*")
      .eq("project_id", projectId)
      .order("comm_date", { ascending: false }),

    supabase
      .from("claims")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),

    // Stage 2 hardening (19 Apr 2026): added programme_phases to the project
    // select so the AI drafting context can read it directly instead of going
    // to a schedule_items table that does not exist in any migration.
    supabase
      .from("projects")
      .select("id, name, client_name, project_type, start_date, potential_value, programme_phases")
      .eq("id", projectId)
      .single(),

    supabase
      .from("variations")
      .select("id, description, status, amount, created_at")
      .eq("project_id", projectId),

    // Stage 2 hardening (19 Apr 2026): removed schedule_items query — that
    // table does not exist in any migration. Expense column names aligned to
    // the live project_expenses schema (category → cost_type, date →
    // expense_date, status → cost_status). Filter stays "actual" so only
    // incurred costs feed the AI drafting context.
    supabase
      .from("project_expenses")
      .select("id, cost_type, trade_section, amount, expense_date")
      .eq("project_id", projectId)
      .eq("cost_status", "actual"),
  ]);

  // P1-5 — canonical contract sum for Contract Admin pre-fill.
  // Previously the setup form pre-filled contract_value from
  // project.potential_value (the lead-stage rough number) which for
  // 22 Birchwood was £85,000 even though the priced estimate was
  // £1,753.29. Contract Admin seeds time-bar math and obligation
  // schedules from this value — getting it wrong silently corrupts
  // everything downstream.
  const { data: activeEstimate } = await supabase
    .from("estimates")
    .select("id, total_cost, prelims_pct, overhead_pct, profit_pct, risk_pct, discount_pct, estimate_lines(trade_section, line_total)")
    .eq("project_id", projectId)
    .eq("is_active", true)
    .maybeSingle();

  const canonicalContractSum = activeEstimate
    ? computeContractSum(activeEstimate, (activeEstimate as any).estimate_lines ?? []).contractSum
    : 0;

  // Stage 2 hardening (19 Apr 2026): derive programme dates for the AI
  // drafting context from the project's live programme_phases JSON instead of
  // the dead schedule_items table. programme_phases carries
  // {name, duration, unit, startOffset, manhours}. We translate startOffset
  // into a real planned calendar date using project.start_date — this is
  // genuine derived data, not a placeholder. "actual" completion dates are
  // left undefined because the platform does not record them at phase level.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const phases = (project as any)?.programme_phases ?? [];
  const startIso = (project as any)?.start_date as string | null | undefined;
  const programmeDates: { id: string; task: string; planned: string; actual?: string }[] =
    Array.isArray(phases)
      ? phases.map((p: any, idx: number) => {
          const offsetDays =
            p?.unit === "weeks" ? (p?.startOffset ?? 0) * 7 : (p?.startOffset ?? 0);
          const planned =
            startIso
              ? new Date(new Date(startIso).getTime() + offsetDays * 86_400_000)
                  .toISOString()
                  .slice(0, 10)
              : "";
          return {
            id: `phase-${idx}`,
            task: String(p?.name ?? `Phase ${idx + 1}`),
            planned,
            actual: undefined,
          };
        })
      : [];

  return (
    <ContractAdminClient
      projectId={projectId}
      project={project}
      projects={projects ?? []}
      contractSettings={contractSettings ?? null}
      obligations={obligations ?? []}
      events={events ?? []}
      communications={communications ?? []}
      claims={claimsList ?? []}
      variations={variations ?? []}
      programmeDates={programmeDates}
      expenses={expenses ?? []}
      canonicalContractSum={canonicalContractSum}
    />
  );
}
