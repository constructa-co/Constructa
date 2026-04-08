import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProjectPicker from "@/components/project-picker";
import CommunicationsClient from "./communications-client";

export const dynamic = "force-dynamic";

export default async function CommunicationsPage({ searchParams }: { searchParams: { projectId: string } }) {
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
                targetPath="/dashboard/projects/communications"
                title="Project Communications"
                description="Select a project to manage site instructions, RFIs and notices"
            />
        );
    }

    const [
        { data: project },
        { data: siteInstructions },
        { data: rfis },
        { data: ewns },
        { data: documents },
    ] = await Promise.all([
        supabase.from("projects").select("*").eq("id", projectId).single(),
        supabase.from("site_instructions").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
        supabase.from("rfis").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
        supabase.from("early_warning_notices").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
        supabase.from("document_register").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
    ]);

    return (
        <div className="max-w-6xl mx-auto p-8 space-y-6">
            <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="h-6 w-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-white">Communications</h1>
                    <p className="text-slate-400 text-sm mt-0.5">
                        Site instructions, RFIs, early warnings & document register — <span className="text-slate-300">{project?.name}</span>
                    </p>
                </div>
            </div>

            <CommunicationsClient
                projectId={projectId}
                project={project}
                initialSiteInstructions={siteInstructions || []}
                initialRfis={rfis || []}
                initialEwns={ewns || []}
                initialDocuments={documents || []}
            />
        </div>
    );
}
