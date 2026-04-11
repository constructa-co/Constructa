import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ClientBilling from "./client-billing";
import ProjectPicker from "@/components/project-picker";

export const dynamic = "force-dynamic";

export default async function BillingPage({ searchParams }: { searchParams: { projectId: string } }) {
    const supabase = createClient();
    const { projectId } = searchParams;

    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) redirect("/login");

    if (!projectId) {
        const { data: projects } = await supabase
            .from("projects")
            .select("id, name, client_name, project_type, proposal_status, potential_value, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(25);
        return (
            <ProjectPicker
                projects={projects ?? []}
                targetPath="/dashboard/projects/billing"
                title="Billing & Invoicing"
                description="Select a project to manage invoices and payment applications"
            />
        );
    }

    const [
        { data: project },
        { data: estimates },
        { data: variations },
        { data: invoices },
        { data: milestones },
    ] = await Promise.all([
        supabase.from("projects").select("*").eq("id", projectId).single(),
        supabase.from("estimates").select("id, total_cost, is_active, prelims_pct, overhead_pct, risk_pct, profit_pct, discount_pct, estimate_lines(trade_section, line_total)").eq("project_id", projectId),
        supabase.from("variations").select("*").eq("project_id", projectId).eq("status", "Approved"),
        supabase.from("invoices").select("*").eq("project_id", projectId).order("created_at", { ascending: true }),
        supabase.from("payment_schedule_milestones").select("*").eq("project_id", projectId).order("order_index", { ascending: true }),
    ]);

    // Contract value — canonical QS hierarchy that matches the Proposal PDF and
    // client-editor.tsx computeEstimateContractSum(): direct cost + prelims first,
    // THEN overhead/risk/profit compounded, THEN discount.
    const activeEstimate = (estimates || []).find((e: any) => e.is_active) || (estimates || [])[0];
    let originalContractSum = 0;
    if (activeEstimate) {
        const lines: any[] = activeEstimate.estimate_lines || [];
        const directCost = lines
            .filter((l) => l.trade_section !== "Preliminaries" && (l.line_total || 0) > 0)
            .reduce((s, l) => s + Number(l.line_total || 0), 0);
        const explicitPrelims = lines
            .filter((l) => l.trade_section === "Preliminaries")
            .reduce((s, l) => s + Number(l.line_total || 0), 0);
        // Fall back to total_cost if there are no line records at all (legacy estimates).
        const fallbackBase = directCost > 0 ? directCost : (Number(activeEstimate.total_cost) || 0);
        const prelimsFromPct = fallbackBase * ((Number(activeEstimate.prelims_pct) || 0) / 100);
        const prelimsTotal = explicitPrelims > 0 ? explicitPrelims : prelimsFromPct;
        const totalConstruction = fallbackBase + prelimsTotal;
        const overhead = totalConstruction * ((Number(activeEstimate.overhead_pct) || 0) / 100);
        const costPlusOverhead = totalConstruction + overhead;
        const risk = costPlusOverhead * ((Number(activeEstimate.risk_pct) || 0) / 100);
        const adjusted = costPlusOverhead + risk;
        const profit = adjusted * ((Number(activeEstimate.profit_pct) || 0) / 100);
        const preDiscount = adjusted + profit;
        const discount = preDiscount * ((Number(activeEstimate.discount_pct) || 0) / 100);
        originalContractSum = Math.round((preDiscount - discount) * 100) / 100;
    } else {
        originalContractSum = (estimates || []).reduce((s: number, e: any) => s + (Number(e.total_cost) || 0), 0);
    }

    const approvedVariationsTotal = (variations || []).reduce((s: number, v: any) => s + Number(v.amount), 0);

    return (
        <div className="max-w-6xl mx-auto p-8 space-y-6">
            <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                    </svg>
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-white">Billing & Valuations</h1>
                    <p className="text-slate-400 text-sm mt-0.5">
                        Applications for payment, retention & aged debt — <span className="text-slate-300">{project?.name}</span>
                    </p>
                </div>
            </div>

            <ClientBilling
                projectId={projectId}
                project={project}
                originalContractSum={originalContractSum}
                approvedVariationsTotal={approvedVariationsTotal}
                variations={variations || []}
                initialInvoices={invoices || []}
                initialMilestones={milestones || []}
            />
        </div>
    );
}
