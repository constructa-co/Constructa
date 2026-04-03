import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProjectNavBar from "@/components/project-navbar";
import BriefClient from "./brief-client";

export const dynamic = "force-dynamic";

// Extract postcode from site_address if separate postcode field doesn't exist
function extractPostcode(address: string): string {
    const match = address?.match(/[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2}/i);
    return match ? match[0].toUpperCase() : '';
}

export default async function BriefPage({ searchParams }: { searchParams: { projectId?: string } }) {
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

    // Fetch active estimate (to check if lines exist for "Suggest Estimate Lines")
    const { data: estimates } = await supabase
        .from("estimates")
        .select("id, version_name, is_active")
        .eq("project_id", project.id)
        .order("created_at");

    const activeEstimate = (estimates || []).find((e: any) => e.is_active) || (estimates || [])[0] || null;

    const siteAddress = project.site_address || project.address || "";
    const postcode = project.postcode || extractPostcode(siteAddress) || "";

    return (
        <div className="max-w-7xl mx-auto p-8 pt-24 space-y-8">
            <ProjectNavBar projectId={activeProjectId} activeTab="brief" />

            <BriefClient
                project={{
                    id: project.id,
                    name: project.name || "",
                    client_name: project.client_name || "",
                    site_address: siteAddress,
                    postcode,
                    potential_value: project.potential_value || 0,
                    start_date: project.start_date || "",
                    brief_scope: project.brief_scope || "",
                    brief_trade_sections: (project.brief_trade_sections as string[]) || [],
                    client_type: project.client_type || "domestic",
                    lat: project.lat || null,
                    lng: project.lng || null,
                    region: project.region || "",
                    brief_completed: project.brief_completed || false,
                    project_type: project.project_type || "",
                }}
                activeEstimateId={activeEstimate?.id || null}
                projectId={activeProjectId}
            />
        </div>
    );
}
