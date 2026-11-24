import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect, unstable_rethrow } from "next/navigation";
import PortfolioClient from "./portfolio-client";

export const dynamic = "force-dynamic";

const RESOURCE_PORTFOLIO_UNAVAILABLE =
  "Your resource portfolio could not be loaded. Reload this page to try again before planning allocations.";

function ResourcePortfolioUnavailable() {
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-6 max-w-xl" role="alert">
      <p className="text-sm text-red-200">{RESOURCE_PORTFOLIO_UNAVAILABLE}</p>
      <Link
        href="/dashboard/resources/portfolio"
        className="inline-block mt-4 text-sm font-medium text-red-100 underline underline-offset-2 hover:text-white"
      >
        Reload resource portfolio
      </Link>
    </div>
  );
}

export default async function ResourcePortfolioPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let loaded: Awaited<ReturnType<typeof loadPortfolioData>> | undefined;

  try {
    loaded = await loadPortfolioData(supabase, user.id);
  } catch (error) {
    unstable_rethrow(error);
    return <ResourcePortfolioUnavailable />;
  }

  if (loaded.loadFailed) {
    return <ResourcePortfolioUnavailable />;
  }

  return (
    <PortfolioClient
      projects={loaded.projects}
      staff={loaded.staff}
      allocations={loaded.allocations}
      absences={loaded.absences}
      labourDemand={loaded.labourDemand}
    />
  );
}

async function loadPortfolioData(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("id, name, client_name, status, start_date, programme_phases")
    .eq("user_id", userId)
    .not("start_date", "is", null)
    .not("status", "eq", "lost")
    .order("start_date", { ascending: true });

  const { data: staff, error: staffError } = await supabase
    .from("staff_resources")
    .select("id, name, job_title, role, staff_type, is_active")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("name");

  const { data: allocations, error: allocationsError } = await supabase
    .from("resource_allocations")
    .select("id, project_id, staff_resource_id, role_placeholder, trade_section, phase_name, start_date, end_date, days_allocated, days_per_week, is_confirmed, notes")
    .eq("user_id", userId)
    .order("start_date");

  const { data: absences, error: absencesError } = await supabase
    .from("staff_absence")
    .select("id, staff_resource_id, absence_type, start_date, end_date, notes")
    .eq("user_id", userId)
    .gte("end_date", new Date().toISOString().split("T")[0])
    .order("start_date");

  const { data: estimates, error: estimatesError } = await supabase
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
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const readFailed = Boolean(
    projectsError || staffError || allocationsError || absencesError || estimatesError,
  );

  if (readFailed) {
    return {
      projects: [] as never[],
      staff: [] as never[],
      allocations: [] as never[],
      absences: [] as never[],
      labourDemand: [] as never[],
      loadFailed: true,
    };
  }

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

  const labourDemand = Array.from(labourByProject.entries()).map(([projectId, trades]) => ({
    project_id: projectId,
    by_trade: Array.from(trades.entries()).map(([trade, hours]) => ({ trade, hours })),
  }));

  return {
    projects: projects ?? [],
    staff: staff ?? [],
    allocations: allocations ?? [],
    absences: absences ?? [],
    labourDemand,
    loadFailed: false,
  };
}