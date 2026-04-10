import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PortfolioClient from "./portfolio-client";

export const dynamic = "force-dynamic";

export default async function ResourcePortfolioPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // All projects (all statuses that have a programme) — sorted by start date
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, client_name, status, start_date, programme_phases")
    .eq("user_id", user.id)
    .not("start_date", "is", null)
    .not("status", "eq", "lost")
    .order("start_date", { ascending: true });

  // All active staff resources
  const { data: staff } = await supabase
    .from("staff_resources")
    .select("id, name, job_title, role, staff_type, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("name");

  // Resource allocations with project + staff info
  const { data: allocations } = await supabase
    .from("resource_allocations")
    .select("id, project_id, staff_resource_id, role_placeholder, trade_section, phase_name, start_date, end_date, days_allocated, days_per_week, is_confirmed, notes")
    .eq("user_id", user.id)
    .order("start_date");

  // Staff absences
  const { data: absences } = await supabase
    .from("staff_absence")
    .select("id, staff_resource_id, absence_type, start_date, end_date, notes")
    .eq("user_id", user.id)
    .gte("end_date", new Date().toISOString().split("T")[0])
    .order("start_date");

  // Labour demand: estimate line components (manhours by trade per project)
  // Get latest estimate per project that has lines
  const { data: estimates } = await supabase
    .from("estimates")
    .select(`
      id,
      project_id,
      estimate_lines (
        trade_section,
        estimate_line_components (
          component_type,
          total_manhours
        )
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Aggregate labour manhours by project + trade_section
  // Use only the most recent estimate per project
  const labourByProject = new Map<string, Map<string, number>>();
  const seenProjects = new Set<string>();

  for (const est of estimates ?? []) {
    if (seenProjects.has(est.project_id)) continue;
    seenProjects.add(est.project_id);
    const byTrade = new Map<string, number>();
    for (const line of (est.estimate_lines as any[]) ?? []) {
      const components = (line.estimate_line_components as any[]) ?? [];
      const labourHours = components
        .filter((c: any) => c.component_type === "labour")
        .reduce((sum: number, c: any) => sum + (c.total_manhours ?? 0), 0);
      if (labourHours > 0) {
        byTrade.set(line.trade_section, (byTrade.get(line.trade_section) ?? 0) + labourHours);
      }
    }
    if (byTrade.size > 0) labourByProject.set(est.project_id, byTrade);
  }

  // Convert Maps to serialisable arrays
  const labourDemand = Array.from(labourByProject.entries()).map(([projectId, trades]) => ({
    project_id: projectId,
    by_trade: Array.from(trades.entries()).map(([trade, hours]) => ({ trade, hours })),
  }));

  return (
    <PortfolioClient
      projects={projects ?? []}
      staff={staff ?? []}
      allocations={allocations ?? []}
      absences={absences ?? []}
      labourDemand={labourDemand}
    />
  );
}
