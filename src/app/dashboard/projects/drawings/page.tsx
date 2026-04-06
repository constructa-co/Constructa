import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProjectNavBar from "@/components/project-navbar";
import DrawingsClient from "./drawings-client";
import { getDrawingExtractionsAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function DrawingsPage({ searchParams }: { searchParams: { projectId?: string } }) {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;

    if (!user) redirect("/login");

    // Fetch all projects for project context
    const { data: allProjects } = await supabase
        .from("projects")
        .select("id, name")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

    const activeProjectId = searchParams.projectId || allProjects?.[0]?.id;

    if (!activeProjectId) {
        return (
            <div className="p-8 text-slate-400">
                No projects found. Create one in the dashboard first.
            </div>
        );
    }

    // Fetch active project
    const { data: project } = await supabase
        .from("projects")
        .select("id, name")
        .eq("id", activeProjectId)
        .eq("user_id", user.id)
        .single();

    if (!project) {
        return (
            <div className="p-8 text-slate-400">
                Project not found.
            </div>
        );
    }

    // Fetch existing extractions for this project
    const extractions = await getDrawingExtractionsAction(activeProjectId);

    return (
        <div className="max-w-6xl mx-auto px-4 py-6">
            <ProjectNavBar projectId={activeProjectId} activeTab="drawings" />
            <DrawingsClient
                projectId={activeProjectId}
                projectName={project.name}
                initialExtractions={extractions}
            />
        </div>
    );
}
