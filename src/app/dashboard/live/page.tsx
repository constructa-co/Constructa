import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import LiveProjectsClient from "./live-client";
import ProjectLiveClient from "./project-live-client";

export const dynamic = "force-dynamic";

// Compute contract value from estimate + lines
function computeContractValue(est: any, lines: any[]): number {
    if (!est) return 0;
    const nonPrelims   = lines.filter((l: any) => l.trade_section !== "Preliminaries");
    const prelimsLines = lines.filter((l: any) => l.trade_section === "Preliminaries");
    const directCost   = nonPrelims.reduce((s: number, l: any) => s + (Number(l.line_total) || 0), 0);
    const prelims      = prelimsLines.length > 0
        ? prelimsLines.reduce((s: number, l: any) => s + (Number(l.line_total) || 0), 0)
        : directCost * ((Number(est.prelims_pct) || 0) / 100);
    const budget = directCost + prelims;
    const oh     = budget * ((Number(est.overhead_pct) || 0) / 100);
    const risk   = (budget + oh) * ((Number(est.risk_pct) || 0) / 100);
    const profit = (budget + oh + risk) * ((Number(est.profit_pct) || 0) / 100);
    const pre    = budget + oh + risk + profit;
    return pre - pre * ((Number(est.discount_pct) || 0) / 100);
}

export default async function LiveProjectsPage({ searchParams }: { searchParams: { projectId?: string } }) {
    const supabase = createClient();
    const { projectId } = searchParams;

    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) redirect("/login");

    // ── Per-project live view ─────────────────────────────────────────────────
    if (projectId) {
        const [
            { data: project },
            { data: estimates },
            { data: expenses },
            { data: invoices },
            { data: variations },
        ] = await Promise.all([
            supabase.from("projects").select("id, name, client_name, site_address, start_date, project_type").eq("id", projectId).eq("user_id", user.id).single(),
            supabase.from("estimates").select("*, estimate_lines(*)").eq("project_id", projectId),
            supabase.from("project_expenses").select("*").eq("project_id", projectId).order("expense_date", { ascending: false }),
            supabase.from("invoices").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
            supabase.from("variations").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
        ]);

        if (!project) redirect("/dashboard/live");

        const activeEstimate = estimates?.find((e: any) => e.is_active) ?? estimates?.[0] ?? null;
        const lines: any[] = activeEstimate?.estimate_lines ?? [];
        const nonPrelims = lines.filter((l: any) => l.trade_section !== "Preliminaries");
        const prelimsLines = lines.filter((l: any) => l.trade_section === "Preliminaries");
        const directCost = nonPrelims.reduce((s: number, l: any) => s + (Number(l.line_total) || 0), 0);
        const prelimsTotal = prelimsLines.length > 0
            ? prelimsLines.reduce((s: number, l: any) => s + (Number(l.line_total) || 0), 0)
            : directCost * ((Number(activeEstimate?.prelims_pct) || 0) / 100);
        const budgetCost = directCost + prelimsTotal;
        const contractValue = activeEstimate ? computeContractValue(activeEstimate, lines) : 0;

        const costsPosted      = (expenses ?? []).reduce((s: number, e: any) => s + Number(e.amount), 0);
        const invoicedTotal    = (invoices ?? []).reduce((s: number, i: any) => s + Number(i.amount), 0);
        const receivedTotal    = (invoices ?? []).filter((i: any) => i.status === "Paid").reduce((s: number, i: any) => s + Number(i.amount), 0);
        const approvedVarTotal = (variations ?? []).filter((v: any) => v.status === "Approved").reduce((s: number, v: any) => s + Number(v.amount), 0);
        const revisedValue     = contractValue + approvedVarTotal;
        const budgetBurnPct    = budgetCost > 0 ? Math.min((costsPosted / budgetCost) * 100, 150) : 0;
        const completionPct    = revisedValue > 0 ? Math.min((invoicedTotal / revisedValue) * 100, 100) : 0;
        const estimatedMarginPct = contractValue > 0 ? ((contractValue - budgetCost) / contractValue) * 100 : 0;

        return (
            <div className="max-w-5xl mx-auto px-6 py-8 min-h-screen">
                <ProjectLiveClient
                    projectId={projectId}
                    project={project}
                    contractValue={contractValue}
                    budgetCost={budgetCost}
                    costsPosted={costsPosted}
                    invoicedTotal={invoicedTotal}
                    receivedTotal={receivedTotal}
                    approvedVarTotal={approvedVarTotal}
                    budgetBurnPct={budgetBurnPct}
                    completionPct={completionPct}
                    estimatedMarginPct={estimatedMarginPct}
                    costs={expenses ?? []}
                    invoices={invoices ?? []}
                    variations={variations ?? []}
                />
            </div>
        );
    }

    // ── Portfolio overview ────────────────────────────────────────────────────
    const { data: projects } = await supabase
        .from("projects")
        .select("id, name, client_name, project_type, site_address, proposal_status, potential_value, start_date, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

    if (!projects || projects.length === 0) {
        return (
            <div className="max-w-7xl mx-auto px-6 py-8 min-h-screen">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-slate-100">Live Projects</h1>
                    <p className="text-sm text-slate-400 mt-0.5">Your active project portfolio</p>
                </div>
                <div className="text-center py-20 text-slate-500">
                    <p className="font-medium text-slate-400 mb-2">No projects yet</p>
                    <a href="/dashboard/projects/new" className="text-blue-400 hover:underline text-sm">+ Create your first project</a>
                </div>
            </div>
        );
    }

    const projectIds = projects.map(p => p.id);

    const [
        { data: allExpenses },
        { data: allInvoices },
        { data: allVariations },
        { data: allEstimates },
    ] = await Promise.all([
        supabase.from("project_expenses").select("project_id, amount").in("project_id", projectIds),
        supabase.from("invoices").select("project_id, amount, status").in("project_id", projectIds),
        supabase.from("variations").select("project_id, amount, status").in("project_id", projectIds),
        supabase.from("estimates")
            .select("project_id, total_cost, overhead_pct, profit_pct, risk_pct, prelims_pct, discount_pct, is_active, estimate_lines(trade_section, line_total)")
            .in("project_id", projectIds),
    ]);

    // Build enriched project data
    const enriched = projects.map(proj => {
        const estimates = (allEstimates ?? []).filter(e => e.project_id === proj.id);
        const activeEst = estimates.find(e => e.is_active) ?? estimates[0] ?? null;

        let contractValue = Number(proj.potential_value) || 0;
        let budgetCost = 0;

        if (activeEst) {
            contractValue = computeContractValue(activeEst, activeEst.estimate_lines ?? []);
            const lines = activeEst.estimate_lines ?? [];
            const np = lines.filter((l: any) => l.trade_section !== "Preliminaries");
            const pl = lines.filter((l: any) => l.trade_section === "Preliminaries");
            const dc = np.reduce((s: number, l: any) => s + (Number(l.line_total) || 0), 0);
            const prelims = pl.length > 0
                ? pl.reduce((s: number, l: any) => s + (Number(l.line_total) || 0), 0)
                : dc * ((Number(activeEst.prelims_pct) || 0) / 100);
            budgetCost = dc + prelims;
        }

        const expenses    = (allExpenses ?? []).filter(e => e.project_id === proj.id);
        const invoices    = (allInvoices ?? []).filter(i => i.project_id === proj.id);
        const variations  = (allVariations ?? []).filter(v => v.project_id === proj.id);

        const costsPosted        = expenses.reduce((s, e) => s + Number(e.amount), 0);
        const invoicedTotal      = invoices.reduce((s, i) => s + Number(i.amount), 0);
        const receivedTotal      = invoices.filter(i => i.status === "Paid").reduce((s, i) => s + Number(i.amount), 0);
        const approvedVariations = variations.filter(v => v.status === "Approved").reduce((s, v) => s + Number(v.amount), 0);
        const revisedValue       = contractValue + approvedVariations;

        const estimatedMarginPct = contractValue > 0 ? ((contractValue - budgetCost) / contractValue) * 100 : 0;
        const completionPct      = revisedValue > 0 ? Math.min((invoicedTotal / revisedValue) * 100, 100) : 0;
        const budgetBurnPct      = budgetCost > 0 ? Math.min((costsPosted / budgetCost) * 100, 150) : 0;
        const hasActivity        = costsPosted > 0 || invoicedTotal > 0 || variations.length > 0;

        return {
            id: proj.id,
            name: proj.name,
            client_name: proj.client_name,
            project_type: proj.project_type,
            site_address: proj.site_address,
            proposal_status: proj.proposal_status,
            start_date: proj.start_date,
            updated_at: proj.created_at,
            contractValue,
            budgetCost,
            revisedValue,
            costsPosted,
            invoicedTotal,
            receivedTotal,
            approvedVariations,
            estimatedMarginPct,
            completionPct,
            budgetBurnPct,
            hasActivity,
        };
    });

    const totalContractValue = enriched.reduce((s, p) => s + p.contractValue, 0);
    const totalCosts         = enriched.reduce((s, p) => s + p.costsPosted, 0);
    const totalInvoiced      = enriched.reduce((s, p) => s + p.invoicedTotal, 0);
    const totalOutstanding   = enriched.reduce((s, p) => s + (p.invoicedTotal - p.receivedTotal), 0);

    return (
        <div className="max-w-7xl mx-auto px-6 py-8 min-h-screen">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-100">Live Projects</h1>
                <p className="text-sm text-slate-400 mt-0.5">
                    Your active project portfolio · {enriched.length} project{enriched.length !== 1 ? "s" : ""}
                </p>
            </div>

            <LiveProjectsClient
                projects={enriched}
                totalContractValue={totalContractValue}
                totalCosts={totalCosts}
                totalInvoiced={totalInvoiced}
                totalOutstanding={totalOutstanding}
            />
        </div>
    );
}
