import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProjectPicker from "@/components/project-picker";
import ContractAdminClient from "./contract-admin-client";

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

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, client_name, project_type, start_date, end_date, potential_value")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
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
    { data: scheduleItems },
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

    supabase
      .from("projects")
      .select("id, name, client_name, project_type, start_date, end_date, potential_value")
      .eq("id", projectId)
      .single(),

    supabase
      .from("variations")
      .select("id, description, status, amount, created_at")
      .eq("project_id", projectId),

    supabase
      .from("schedule_items")
      .select("id, name, start_date, end_date, progress")
      .eq("project_id", projectId)
      .order("start_date", { ascending: true })
      .limit(30),

    supabase
      .from("project_expenses")
      .select("id, category, amount, date")
      .eq("project_id", projectId)
      .eq("status", "actual"),
  ]);

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
      scheduleItems={scheduleItems ?? []}
      expenses={expenses ?? []}
    />
  );
}
