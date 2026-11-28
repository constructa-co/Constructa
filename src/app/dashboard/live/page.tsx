import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import LiveProjectsClient from "./live-client";
import ProjectLiveClient from "./project-live-client";
// Stage 5 follow-up (19 Apr 2026): /dashboard/live previously had its own
// inline computeContractValue. The math was logically correct (filters
// Preliminaries from directCost, prefers explicit prelims lines, falls
// back to prelims_pct) but it duplicated the canonical helper. Swapped
// so any future change to contract-sum semantics lands in one place.
// D96-S4: budget cost now always comes from computeBudgetCost too, so blank
// prelims rows, PC/provisional sums, credits and the legacy total_cost
// fallback behave exactly as on the P&L and billing pages.
import { computeBudgetCost, computeContractSumValue } from "@/lib/financial";
import { liveFigures, totalOrUnavailable, type LiveUnavailable } from "./live-data";

// D124 N2.5: a failed read must never render as an empty or £0 position.
// Critical reads (the project list, the project, its estimates) throw to the
// dashboard error boundary. Secondary reads (cost entries, invoices,
// variations) are reported as unavailable, and every figure that depends on
// them shows as unavailable rather than zero.
function failed(scope: string, error: unknown): never {
    console.error(`[live] ${scope} query failed`, error);
    throw new Error(`Live Projects could not load ${scope}.`);
}

function secondary<T>(scope: string, result: { data: T[] | null; error: unknown }): T[] | null {
    if (result.error) {
        console.error(`[live] ${scope} query failed`, result.error);
        return null;
    }
    return result.data ?? [];
}

export default async function LiveProjectsPage(props: { searchParams: Promise<{ projectId?: string }> }) {
    const searchParams = await props.searchParams;
    const supabase = await createClient();
    const { projectId } = searchParams;

    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) redirect("/login");

    // ── Per-project live view ─────────────────────────────────────────────────
    if (projectId) {
        const [projectResult, estimatesResult, expensesResult, invoicesResult, variationsResult] = await Promise.all([
            supabase.from("projects").select("id, name, client_name, site_address, start_date, project_type").eq("id", projectId).eq("user_id", user.id).single(),
            supabase.from("estimates").select("*, estimate_lines(*)").eq("project_id", projectId),
            supabase.from("project_expenses").select("*").eq("project_id", projectId).order("expense_date", { ascending: false }),
            supabase.from("invoices").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
            supabase.from("variations").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
        ]);

        // PGRST116 is "no row": the project is not this user's or does not exist.
        if (projectResult.error && projectResult.error.code !== "PGRST116") failed("this project", projectResult.error);
        const project = projectResult.data;
        if (!project) redirect("/dashboard/live");
        if (estimatesResult.error) failed("this project's estimates", estimatesResult.error);

        const estimates = estimatesResult.data ?? [];
        const expenses = secondary("cost entries", expensesResult);
        const invoices = secondary("invoices", invoicesResult);
        const variations = secondary("variations", variationsResult);

        const activeEstimate = estimates.find((e: any) => e.is_active) ?? estimates[0] ?? null;
        const lines: any[] = activeEstimate?.estimate_lines ?? [];
        const figures = liveFigures({
            contractValue: activeEstimate ? computeContractSumValue(activeEstimate, lines) : 0,
            budgetCost: activeEstimate ? computeBudgetCost(activeEstimate, lines) : 0,
            expenses,
            invoices,
            variations,
        });
        const unavailable: LiveUnavailable = { costs: expenses === null, invoices: invoices === null, variations: variations === null };

        return (
            <div className="max-w-5xl mx-auto px-6 py-8 min-h-screen">
                <ProjectLiveClient
                    projectId={projectId}
                    project={project}
                    figures={figures}
                    unavailable={unavailable}
                    costs={expenses ?? []}
                    invoices={invoices ?? []}
                    variations={variations ?? []}
                />
            </div>
        );
    }

    // ── Portfolio overview ────────────────────────────────────────────────────
    const { data: projectRows, error: projectsError } = await supabase
        .from("projects")
        .select("id, name, client_name, project_type, site_address, proposal_status, potential_value, start_date, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

    if (projectsError) failed("your projects", projectsError);
    const projects = projectRows ?? [];

    if (projects.length === 0) {
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

    const [expensesResult, invoicesResult, variationsResult, estimatesResult] = await Promise.all([
        supabase.from("project_expenses").select("project_id, amount").in("project_id", projectIds),
        supabase.from("invoices").select("project_id, amount, status").in("project_id", projectIds),
        supabase.from("variations").select("project_id, amount, status").in("project_id", projectIds),
        supabase.from("estimates")
            .select("project_id, total_cost, overhead_pct, profit_pct, risk_pct, prelims_pct, discount_pct, is_active, estimate_lines(trade_section, line_total, line_type)")
            .in("project_id", projectIds),
    ]);

    // Without estimates every contract value and margin would fall back to a guess.
    if (estimatesResult.error) failed("your estimates", estimatesResult.error);
    const allEstimates = estimatesResult.data ?? [];
    const allExpenses = secondary("cost entries", expensesResult);
    const allInvoices = secondary("invoices", invoicesResult);
    const allVariations = secondary("variations", variationsResult);
    const unavailable: LiveUnavailable = { costs: allExpenses === null, invoices: allInvoices === null, variations: allVariations === null };

    // Build enriched project data
    const enriched = projects.map(proj => {
        const estimates = allEstimates.filter(e => e.project_id === proj.id);
        const activeEst = estimates.find(e => e.is_active) ?? estimates[0] ?? null;

        let contractValue = Number(proj.potential_value) || 0;
        let budgetCost = 0;

        if (activeEst) {
            contractValue = computeContractSumValue(activeEst, activeEst.estimate_lines ?? []);
            budgetCost = computeBudgetCost(activeEst, activeEst.estimate_lines ?? []);
        }

        const figures = liveFigures({
            contractValue,
            budgetCost,
            expenses: allExpenses && allExpenses.filter(e => e.project_id === proj.id),
            invoices: allInvoices && allInvoices.filter(i => i.project_id === proj.id),
            variations: allVariations && allVariations.filter(v => v.project_id === proj.id),
        });

        return {
            id: proj.id,
            name: proj.name,
            client_name: proj.client_name,
            project_type: proj.project_type,
            site_address: proj.site_address,
            proposal_status: proj.proposal_status,
            start_date: proj.start_date,
            updated_at: proj.created_at,
            ...figures,
        };
    });

    const totalContractValue = enriched.reduce((s, p) => s + p.contractValue, 0);
    const totalCosts         = totalOrUnavailable(enriched.map(p => p.costsPosted));
    const totalInvoiced      = totalOrUnavailable(enriched.map(p => p.invoicedTotal));
    const totalOutstanding   = totalOrUnavailable(enriched.map(p => p.outstanding));

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
                unavailable={unavailable}
            />
        </div>
    );
}
