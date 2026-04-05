import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId } from "@/lib/supabase/auth-utils";
import { redirect } from "next/navigation";
import ProjectNavBar from "@/components/project-navbar";
import EstimateClient from "./estimate-client";

export const dynamic = "force-dynamic";

export default async function EstimatingPage({ searchParams }: { searchParams: { projectId?: string } }) {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;

    if (!user) redirect("/login");

    // Fetch org ID for rate library
    let orgId: string | null = null;
    try {
        orgId = await getActiveOrganizationId();
    } catch {
        // User may not have an org yet — continue without
    }

    // Fetch all projects for the switcher
    const { data: allProjects } = await supabase
        .from("projects")
        .select("id, name")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

    const activeProjectId = searchParams.projectId || allProjects?.[0]?.id;

    // Fetch active project
    const { data: project } = await supabase
        .from("projects")
        .select("*")
        .eq("id", activeProjectId)
        .single();

    if (!project) {
        return <div className="p-8 text-slate-400">No projects found. Create one in the dashboard first.</div>;
    }

    // Fetch estimates with lines and components
    const { data: estimates } = await supabase
        .from("estimates")
        .select("*, estimate_lines(*, estimate_line_components(*))")
        .eq("project_id", project.id)
        .order("created_at");

    // Fetch rate buildups library (system defaults + org items)
    const rateBuildupQuery = supabase
        .from("rate_buildups")
        .select("*")
        .order("usage_count", { ascending: false });

    if (orgId) {
        rateBuildupQuery.or(`is_system_default.eq.true,organization_id.eq.${orgId}`);
    } else {
        rateBuildupQuery.eq("is_system_default", true);
    }

    const { data: rateBuildups } = await rateBuildupQuery;

    // Fetch cost library (system defaults + user org items)
    const { data: costLibrary } = await supabase
        .from("cost_library_items")
        .select("*")
        .or("is_system_default.eq.true")
        .order("category,description");

    // Fetch labour rates (system defaults + org rates)
    const labourRateQuery = supabase
        .from("labour_rates")
        .select("*")
        .order("trade,role");

    if (orgId) {
        labourRateQuery.or(`is_system_default.eq.true,organization_id.eq.${orgId}`);
    } else {
        labourRateQuery.eq("is_system_default", true);
    }

    const { data: labourRates } = await labourRateQuery;

    // Fetch preferred trades from user profile
    const { data: profileData } = await supabase
        .from("profiles")
        .select("preferred_trades")
        .eq("id", user.id)
        .single();
    const preferredTrades: string[] = (profileData?.preferred_trades as string[]) || [];

    return (
        <div className="max-w-7xl mx-auto p-8 pt-24 space-y-8">
            <ProjectNavBar projectId={activeProjectId} activeTab="estimating" />

            {/* Estimate Client */}
            <EstimateClient
                estimates={(estimates || []).map((e: any) => ({
                    ...e,
                    estimate_lines: (e.estimate_lines || []).map((l: any) => ({
                        ...l,
                        pricing_mode: l.pricing_mode || "simple",
                        estimate_line_components: l.estimate_line_components || [],
                    })),
                    overhead_pct: e.overhead_pct ?? 10,
                    profit_pct: e.profit_pct ?? 15,
                    risk_pct: e.risk_pct ?? 0,
                    total_cost: e.total_cost ?? 0,
                    is_active: e.is_active ?? false,
                }))}
                costLibrary={(costLibrary || []).map((c: any) => ({
                    id: c.id,
                    code: c.code || "",
                    description: c.description || "",
                    unit: c.unit || "nr",
                    base_rate: c.base_rate || 0,
                    category: c.category || "General",
                }))}
                projectId={project.id}
                orgId={orgId || ""}
                rateBuildups={(rateBuildups || []).map((rb: any) => ({
                    id: rb.id,
                    name: rb.name || "",
                    unit: rb.unit || "nr",
                    built_up_rate: rb.built_up_rate || 0,
                    trade_section: rb.trade_section || "",
                    components: rb.components || [],
                    total_manhours_per_unit: rb.total_manhours_per_unit || 0,
                }))}
                preferredTrades={preferredTrades}
                labourRates={(labourRates || []).map((lr: any) => ({
                    id: lr.id,
                    trade: lr.trade || "",
                    role: lr.role || "",
                    day_rate: lr.day_rate || 0,
                    hourly_rate: lr.hourly_rate || 0,
                    region: lr.region || "national",
                    organization_id: lr.organization_id || null,
                    is_system_default: lr.is_system_default ?? true,
                }))}
            />

        </div>
    );
}
