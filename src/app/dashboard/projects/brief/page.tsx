import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardRouteShell from "@/components/dashboard-route-shell";
import ProjectNavBar from "@/components/project-navbar";
import ProjectEntry from "@/components/project-entry";
import { getPrecontractEditLockReason } from "@/lib/project-editability";
import BriefClient from "./brief-client";
import { jobAssistantReadiness } from "@/lib/server/job-assistant-transport";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Video analysis (20 frames → GPT-4o Vision) can take 20-40s

// Extract postcode from site_address if separate postcode field doesn't exist
function extractPostcode(address: string): string {
    const match = address?.match(/[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2}/i);
    return match ? match[0].toUpperCase() : '';
}

export default async function BriefPage(props: { searchParams: Promise<{ projectId?: string }> }) {
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
        return <ProjectEntry projects={allProjects} path="/dashboard/projects/brief" />;
    }
    const activeProjectId = searchParams.projectId;

    // Fetch active project
    const { data: project } = await supabase
        .from("projects")
        .select("*")
        .eq("id", activeProjectId)
        .single();

    if (!project) {
        return <div className="p-8 text-slate-400">No projects found. Create one in the dashboard first.</div>;
    }

    const siteAddress = project.site_address || project.address || "";
    const postcode = project.postcode || extractPostcode(siteAddress) || "";
    const assistant = await jobAssistantReadiness("brief", { owner: project.user_id === user.id });

    return (
        <DashboardRouteShell header={<ProjectNavBar projectId={activeProjectId} projectName={project.name || ""} activeTab="brief" />}>
            <BriefClient
                key={project.id}
                project={{
                    id: project.id,
                    name: project.name || "",
                    client_name: project.client_name || "",
                    site_address: siteAddress,
                    postcode,
                    potential_value: project.potential_value ?? null,
                    start_date: project.start_date || "",
                    brief_scope: project.brief_scope || "",
                    brief_trade_sections: (project.brief_trade_sections as string[]) || [],
                    client_type: project.client_type || "domestic",
                    lat: project.lat ?? null,
                    lng: project.lng ?? null,
                    region: project.region || "",
                    brief_completed: project.brief_completed || false,
                }}
                lockReason={getPrecontractEditLockReason(project)}
                briefAssistantEnabled={assistant.available}
                briefAssistantOffReason={assistant.offReason}
            />
        </DashboardRouteShell>
    );
}
