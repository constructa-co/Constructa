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

    const { data: project } = await supabase.from("projects").select("*").eq("id", projectId).single();
    const { data: estimates } = await supabase.from("estimates").select("total_cost").eq("project_id", projectId);
    const originalContractSum = estimates?.reduce((sum, e) => sum + e.total_cost, 0) || 0;
    const { data: variations } = await supabase.from("variations").select("*").eq("project_id", projectId).eq("status", "Approved");
    const approvedVariationsTotal = variations?.reduce((sum, v) => sum + Number(v.amount), 0) || 0;
    const { data: invoices } = await supabase.from("invoices").select("*").eq("project_id", projectId).order('created_at', { ascending: false });

    return (
        <div className="max-w-6xl mx-auto p-8 space-y-6">
            {/* Hero */}
            <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                    </svg>
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-white">Billing & Invoicing</h1>
                    <p className="text-slate-400 text-sm mt-0.5">
                        Payment valuations & final account — <span className="text-slate-300">{project?.name}</span>
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
            />
        </div>
    );
}
