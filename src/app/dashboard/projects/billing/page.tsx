import { createClient } from "@/lib/supabase/server";
import ProjectNavBar from "@/components/project-navbar";
import ClientBilling from "./client-billing";

export const dynamic = "force-dynamic";

export default async function BillingPage({ searchParams }: { searchParams: { projectId: string } }) {
    const supabase = createClient();
    const { projectId } = searchParams;

    if (!projectId) return <div>Missing Project ID</div>;

    // 1. Fetch Project
    const { data: project } = await supabase.from("projects").select("*").eq("id", projectId).single();

    // 2. Fetch Estimates (Original Contract Sum)
    const { data: estimates } = await supabase.from("estimates").select("total_cost").eq("project_id", projectId);
    const originalContractSum = estimates?.reduce((sum, e) => sum + e.total_cost, 0) || 0;

    // 3. Fetch Approved Variations
    const { data: variations } = await supabase.from("variations").select("*").eq("project_id", projectId).eq("status", "Approved");
    const approvedVariationsTotal = variations?.reduce((sum, v) => sum + Number(v.amount), 0) || 0;

    // 4. Fetch Invoices
    const { data: invoices } = await supabase.from("invoices").select("*").eq("project_id", projectId).order('created_at', { ascending: false });

    return (
        <div className="max-w-6xl mx-auto p-8 h-screen flex flex-col">
            <div className="flex flex-col gap-4 mb-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold italic text-slate-900 tracking-tighter">Finance & Invoicing</h1>
                        <p className="text-muted-foreground text-slate-500 uppercase text-[10px] font-black tracking-widest">
                            Final account & Payment Valuations for: <span className="text-black">{project?.name}</span>
                        </p>
                    </div>
                </div>

                <ProjectNavBar projectId={projectId} activeTab="billing" showPostCon />
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
