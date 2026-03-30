import { createClient } from "@/lib/supabase/server";
import DashboardClient from "./dashboard-client";

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

    // 2. Fetch Financials (estimates-based value)
    const { data: allEstimates } = await supabase
        .from("estimates")
        .select("project_id, total_cost, profit_pct, overhead_pct, risk_pct")
        .in("project_id", safeProjects.map(p => p.id));

    const financialMap: Record<string, number> = {};
    safeProjects.forEach(p => {
        const projEsts = allEstimates?.filter(e => e.project_id === p.id) || [];
        const total = projEsts.reduce((sum, e) => {
            const markup = 1 + ((e.profit_pct || 0) + (e.overhead_pct || 0) + (e.risk_pct || 0)) / 100;
            return sum + (e.total_cost * markup);
        }, 0);
        financialMap[p.id] = total;
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

    const totalPipelineValue = safeProjects
        .filter(p => p.status !== "Lost" && p.status !== "Completed")
        .reduce((sum, p) => sum + (p.potential_value || 0), 0);

    const proposalsSent = safeProjects.filter(p => p.proposal_sent_at !== null && p.proposal_sent_at !== undefined).length;

    const wonThisMonth = safeProjects.filter(p => {
        if (!p.proposal_accepted_at) return false;
        const acceptedDate = new Date(p.proposal_accepted_at);
        return acceptedDate >= startOfMonth && acceptedDate <= endOfMonth;
    }).length;

    const activeJobs = safeProjects.filter(p => p.status === "Active" || p.status === "Won").length;

    const accepted = safeProjects.filter(p => p.proposal_accepted_at !== null && p.proposal_accepted_at !== undefined).length;
    const winRate = proposalsSent > 0 ? Math.round((accepted / proposalsSent) * 100) : 0;

    const totalRevenueSigned = safeProjects
        .filter(p => p.proposal_accepted_at !== null && p.proposal_accepted_at !== undefined)
        .reduce((sum, p) => sum + (p.potential_value || 0), 0);

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
