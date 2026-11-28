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
import { readComplete, readCompleteForIds, type CompleteRead } from "./live-read";

// D124 N2.5: a failed read must never render as an empty or £0 position.
// Critical reads (the project list, the project, its estimates and their
// lines) throw to the dashboard error boundary. Secondary reads (cost entries,
// invoices, variations) are reported as unavailable, and every figure that
// depends on them shows as unavailable rather than zero.
//
// D130: an incomplete read counts as a failed one. The database API returns at
// most 1,000 rows with no error, so every list read here goes through
// readComplete (./live-read), which pages in a fixed order and proves it holds
// every counted row before any total is built from it.
function failed(scope: string, error: unknown): never {
    console.error(`[live] ${scope} query failed`, error);
    throw new Error(`Live Projects could not load ${scope}.`);
}

function critical<T>(scope: string, read: CompleteRead<T>): T[] {
    if (!read.ok) return failed(scope, { reason: read.reason, detail: read.detail });
    return read.rows;
}

function secondary<T>(scope: string, read: CompleteRead<T>): T[] | null {
    if (!read.ok) {
        console.error(`[live] ${scope} query failed`, { reason: read.reason, detail: read.detail });
        return null;
    }
    return read.rows;
}

/** The estimate the page prices from: the active one, else the earliest. Estimates arrive oldest first. */
function pickEstimate<E extends { is_active?: boolean | null }>(estimates: readonly E[]): E | null {
    return estimates.find((e) => e.is_active) ?? estimates[0] ?? null;
}

function groupBy<R>(rows: readonly R[], key: (row: R) => string): Map<string, R[]> {
    const groups = new Map<string, R[]>();
    for (const row of rows) {
        const id = key(row);
        const group = groups.get(id);
        if (group) group.push(row);
        else groups.set(id, [row]);
    }
    return groups;
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
        const [projectResult, estimatesRead, expensesRead, invoicesRead, variationsRead] = await Promise.all([
            supabase.from("projects").select("id, name, client_name, site_address, start_date, project_type").eq("id", projectId).eq("user_id", user.id).single(),
            // Oldest first, so the fallback when none is active is the first estimate made.
            readComplete<any>((from, to) => supabase.from("estimates").select("*", { count: "exact" }).eq("project_id", projectId)
                .order("created_at", { ascending: true }).order("id", { ascending: true }).range(from, to)),
            readComplete<any>((from, to) => supabase.from("project_expenses").select("*", { count: "exact" }).eq("project_id", projectId)
                .order("expense_date", { ascending: false }).order("id", { ascending: false }).range(from, to)),
            readComplete<any>((from, to) => supabase.from("invoices").select("*", { count: "exact" }).eq("project_id", projectId)
                .order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, to)),
            readComplete<any>((from, to) => supabase.from("variations").select("*", { count: "exact" }).eq("project_id", projectId)
                .order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, to)),
        ]);

        // PGRST116 is "no row": the project is not this user's or does not exist.
        if (projectResult.error && projectResult.error.code !== "PGRST116") failed("this project", projectResult.error);
        const project = projectResult.data;
        if (!project) redirect("/dashboard/live");

        const estimates = critical("this project's estimates", estimatesRead);
        const expenses = secondary("cost entries", expensesRead);
        const invoices = secondary("invoices", invoicesRead);
        const variations = secondary("variations", variationsRead);

        const activeEstimate = pickEstimate(estimates);
        // The lines are read on their own, page by page, rather than embedded in
        // the estimate read, so a large estimate is never priced from part of it.
        const lines: any[] = activeEstimate
            ? critical("this project's estimate lines", await readComplete<any>((from, to) => supabase.from("estimate_lines")
                .select("*", { count: "exact" }).eq("estimate_id", activeEstimate.id).order("id", { ascending: true }).range(from, to)))
            : [];
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
    const projects = critical("your projects", await readComplete<any>((from, to) => supabase
        .from("projects")
        .select("id, name, client_name, project_type, site_address, proposal_status, potential_value, start_date, created_at", { count: "exact" })
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to)));

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

    const [expensesRead, invoicesRead, variationsRead, estimatesRead] = await Promise.all([
        readCompleteForIds<any>(projectIds, (ids, from, to) => supabase.from("project_expenses")
            .select("id, project_id, amount", { count: "exact" }).in("project_id", ids).order("id", { ascending: true }).range(from, to)),
        readCompleteForIds<any>(projectIds, (ids, from, to) => supabase.from("invoices")
            .select("id, project_id, amount, status", { count: "exact" }).in("project_id", ids).order("id", { ascending: true }).range(from, to)),
        readCompleteForIds<any>(projectIds, (ids, from, to) => supabase.from("variations")
            .select("id, project_id, amount, status", { count: "exact" }).in("project_id", ids).order("id", { ascending: true }).range(from, to)),
        // Oldest first within each project, so the fallback when none is active is the first estimate made.
        readCompleteForIds<any>(projectIds, (ids, from, to) => supabase.from("estimates")
            .select("id, project_id, total_cost, overhead_pct, profit_pct, risk_pct, prelims_pct, discount_pct, is_active, created_at", { count: "exact" })
            .in("project_id", ids).order("created_at", { ascending: true }).order("id", { ascending: true }).range(from, to)),
    ]);

    // Without estimates every contract value and margin would fall back to a guess.
    const estimatesByProject = groupBy(critical("your estimates", estimatesRead), (e) => e.project_id);
    const activeByProject = new Map<string, any>();
    for (const proj of projects) {
        const activeEst = pickEstimate(estimatesByProject.get(proj.id) ?? []);
        if (activeEst) activeByProject.set(proj.id, activeEst);
    }
    // Only the priced estimate's lines are needed, read in full or not at all.
    const linesByEstimate = groupBy(
        critical("your estimate lines", await readCompleteForIds<any>([...activeByProject.values()].map((e) => e.id), (ids, from, to) => supabase
            .from("estimate_lines").select("id, estimate_id, trade_section, line_total, line_type", { count: "exact" })
            .in("estimate_id", ids).order("id", { ascending: true }).range(from, to))),
        (line) => line.estimate_id,
    );

    const allExpenses = secondary("cost entries", expensesRead);
    const allInvoices = secondary("invoices", invoicesRead);
    const allVariations = secondary("variations", variationsRead);
    const unavailable: LiveUnavailable = { costs: allExpenses === null, invoices: allInvoices === null, variations: allVariations === null };
    const expensesByProject = allExpenses && groupBy(allExpenses, (e) => e.project_id);
    const invoicesByProject = allInvoices && groupBy(allInvoices, (i) => i.project_id);
    const variationsByProject = allVariations && groupBy(allVariations, (v) => v.project_id);

    // Build enriched project data
    const enriched = projects.map(proj => {
        const activeEst = activeByProject.get(proj.id) ?? null;

        let contractValue = Number(proj.potential_value) || 0;
        let budgetCost = 0;

        if (activeEst) {
            const lines = linesByEstimate.get(activeEst.id) ?? [];
            contractValue = computeContractSumValue(activeEst, lines);
            budgetCost = computeBudgetCost(activeEst, lines);
        }

        const figures = liveFigures({
            contractValue,
            budgetCost,
            expenses: expensesByProject && (expensesByProject.get(proj.id) ?? []),
            invoices: invoicesByProject && (invoicesByProject.get(proj.id) ?? []),
            variations: variationsByProject && (variationsByProject.get(proj.id) ?? []),
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
