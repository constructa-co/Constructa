import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProjectNavBar from "@/components/project-navbar";
import ClientEditor from "./client-editor";
import ProjectPicker from "@/components/project-picker";
import type { ProposalVersionRow } from "./actions";

export const dynamic = "force-dynamic";

export default async function ProposalPage({ searchParams }: { searchParams: { projectId: string } }) {
    const supabase = createClient();

    // Auth check
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user ?? null;
    if (!user) redirect("/login");

    const { projectId } = searchParams;

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
                targetPath="/dashboard/projects/proposal"
                title="Proposal Editor"
                description="Select a project to edit and send your proposal"
            />
        );
    }

    // Fetch project — scoped to user_id
    const { data: project } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .eq("user_id", user.id)
        .single();

    // Fetch estimates — scoped to project_id
    const { data: estimates } = await supabase
        .from("estimates")
        .select("*, estimate_lines(*)")
        .eq("project_id", projectId);

    // Calculate estimated total from all estimates
    const estimatedTotal = (estimates || []).reduce((sum: number, est: any) => {
        return sum + (est.total_cost || 0);
    }, 0);

    // Fetch profile with all capability fields
    const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    // Fetch proposal version history (newest first)
    const { data: versions } = await supabase
        .from("proposal_versions")
        .select("id, project_id, version_number, notes, snapshot, created_at")
        .eq("project_id", projectId)
        .order("version_number", { ascending: false });

    return (
        <div className="max-w-7xl mx-auto px-6 py-8 min-h-screen">
            <div className="flex flex-col gap-4 mb-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-100">Proposal Editor</h1>
                        <p className="text-slate-500 text-sm mt-0.5">
                            Drafting for: <span className="font-semibold text-slate-300">{project?.name}</span>
                        </p>
                    </div>
                </div>
                <ProjectNavBar projectId={projectId} activeTab="proposal" />
            </div>
            <ClientEditor
                projectId={projectId}
                initialScope={project?.scope_text || ""}
                initialExclusions={project?.exclusions_text || ""}
                initialClarifications={project?.clarifications_text || ""}
                initialBriefScope={project?.brief_scope || ""}
                initialContractExclusions={project?.contract_exclusions || ""}
                initialContractClarifications={project?.contract_clarifications || ""}
                estimates={estimates || []}
                project={project}
                profile={profile}
                estimatedTotal={estimatedTotal}
                proposalVersions={(versions || []) as ProposalVersionRow[]}
                currentVersionNumber={project?.current_version_number ?? 1}
            />
        </div>
    );
}
