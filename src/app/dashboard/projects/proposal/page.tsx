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
    if (!projectId) return <div>Missing Project ID</div>;

    // Fetch project — scoped to user_id (correct column for this schema)
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

    // Fetch profile
    let profile = null;
    const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
    profile = profileData;

    return (
        <div className="max-w-6xl mx-auto p-8 h-screen flex flex-col">
            <div className="flex flex-col gap-4 mb-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold">Proposal Editor</h1>
                        <p className="text-muted-foreground text-slate-500">Drafting for: <span className="font-semibold text-black">{project?.name}</span></p>
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
