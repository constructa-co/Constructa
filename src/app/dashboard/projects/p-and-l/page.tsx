import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ClientPLDashboard from "./client-pl-dashboard";
import GlobalPLDashboard from "./global-pl-client";
import { computeContractSum } from "@/lib/financial";

export const dynamic = "force-dynamic";

// E2E-P1-1 — this page had its own local computeContractValue function
// AND an inline QS ladder further down the file. Both are now replaced
// by the canonical computeContractSum in src/lib/financial.ts so the
// P&L numbers can never drift from the proposal, billing, or overview.
// Thin wrapper preserves the old signature the global P&L uses.
function computeContractValue(est: any, lines: any[]): number {
    if (!est) return 0;
    return computeContractSum(est, lines ?? []).contractSum;
}

export default async function PLPage({ searchParams }: { searchParams: { projectId?: string } }) {
    const supabase = createClient();
    const projectId = searchParams.projectId;

    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) redirect("/login");

    // ── No projectId → Global P&L across all projects ────────────────────────
    if (!projectId) {
        // Step 1: fetch projects + profile in parallel
        const [{ data: projects }, { data: profile }] = await Promise.all([
            supabase
                .from("projects")
                .select("id, name, client_name, project_type, proposal_status, potential_value, created_at")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false }),
            supabase
                .from("profiles")
                .select("financial_year_start_month, company_name")
                .eq("id", user.id)
                .single(),
        ]);

        const projectIds = (projects ?? []).map(p => p.id);

        // Step 2: only fetch financial data if there are projects (avoids PostgREST .in([]) bug)
        let allExpenses: any[] = [];
        let allInvoices: any[] = [];
        let allEstimates: any[] = [];

        if (projectIds.length > 0) {
            const [
                { data: expData },
                { data: invData },
                { data: estData },
            ] = await Promise.all([
                supabase
                    .from("project_expenses")
                    .select("project_id, amount, expense_date, trade_section, cost_type")
                    .in("project_id", projectIds),
                supabase
                    .from("invoices")
                    .select("project_id, amount, status, created_at")
                    .in("project_id", projectIds),
                supabase
                    .from("estimates")
                    .select("project_id, total_cost, overhead_pct, profit_pct, risk_pct, prelims_pct, discount_pct, is_active, estimate_lines(trade_section, line_total)")
                    .in("project_id", projectIds),
            ]);
            allExpenses  = expData  ?? [];
            allInvoices  = invData  ?? [];
            allEstimates = estData  ?? [];
        }

        // Build per-project financials
        const projectSummaries = (projects ?? []).map(proj => {
            const estimates = (allEstimates ?? []).filter(e => e.project_id === proj.id);
            const activeEst = estimates.find(e => e.is_active) ?? estimates[0] ?? null;
            const contractValue = activeEst
                ? computeContractValue(activeEst, activeEst.estimate_lines ?? [])
                : (Number(proj.potential_value) || 0);
            const budgetCost = activeEst
                ? (() => {
                    const lines = activeEst.estimate_lines ?? [];
                    const np = lines.filter((l: any) => l.trade_section !== "Preliminaries");
                    const pl = lines.filter((l: any) => l.trade_section === "Preliminaries");
                    const dc = np.reduce((s: number, l: any) => s + (Number(l.line_total) || 0), 0);
                    const prelims = pl.length > 0
                        ? pl.reduce((s: number, l: any) => s + (Number(l.line_total) || 0), 0)
                        : dc * ((Number(activeEst.prelims_pct) || 0) / 100);
                    return dc + prelims;
                })()
                : contractValue * 0.7; // rough 30% margin assumption if no estimate
            const expenses = (allExpenses ?? []).filter(e => e.project_id === proj.id);
            const invoices = (allInvoices ?? []).filter(i => i.project_id === proj.id);
            const costsPosted  = expenses.reduce((s, e) => s + Number(e.amount), 0);
            const invoicedTotal = invoices.reduce((s, i) => s + Number(i.amount), 0);
            const receivedTotal = invoices.filter(i => i.status === "Paid").reduce((s, i) => s + Number(i.amount), 0);
            const marginPct = contractValue > 0 ? ((contractValue - budgetCost) / contractValue) * 100 : 0;
            const forecastMarginPct = contractValue > 0
                ? ((contractValue - (costsPosted + Math.max(budgetCost - costsPosted, 0))) / contractValue) * 100
                : 0;
            return { proj, contractValue, budgetCost, costsPosted, invoicedTotal, receivedTotal, marginPct, forecastMarginPct };
        });

        // Monthly period data — group expenses + invoices by month
        const monthMap = new Map<string, { costs: number; invoiced: number; received: number }>();
        for (const exp of (allExpenses ?? [])) {
            if (!exp.expense_date) continue;
            const key = exp.expense_date.substring(0, 7); // "YYYY-MM"
            const row = monthMap.get(key) ?? { costs: 0, invoiced: 0, received: 0 };
            row.costs += Number(exp.amount);
            monthMap.set(key, row);
        }
        for (const inv of (allInvoices ?? [])) {
            if (!inv.created_at) continue;
            const key = (inv.created_at as string).substring(0, 7);
            const row = monthMap.get(key) ?? { costs: 0, invoiced: 0, received: 0 };
            row.invoiced += Number(inv.amount);
            if (inv.status === "Paid") row.received += Number(inv.amount);
            monthMap.set(key, row);
        }
        const monthlyData = Array.from(monthMap.entries())
            .map(([month, data]) => ({ month, ...data }))
            .sort((a, b) => b.month.localeCompare(a.month))
            .slice(0, 24); // up to 24 months of history

        return (
            <div className="max-w-7xl mx-auto px-6 py-8 min-h-screen">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-slate-100">Job P&L — All Projects</h1>
                    <p className="text-sm text-slate-400 mt-0.5">
                        Portfolio financial overview · {(projects ?? []).length} project{(projects ?? []).length !== 1 ? "s" : ""}
                    </p>
                </div>
                <GlobalPLDashboard
                    projectSummaries={projectSummaries}
                    monthlyData={monthlyData}
                    financialYearStartMonth={profile?.financial_year_start_month ?? 4}
                />
            </div>
        );
    }

    // ── ProjectId present → Project-level P&L ────────────────────────────────
    const [
        { data: project },
        { data: estimates },
        { data: expenses },
        { data: invoices },
        { data: variations },
        { data: staffCatalogue },
        { data: plantCatalogue },
        { data: sectionForecasts },
    ] = await Promise.all([
        supabase.from("projects").select("id, name, client_name, site_address").eq("id", projectId).eq("user_id", user.id).single(),
        supabase.from("estimates").select("*, estimate_lines(*)").eq("project_id", projectId),
        supabase.from("project_expenses").select("*").eq("project_id", projectId).order("expense_date", { ascending: false }),
        supabase.from("invoices").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
        supabase.from("variations").select("*").eq("project_id", projectId),
        supabase.from("staff_resources").select("*").eq("user_id", user.id).eq("is_active", true).order("name"),
        supabase.from("plant_resources").select("*").eq("user_id", user.id).eq("is_active", true).order("name"),
        supabase.from("project_section_forecasts").select("trade_section, forecast_cost").eq("project_id", projectId),
    ]);

    if (!project) redirect("/dashboard/projects/p-and-l");

    const activeEstimate = estimates?.find((e: any) => e.is_active) ?? estimates?.[0] ?? null;
    const lines: any[] = activeEstimate?.estimate_lines ?? [];

    // E2E-P1-1 — delegate to canonical computeContractSum instead of
    // duplicating the QS ladder here. Previously this page had its own
    // inline calculation which was at risk of silently drifting (and
    // Antigravity reported P&L showing £0 for 22 Birchwood in their
    // walkthrough — most likely a render-time hydration issue but we
    // also remove any possibility of numeric drift as part of the fix).
    const breakdown = activeEstimate
        ? computeContractSum(activeEstimate, lines)
        : {
            directCost:            0,
            prelimsTotal:          0,
            totalConstructionCost: 0,
            overheadAmount:        0,
            riskAmount:            0,
            profitAmount:          0,
            discountAmount:        0,
            contractSum:           0,
            ohRiskProfitMultiplier: 1,
        };
    const directCost      = breakdown.directCost;
    const prelimsTotal    = breakdown.prelimsTotal;
    const totalBudgetCost = breakdown.totalConstructionCost;
    const overheadPct     = Number(activeEstimate?.overhead_pct) || 0;
    const riskPct         = Number(activeEstimate?.risk_pct)     || 0;
    const profitPct       = Number(activeEstimate?.profit_pct)   || 0;
    const discountPct     = Number(activeEstimate?.discount_pct) || 0;
    const oh              = breakdown.overheadAmount;
    const riskAmt         = breakdown.riskAmount;
    const profitAmt       = breakdown.profitAmount;
    const contractValue   = breakdown.contractSum;

    const sectionMap = new Map<string, number>();
    for (const l of lines) {
        const s = l.trade_section || "General";
        sectionMap.set(s, (sectionMap.get(s) ?? 0) + (Number(l.line_total) || 0));
    }
    const budgetBySection = Array.from(sectionMap.entries())
        .map(([section, budget]) => ({ section, budget }))
        .sort((a, b) => b.budget - a.budget);

    // Split expenses into actual (invoiced/paid) vs committed (PO placed, not yet invoiced)
    const actualExpenses     = (expenses ?? []).filter((e: any) => (e.cost_status ?? "actual") === "actual");
    const committedExpenses  = (expenses ?? []).filter((e: any) => e.cost_status === "committed");

    const costsPosted      = actualExpenses.reduce((s: number, e: any) => s + Number(e.amount), 0);
    const committedTotal   = committedExpenses.reduce((s: number, e: any) => s + Number(e.amount), 0);
    const invoicedTotal    = (invoices ?? []).reduce((s: number, i: any) => s + Number(i.amount), 0);
    const receivedTotal    = (invoices ?? []).filter((i: any) => i.status === "Paid").reduce((s: number, i: any) => s + Number(i.amount), 0);
    const approvedVarTotal = (variations ?? []).filter((v: any) => v.status === "Approved").reduce((s: number, v: any) => s + Number(v.amount), 0);

    // Actual costs by section (only invoiced/paid expenses)
    const actualMap = new Map<string, number>();
    for (const e of actualExpenses) {
        const s = (e.trade_section as string) || "General";
        actualMap.set(s, (actualMap.get(s) ?? 0) + (Number(e.amount) || 0));
    }

    // Committed costs by section (for the section table)
    const committedBySectionMap = new Map<string, number>();
    for (const e of committedExpenses) {
        const s = (e.trade_section as string) || "General";
        committedBySectionMap.set(s, (committedBySectionMap.get(s) ?? 0) + Number(e.amount));
    }
    const committedBySection = Array.from(committedBySectionMap.entries()).map(([section, committed]) => ({ section, committed }));

    return (
        <div className="max-w-7xl mx-auto px-6 py-8 min-h-screen">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-100">Job P&L</h1>
                    <p className="text-sm text-slate-400 mt-0.5">
                        Financial position for: <span className="font-semibold text-slate-200">{project.name}</span>
                        {project.client_name && <span className="text-slate-500"> · {project.client_name}</span>}
                    </p>
                </div>
                <a
                    href="/dashboard/projects/p-and-l"
                    className="text-xs text-slate-500 hover:text-blue-400 transition-colors"
                >
                    ← All Projects
                </a>
            </div>
            <ClientPLDashboard
                projectId={projectId}
                project={project}
                contractValue={contractValue}
                totalBudgetCost={totalBudgetCost}
                riskAmt={riskAmt}
                riskPct={riskPct}
                budgetBySection={budgetBySection}
                actualBySection={Array.from(actualMap.entries()).map(([section, actual]) => ({ section, actual }))}
                costsPosted={costsPosted}
                committedTotal={committedTotal}
                committedBySection={committedBySection}
                sectionForecasts={(sectionForecasts ?? []).map((f: any) => ({ section: f.trade_section, forecastCost: Number(f.forecast_cost) }))}
                invoicedTotal={invoicedTotal}
                receivedTotal={receivedTotal}
                approvedVarTotal={approvedVarTotal}
                expenses={expenses ?? []}
                invoices={invoices ?? []}
                staffCatalogue={staffCatalogue ?? []}
                plantCatalogue={plantCatalogue ?? []}
                estimateLines={lines}
            />
        </div>
    );
}
