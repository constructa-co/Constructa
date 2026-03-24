import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProjectNavBar from "@/components/project-navbar";
import ClientEditor from "./client-editor";

export const dynamic = "force-dynamic";

export default async function ProposalPage({ searchParams }: { searchParams: { projectId: string } }) {
    const supabase = createClient();

    // Auth check
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user ?? null;
    if (!user) {
        redirect('/login');
    }

    const { projectId } = searchParams;
    if (!projectId) return <div className="p-8 text-slate-400">Missing Project ID</div>;

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

    // Fetch profile with all new capability fields
    const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    return (
        <div className="max-w-6xl mx-auto p-8 min-h-screen flex flex-col">
            <div className="flex flex-col gap-4 mb-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Proposal Editor</h1>
                        <p className="text-slate-500">Drafting for: <span className="font-semibold text-slate-800">{project?.name}</span></p>
                    </div>
                </div>
                <ProjectNavBar projectId={projectId} activeTab="proposal" />
            </div>
            <ClientEditor
                projectId={projectId}
                initialScope={project?.scope_text || ""}
                initialExclusions={project?.exclusions_text || ""}
                initialClarifications={project?.clarifications_text || ""}
                estimates={estimates || []}
                project={project}
                profile={profile}
            />
        </div>
    );
}
