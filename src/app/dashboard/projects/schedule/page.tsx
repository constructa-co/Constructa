import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProjectNavBar from "@/components/project-navbar";
import ClientSchedulePage from "./client-page";

export const dynamic = "force-dynamic";

export default async function SchedulePage({ searchParams }: { searchParams: { projectId?: string } }) {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;

    if (!user) redirect("/login");

    // Fetch all projects for the switcher
    const { data: allProjects } = await supabase
        .from("projects")
        .select("id, name")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

    const activeProjectId = searchParams.projectId || allProjects?.[0]?.id;

    // Fetch active project
    const { data: project } = await supabase
        .from("projects")
        .select("*")
        .eq("id", activeProjectId)
        .single();

    if (!project) {
        return <div className="p-8 text-slate-400">No projects found. Create one in the dashboard first.</div>;
    }

    // Fetch active estimate with lines and components (for manhours)
    const { data: estimates } = await supabase
        .from("estimates")
        .select("*, estimate_lines(*, estimate_line_components(*))")
        .eq("project_id", project.id)
        .order("created_at");

    // Use whatever estimate is marked active — if the client BoQ has been imported it
    // will be set as active and its sections become the programme phases.
    const activeEstimate =
        (estimates || []).find((e: any) => e.is_active) ||
        (estimates || [])[0] ||
        null;

    return (
        <div className="max-w-7xl mx-auto p-8 pt-24 space-y-8">
            <ProjectNavBar projectId={activeProjectId} activeTab="programme" />

            <ClientSchedulePage
                project={project}
                estimate={activeEstimate}
                projectId={activeProjectId}
            />
        </div>
    );
}
