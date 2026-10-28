import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardRouteShell from "@/components/dashboard-route-shell";
import ProjectNavBar from "@/components/project-navbar";
import ProjectEntry from "@/components/project-entry";
import { getPrecontractEditLockReason } from "@/lib/project-editability";
import SimpleProgrammeClient from "./simple-programme-client";
import { jobAssistantAvailability } from "@/lib/server/job-assistant-transport";

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

    // Canonicalise the project identity before mounting any editable job state.
    if (searchParams.projectId === undefined) {
        if (!allProjects?.length) return <div className="p-8 text-slate-400">No projects found. Create one in the dashboard first.</div>;
        return <ProjectEntry projects={allProjects} path="/dashboard/projects/schedule" />;
    }
    const activeProjectId = searchParams.projectId;

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

    // Reuse selected-estimate names in simple stage drafts; the detailed planner
    // also uses these existing lines/components for its stage-length suggestions.
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
        <DashboardRouteShell header={<ProjectNavBar projectId={activeProjectId} projectName={project.name || ""} activeTab="programme" />}>
            <SimpleProgrammeClient
                key={project.id}
                project={project}
                lockReason={getPrecontractEditLockReason(project)}
                planningAssistantEnabled={jobAssistantAvailability().planning}
                estimate={activeEstimate}
            />
        </DashboardRouteShell>
    );
}
