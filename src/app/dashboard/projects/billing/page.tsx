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
            .select("id, name, client_name, project_type, proposal_status, potential_value, updated_at")
            .eq("user_id", user.id)
            .order("updated_at", { ascending: false })
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
        supabase.from("estimates").select("id, total_cost, is_active, overhead_pct, risk_pct, profit_pct, discount_pct").eq("project_id", projectId),
        supabase.from("variations").select("*").eq("project_id", projectId).eq("status", "Approved"),
        supabase.from("invoices").select("*").eq("project_id", projectId).order("created_at", { ascending: true }),
        supabase.from("payment_schedule_milestones").select("*").eq("project_id", projectId).order("order_index", { ascending: true }),
    ]);

    // Contract value: use active estimate with uplifts, else sum all estimates
    const activeEstimate = (estimates || []).find((e: any) => e.is_active) || (estimates || [])[0];
    let originalContractSum = 0;
    if (activeEstimate) {
        const base = activeEstimate.total_cost || 0;
        const overhead = base * ((activeEstimate.overhead_pct || 0) / 100);
        const risk     = (base + overhead) * ((activeEstimate.risk_pct || 0) / 100);
        const profit   = (base + overhead + risk) * ((activeEstimate.profit_pct || 0) / 100);
        const gross    = base + overhead + risk + profit;
        const discount = gross * ((activeEstimate.discount_pct || 0) / 100);
        originalContractSum = Math.round((gross - discount) * 100) / 100;
    } else {
        originalContractSum = (estimates || []).reduce((s: number, e: any) => s + e.total_cost, 0);
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
