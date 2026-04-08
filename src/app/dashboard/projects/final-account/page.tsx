import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProjectPicker from "@/components/project-picker";
import FinalAccountClient from "./final-account-client";

export const dynamic = "force-dynamic";

export default async function FinalAccountPage({ searchParams }: { searchParams: { projectId: string } }) {
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
                targetPath="/dashboard/projects/final-account"
                title="Final Accounts"
                description="Select a project to prepare the Final Account Statement"
            />
        );
    }

    const [
        { data: project },
        { data: estimates },
        { data: variations },
        { data: invoices },
        { data: finalAccount },
        { data: adjustments },
        { data: profile },
    ] = await Promise.all([
        supabase.from("projects").select("*").eq("id", projectId).single(),
        supabase.from("estimates").select("id, total_cost, is_active, overhead_pct, risk_pct, profit_pct, discount_pct").eq("project_id", projectId),
        supabase.from("variations").select("*").eq("project_id", projectId).order("created_at", { ascending: true }),
        supabase.from("invoices").select("*").eq("project_id", projectId).order("created_at", { ascending: true }),
        supabase.from("final_accounts").select("*").eq("project_id", projectId).maybeSingle(),
        supabase.from("final_account_adjustments").select("*").eq("project_id", projectId).order("order_index", { ascending: true }),
        supabase.from("profiles").select("company_name, address, phone, email").eq("id", user.id).single(),
    ]);

    // Original contract sum from active estimate with uplifts
    const activeEstimate = (estimates || []).find((e: any) => e.is_active) || (estimates || [])[0];
    let originalContractSum = 0;
    if (activeEstimate) {
        const base     = activeEstimate.total_cost || 0;
        const overhead = base * ((activeEstimate.overhead_pct || 0) / 100);
        const risk     = (base + overhead) * ((activeEstimate.risk_pct || 0) / 100);
        const profit   = (base + overhead + risk) * ((activeEstimate.profit_pct || 0) / 100);
        const gross    = base + overhead + risk + profit;
        originalContractSum = Math.round((gross - gross * ((activeEstimate.discount_pct || 0) / 100)) * 100) / 100;
    } else {
        originalContractSum = (estimates || []).reduce((s: number, e: any) => s + e.total_cost, 0);
    }

    return (
        <div className="max-w-5xl mx-auto p-8 space-y-6">
            <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-slate-500/10 border border-slate-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="h-6 w-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-white">Final Account Statement</h1>
                    <p className="text-slate-400 text-sm mt-0.5">
                        Complete financial settlement — <span className="text-slate-300">{project?.name}</span>
                    </p>
                </div>
            </div>

            <FinalAccountClient
                projectId={projectId}
                project={project}
                profile={profile}
                originalContractSum={originalContractSum}
                variations={variations || []}
                invoices={invoices || []}
                finalAccount={finalAccount}
                adjustments={adjustments || []}
            />
        </div>
    );
}
