import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProjectNavBar from "@/components/project-navbar";
import OverviewClient from "./overview-client";
import {
    computeContractSum,
    computeBudgetCost as computeBudgetCostLib,
    computeForecastFinal,
    computeForecastMargin,
} from "@/lib/financial";
import type {
    Estimate,
    EstimateLine,
    Invoice,
    ProjectExpense,
    Variation,
} from "@/types/domain";

export const dynamic = "force-dynamic";

// Sprint 58 P1.8: these wrappers used to duplicate the QS hierarchy inline.
// Now they call through to src/lib/financial.ts which has 35 Vitest tests
// asserting on the same math the proposal editor, PDF, billing page, and
// P&L dashboard use. Any future divergence gets caught by the tests.
//
// Sprint 58 P3.2 — typed via @/types/domain so future callers can't
// pass a rogue shape through.
function computeContractValue(est: Estimate | null, lines: EstimateLine[]): number {
    if (!est) return 0;
    return computeContractSum(est, lines).contractSum;
}

function computeBudgetCost(est: Estimate | null, lines: EstimateLine[]): number {
    if (!est) return 0;
    return computeBudgetCostLib(est, lines);
}

export default async function OverviewPage({ searchParams }: { searchParams: { projectId?: string } }) {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) redirect("/login");

    // Fetch all projects for the switcher
    const { data: allProjects } = await supabase
        .from("projects")
        .select("id, name")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

    const activeProjectId = searchParams.projectId || allProjects?.[0]?.id;

    if (!activeProjectId) {
        return <div className="p-8 text-slate-400">No projects found. Create one in the dashboard first.</div>;
    }

    // Fetch all data in parallel
    const [
        { data: project },
        { data: estimates },
        { data: expenses },
        { data: invoices },
        { data: variations },
        { data: sectionForecasts },
    ] = await Promise.all([
        supabase.from("projects")
            .select("id, name, client_name, site_address, start_date, status, project_type, programme_phases")
            .eq("id", activeProjectId)
            .eq("user_id", user.id)
            .single(),
        supabase.from("estimates")
            .select("*, estimate_lines(trade_section, line_total)")
            .eq("project_id", activeProjectId),
        supabase.from("project_expenses")
            .select("amount, expense_date, trade_section, cost_type, cost_status")
            .eq("project_id", activeProjectId),
        supabase.from("invoices")
            .select("id, amount, status, type, created_at, description")
            .eq("project_id", activeProjectId)
            .order("created_at", { ascending: false }),
        supabase.from("variations")
            .select("amount, status")
            .eq("project_id", activeProjectId),
        supabase.from("project_section_forecasts")
            .select("trade_section, forecast_cost")
            .eq("project_id", activeProjectId),
    ]);

    if (!project) {
        return <div className="p-8 text-slate-400">Project not found.</div>;
    }

    // ── Financials ──────────────────────────────────────────────────────────────
    // Sprint 58 P3.2 — typed via @/types/domain.
    const typedEstimates = (estimates ?? []) as unknown as Estimate[];
    const typedExpenses  = (expenses  ?? []) as unknown as ProjectExpense[];
    const typedInvoices  = (invoices  ?? []) as unknown as Invoice[];
    const typedVariations = (variations ?? []) as unknown as Variation[];

    const activeEstimate: Estimate | null =
        typedEstimates.find((e) => e.is_active === true) ?? typedEstimates[0] ?? null;
    const lines: EstimateLine[] = activeEstimate?.estimate_lines ?? [];

    const contractValue = computeContractValue(activeEstimate, lines);
    const budgetCost    = computeBudgetCost(activeEstimate, lines);

    // Split expenses into actual vs committed so forecast math works correctly.
    const actualExpenses    = typedExpenses.filter((e) => (e.cost_status ?? "actual") === "actual");
    const committedExpenses = typedExpenses.filter((e) => e.cost_status === "committed");
    const costsPosted    = actualExpenses.reduce((s, e) => s + Number(e.amount), 0);
    const committedTotal = committedExpenses.reduce((s, e) => s + Number(e.amount), 0);

    const invoicedTotal  = typedInvoices.reduce((s, i) => s + Number(i.amount), 0);
    const receivedTotal  = typedInvoices.filter((i) => i.status === "Paid").reduce((s, i) => s + Number(i.amount), 0);
    const approvedVars   = typedVariations.filter((v) => v.status === "Approved").reduce((s, v) => s + Number(v.amount), 0);
    const outstandingAmt = invoicedTotal - receivedTotal;
    const outstandingInvoices = typedInvoices.filter((i) => i.status !== "Paid");

    // ── Forecast at completion ─────────────────────────────────────────────────
    // Mirror the logic the P&L dashboard uses so the RAG light is honest about
    // whether the project is still expected to make or lose money.
    //
    //   actual  + committed  + remaining-from-budget = forecast final
    //
    // If the user has entered a per-section forecast override, that replaces
    // the auto-computed number for that section. Sections with no budget but
    // logged spend contribute the raw spend.
    const budgetBySection: Record<string, number> = {};
    lines
        .filter((l) => l.trade_section !== "Preliminaries" && (l.line_total || 0) > 0)
        .forEach((l) => {
            const sec = l.trade_section || "General";
            budgetBySection[sec] = (budgetBySection[sec] || 0) + Number(l.line_total || 0);
        });
    const actualBySection: Record<string, number> = {};
    actualExpenses.forEach((e) => {
        const sec = e.trade_section || "General";
        actualBySection[sec] = (actualBySection[sec] || 0) + Number(e.amount || 0);
    });
    const committedBySection: Record<string, number> = {};
    committedExpenses.forEach((e) => {
        const sec = e.trade_section || "General";
        committedBySection[sec] = (committedBySection[sec] || 0) + Number(e.amount || 0);
    });
    const forecastOverrides: Record<string, number> = {};
    const typedSectionForecasts = (sectionForecasts ?? []) as unknown as {
        trade_section: string;
        forecast_cost: number | null;
    }[];
    typedSectionForecasts.forEach((f) => {
        if (f.forecast_cost != null) forecastOverrides[f.trade_section] = Number(f.forecast_cost);
    });

    // Delegated to src/lib/financial.ts so the logic is pinned by the
    // Vitest suite. Includes the "orphan section" edge case from 22
    // Birchwood Avenue — Masonry had actual spend but no budget row,
    // and the old inline math silently dropped it.
    const forecastFinal = computeForecastFinal({
        budgetBySection,
        actualBySection,
        committedBySection,
        overrides: forecastOverrides,
    });
    const { margin: forecastMargin, marginPct: forecastMarginPct } =
        computeForecastMargin(contractValue, forecastFinal);

    // ── Programme % ─────────────────────────────────────────────────────────────
    const phases: any[] = project.programme_phases ?? [];
    let programmePct = 0;
    let currentPhaseName: string | null = null;
    let totalCalendarDays = 0;

    if (phases.length > 0 && project.start_date) {
        // Total calendar days = max end point across all phases (offset + duration × 7/5)
        const DPW = 5;
        totalCalendarDays = phases.reduce((max: number, p: any) => {
            const dur = (p.manualDays ?? p.calculatedDays ?? 5);
            const end = (p.startOffset ?? 0) + Math.ceil(dur / DPW) * 7;
            return Math.max(max, end);
        }, 0);

        const startDate = new Date(project.start_date);
        const today     = new Date();
        const elapsedDays = Math.max(0, Math.floor((today.getTime() - startDate.getTime()) / 86_400_000));
        programmePct = totalCalendarDays > 0 ? Math.min(Math.round((elapsedDays / totalCalendarDays) * 100), 100) : 0;

        // Find current phase
        const currentPhase = [...phases].reverse().find((p: any) => {
            return (p.startOffset ?? 0) <= elapsedDays;
        });
        currentPhaseName = currentPhase?.name ?? phases[0]?.name ?? null;
    }

    // ── RAG ─────────────────────────────────────────────────────────────────────
    // Three dimensions, worst wins:
    //   1. Budget burn — how close actual spend is to the budget envelope
    //   2. Programme — how close we are to programme end
    //   3. Forecast margin — whether the project is still expected to make
    //      money at completion (this is the one that was missing in Sprint 57
    //      and got flagged by Perplexity: on 22 Birchwood, burn was only 53%
    //      but forecast final exceeded contract sum so the project was headed
    //      for a loss while the overview still showed "On Track")
    const burnPct = budgetCost > 0 ? (costsPosted / budgetCost) * 100 : 0;
    const budgetRag: "red" | "amber" | "green" =
        burnPct > 100 ? "red" : burnPct > 85 ? "amber" : "green";
    const programmeRag: "red" | "amber" | "green" =
        programmePct > 100 ? "red" : programmePct > 90 ? "amber" : "green";

    // Forecast RAG:
    //   Red   — forecast final > contract value (project in the red)
    //   Amber — margin < 5% (razor-thin, any variation eats it)
    //   Green — otherwise
    const forecastRag: "red" | "amber" | "green" =
        contractValue > 0 && forecastFinal > contractValue
            ? "red"
            : contractValue > 0 && forecastMarginPct < 5
                ? "amber"
                : "green";

    const rags: ("red" | "amber" | "green")[] = [budgetRag, programmeRag, forecastRag];
    const overallRag: "red" | "amber" | "green" =
        rags.includes("red") ? "red" : rags.includes("amber") ? "amber" : "green";

    return (
        <div className="max-w-7xl mx-auto p-8 pt-24 space-y-8">
            <ProjectNavBar projectId={activeProjectId} activeTab="overview" />
            <OverviewClient
                project={{
                    id: project.id,
                    name: project.name,
                    client_name: project.client_name,
                    site_address: project.site_address,
                    start_date: project.start_date,
                    status: project.status,
                    programme_phases: phases,
                }}
                projectId={activeProjectId}
                contractValue={contractValue}
                budgetCost={budgetCost}
                costsPosted={costsPosted}
                committedTotal={committedTotal}
                forecastFinal={forecastFinal}
                forecastMargin={forecastMargin}
                forecastMarginPct={forecastMarginPct}
                invoicedTotal={invoicedTotal}
                receivedTotal={receivedTotal}
                outstandingAmt={outstandingAmt}
                outstandingInvoices={outstandingInvoices}
                approvedVars={approvedVars}
                programmePct={programmePct}
                currentPhaseName={currentPhaseName}
                totalCalendarDays={totalCalendarDays}
                burnPct={burnPct}
                overallRag={overallRag}
                budgetRag={budgetRag}
                programmeRag={programmeRag}
                forecastRag={forecastRag}
            />
        </div>
    );
}
