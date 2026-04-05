import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ClientPLDashboard from "./client-pl-dashboard";

export const dynamic = "force-dynamic";

export default async function PLPage({ searchParams }: { searchParams: { projectId: string } }) {
    const supabase = createClient();
    const { projectId } = searchParams;

    if (!projectId) return <div className="p-8 text-slate-400">Missing Project ID</div>;

    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) redirect("/login");

    // Fetch all data in parallel
    const [
        { data: project },
        { data: estimates },
        { data: expenses },
        { data: invoices },
        { data: variations },
    ] = await Promise.all([
        supabase.from("projects").select("id, name, client_name, site_address").eq("id", projectId).eq("user_id", user.id).single(),
        supabase.from("estimates").select("*, estimate_lines(*)").eq("project_id", projectId),
        supabase.from("project_expenses").select("*").eq("project_id", projectId).order("expense_date", { ascending: false }),
        supabase.from("invoices").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
        supabase.from("variations").select("*").eq("project_id", projectId),
    ]);

    if (!project) redirect("/dashboard");

    // ── Budget calculations (from active estimate) ──────────────────────────
    const activeEstimate = estimates?.find((e: any) => e.is_active) ?? estimates?.[0] ?? null;
    const lines: any[] = activeEstimate?.estimate_lines ?? [];

    const nonPrelimsLines = lines.filter((l: any) => l.trade_section !== "Preliminaries");
    const prelimsLines   = lines.filter((l: any) => l.trade_section === "Preliminaries");

    const directCost      = nonPrelimsLines.reduce((s: number, l: any) => s + (Number(l.line_total) || 0), 0);
    const prelimsExplicit = prelimsLines.reduce((s: number, l: any) => s + (Number(l.line_total) || 0), 0);
    const prelimsPct      = Number(activeEstimate?.prelims_pct) || 0;
    const prelimsTotal    = prelimsLines.length > 0 ? prelimsExplicit : directCost * (prelimsPct / 100);
    const totalBudgetCost = directCost + prelimsTotal; // What we expect to spend (cost to contractor)

    const overheadPct   = Number(activeEstimate?.overhead_pct) || 0;
    const riskPct       = Number(activeEstimate?.risk_pct)     || 0;
    const profitPct     = Number(activeEstimate?.profit_pct)   || 0;
    const discountPct   = Number(activeEstimate?.discount_pct) || 0;

    const overheadAmt        = totalBudgetCost * (overheadPct / 100);
    const costPlusOverhead   = totalBudgetCost + overheadAmt;
    const riskAmt            = costPlusOverhead * (riskPct / 100);
    const adjustedTotal      = costPlusOverhead + riskAmt;
    const profitAmt          = adjustedTotal * (profitPct / 100);
    const preDiscountTotal   = adjustedTotal + profitAmt;
    const discountAmt        = preDiscountTotal * (discountPct / 100);
    const contractValue      = preDiscountTotal - discountAmt; // What client pays (sell price)

    // ── Budget by trade section ─────────────────────────────────────────────
    const sectionMap = new Map<string, number>();
    for (const l of lines) {
        const s = l.trade_section || "General";
        sectionMap.set(s, (sectionMap.get(s) ?? 0) + (Number(l.line_total) || 0));
    }
    const budgetBySection = Array.from(sectionMap.entries())
        .map(([section, budget]) => ({ section, budget }))
        .sort((a, b) => b.budget - a.budget);

    // ── Actual costs by trade section ───────────────────────────────────────
    const actualMap = new Map<string, number>();
    for (const e of (expenses ?? [])) {
        const s = (e.trade_section as string) || "General";
        actualMap.set(s, (actualMap.get(s) ?? 0) + (Number(e.amount) || 0));
    }
    const actualBySection = Array.from(actualMap.entries()).map(([section, actual]) => ({ section, actual }));

    // ── Financial totals ────────────────────────────────────────────────────
    const costsPosted     = (expenses ?? []).reduce((s: number, e: any) => s + Number(e.amount), 0);
    const invoicedTotal   = (invoices ?? []).reduce((s: number, i: any) => s + Number(i.amount), 0);
    const receivedTotal   = (invoices ?? []).filter((i: any) => i.status === "Paid").reduce((s: number, i: any) => s + Number(i.amount), 0);
    const approvedVarTotal = (variations ?? []).filter((v: any) => v.status === "Approved").reduce((s: number, v: any) => s + Number(v.amount), 0);

    return (
        <div className="max-w-7xl mx-auto px-6 py-8 min-h-screen">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-100">Job P&L</h1>
                <p className="text-sm text-slate-400 mt-0.5">
                    Financial position for: <span className="font-semibold text-slate-200">{project.name}</span>
                    {project.client_name && <span className="text-slate-500"> · {project.client_name}</span>}
                </p>
            </div>

            <ClientPLDashboard
                projectId={projectId}
                project={project}
                contractValue={contractValue}
                totalBudgetCost={totalBudgetCost}
                budgetBySection={budgetBySection}
                actualBySection={actualBySection}
                costsPosted={costsPosted}
                invoicedTotal={invoicedTotal}
                receivedTotal={receivedTotal}
                approvedVarTotal={approvedVarTotal}
                expenses={expenses ?? []}
                invoices={invoices ?? []}
            />
        </div>
    );
}
