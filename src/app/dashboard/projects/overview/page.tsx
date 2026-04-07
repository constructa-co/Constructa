import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProjectNavBar from "@/components/project-navbar";
import OverviewClient from "./overview-client";

export const dynamic = "force-dynamic";

// ── Compute full contract value from estimate + lines ────────────────────────
function computeContractValue(est: any, lines: any[]): number {
    if (!est) return 0;
    const nonPrelims   = lines.filter((l: any) => l.trade_section !== "Preliminaries");
    const prelimsLines = lines.filter((l: any) => l.trade_section === "Preliminaries");
    const directCost   = nonPrelims.reduce((s: number, l: any) => s + (Number(l.line_total) || 0), 0);
    const prelims      = prelimsLines.length > 0
        ? prelimsLines.reduce((s: number, l: any) => s + (Number(l.line_total) || 0), 0)
        : directCost * ((Number(est.prelims_pct) || 0) / 100);
    const totalBudget  = directCost + prelims;
    const oh           = totalBudget * ((Number(est.overhead_pct) || 0) / 100);
    const risk         = (totalBudget + oh) * ((Number(est.risk_pct) || 0) / 100);
    const profit       = (totalBudget + oh + risk) * ((Number(est.profit_pct) || 0) / 100);
    const preDiscount  = totalBudget + oh + risk + profit;
    return preDiscount - preDiscount * ((Number(est.discount_pct) || 0) / 100);
}

function computeBudgetCost(est: any, lines: any[]): number {
    if (!est) return 0;
    const nonPrelims   = lines.filter((l: any) => l.trade_section !== "Preliminaries");
    const prelimsLines = lines.filter((l: any) => l.trade_section === "Preliminaries");
    const directCost   = nonPrelims.reduce((s: number, l: any) => s + (Number(l.line_total) || 0), 0);
    const prelims      = prelimsLines.length > 0
        ? prelimsLines.reduce((s: number, l: any) => s + (Number(l.line_total) || 0), 0)
        : directCost * ((Number(est.prelims_pct) || 0) / 100);
    return directCost + prelims;
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
            .select("amount, expense_date, trade_section, cost_type")
            .eq("project_id", activeProjectId),
        supabase.from("invoices")
            .select("id, amount, status, type, created_at, description")
            .eq("project_id", activeProjectId)
            .order("created_at", { ascending: false }),
        supabase.from("variations")
            .select("amount, status")
            .eq("project_id", activeProjectId),
    ]);

    if (!project) {
        return <div className="p-8 text-slate-400">Project not found.</div>;
    }

    // ── Financials ──────────────────────────────────────────────────────────────
    const activeEstimate = (estimates ?? []).find((e: any) => e.is_active) ?? (estimates ?? [])[0] ?? null;
    const lines: any[]   = activeEstimate?.estimate_lines ?? [];

    const contractValue  = computeContractValue(activeEstimate, lines);
    const budgetCost     = computeBudgetCost(activeEstimate, lines);
    const costsPosted    = (expenses ?? []).reduce((s: number, e: any) => s + Number(e.amount), 0);
    const invoicedTotal  = (invoices ?? []).reduce((s: number, i: any) => s + Number(i.amount), 0);
    const receivedTotal  = (invoices ?? []).filter((i: any) => i.status === "Paid").reduce((s: number, i: any) => s + Number(i.amount), 0);
    const approvedVars   = (variations ?? []).filter((v: any) => v.status === "Approved").reduce((s: number, v: any) => s + Number(v.amount), 0);
    const outstandingAmt = invoicedTotal - receivedTotal;
    const outstandingInvoices = (invoices ?? []).filter((i: any) => i.status !== "Paid");

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
    const burnPct = budgetCost > 0 ? (costsPosted / budgetCost) * 100 : 0;
    const budgetRag = burnPct > 100 ? "red" : burnPct > 85 ? "amber" : "green";
    const programmeRag = programmePct > 100 ? "red" : programmePct > 90 ? "amber" : "green";
    const overallRag = budgetRag === "red" || programmeRag === "red" ? "red"
        : budgetRag === "amber" || programmeRag === "amber" ? "amber" : "green";

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
            />
        </div>
    );
}
