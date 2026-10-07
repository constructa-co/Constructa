import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProjectNavBar from "@/components/project-navbar";
import { getPrecontractEditLockReason } from "@/lib/project-editability";
import SimpleProgrammeClient from "./simple-programme-client";

export const dynamic = "force-dynamic";

export default async function SchedulePage(props: { searchParams: Promise<{ projectId?: string }> }) {
    const searchParams = await props.searchParams;
    const supabase = await createClient();
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
        .eq("user_id", user.id)
        .single();

    if (!project) {
        return <div className="p-8 text-slate-400">No projects found. Create one in the dashboard first.</div>;
    }

    // The active estimate with lines and components. Only the detailed planner
    // uses it, to suggest stage lengths from man-hours.
    const { data: estimates } = await supabase
        .from("estimates")
        .select("*, estimate_lines(*, estimate_line_components(*))")
        .eq("project_id", project.id)
        .order("created_at");

    const activeEstimate =
        (estimates || []).find((e: { is_active?: boolean }) => e.is_active) ||
        (estimates || [])[0] ||
        null;

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-8 pt-4 sm:pt-8 pb-16">
            <ProjectNavBar projectId={activeProjectId} activeTab="programme" />

            <SimpleProgrammeClient
                project={project}
                lockReason={getPrecontractEditLockReason(project)}
                estimate={activeEstimate}
            />
        </div>
    );
}
