import { createClient } from "@/lib/supabase/server";
import DashboardClient from "./dashboard-client";
import { isActiveProject } from "@/lib/project-helpers";
import { computeContractSum } from "@/lib/financial";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;

    // 1. Fetch all projects with relevant fields
    const { data: projects } = await supabase
        .from("projects")
        .select("id, name, client_name, client_email, client_phone, status, project_type, potential_value, created_at, proposal_sent_at, proposal_accepted_at, site_address, client_address")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

    const safeProjects = projects || [];

    // 2. Fetch active estimates with their lines so we can compute the
    // canonical contract sum per project (not the old inline markup math
    // which skipped prelims and discount).
    // P1-4 — previously this used a hand-rolled formula that produced
    // different numbers to every other view. Now uses computeContractSum.
    const { data: activeEstimates } = await supabase
        .from("estimates")
        .select("id, project_id, total_cost, prelims_pct, overhead_pct, profit_pct, risk_pct, discount_pct, is_active, estimate_lines(trade_section, line_total)")
        .in("project_id", safeProjects.map(p => p.id))
        .eq("is_active", true);

    const financialMap: Record<string, number> = {};
    safeProjects.forEach(p => {
        const est = activeEstimates?.find(e => e.project_id === p.id);
        if (est) {
            const { contractSum } = computeContractSum(est, (est as any).estimate_lines ?? []);
            financialMap[p.id] = contractSum;
        }
    });

    // 3. Fetch company name from profile
    const { data: profile } = await supabase
        .from("profiles")
        .select("company_name, full_name")
        .eq("id", user?.id)
        .single();

    const companyName = profile?.company_name || profile?.full_name || user?.email?.split("@")[0] || "Constructa";

    // 4. Calculate KPI metrics server-side
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // P1-4 — pipeline value uses canonical contract sum when an active
    // estimate exists, falls back to potential_value for Lead/Estimating
    // stages where only a gut-feel budget is available.
    const projectValue = (p: { id: string; potential_value?: number | null }) =>
        financialMap[p.id] > 0 ? financialMap[p.id] : (p.potential_value ?? 0);

    const totalPipelineValue = safeProjects
        .filter(p => p.status !== "Lost" && p.status !== "Completed")
        .reduce((sum, p) => sum + projectValue(p), 0);

    const proposalsSent = safeProjects.filter(p => p.proposal_sent_at !== null && p.proposal_sent_at !== undefined).length;

    const wonThisMonth = safeProjects.filter(p => {
        if (!p.proposal_accepted_at) return false;
        const acceptedDate = new Date(p.proposal_accepted_at);
        return acceptedDate >= startOfMonth && acceptedDate <= endOfMonth;
    }).length;

    const activeJobs = safeProjects.filter(isActiveProject).length;

    const accepted = safeProjects.filter(p => p.proposal_accepted_at !== null && p.proposal_accepted_at !== undefined).length;
    const winRate = proposalsSent > 0 ? Math.round((accepted / proposalsSent) * 100) : 0;

    const totalRevenueSigned = safeProjects
        .filter(p => p.proposal_accepted_at !== null && p.proposal_accepted_at !== undefined)
        .reduce((sum, p) => sum + projectValue(p), 0);

    const metrics = {
        totalPipelineValue,
        proposalsSent,
        wonThisMonth,
        activeJobs,
        winRate,
        totalRevenueSigned,
    };

    return (
        <DashboardClient
            projects={safeProjects}
            financials={financialMap}
            metrics={metrics}
            companyName={companyName}
        />
    );
}
