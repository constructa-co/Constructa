import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProjectNavBar from "@/components/project-navbar";
import EstimateClient from "./estimate-client";
import { toEstimate } from "./estimate-mapping";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // BoQ import (GPT-4o Vision PDF / Excel AI parse) can take 20-40s

export default async function EstimatingPage(props: { searchParams: Promise<{ projectId?: string; tab?: string }> }) {
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
        .select("id, name, client_name, brief_scope")
        .eq("id", activeProjectId)
        .single();

    if (!project) {
        return <div className="p-8 text-slate-400">No projects found. Create one in the dashboard first.</div>;
    }

    // Estimates with lines and components. A blank project has none, and
    // none is created until the contractor saves a first price line. The cost
    // library, labour rates and rate build-ups are loaded on demand when
    // Advanced estimating is opened.
    const { data: estimates } = await supabase
        .from("estimates")
        .select("*, estimate_lines(*, estimate_line_components(*))")
        .eq("project_id", project.id)
        .order("created_at");

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-8 pt-4 sm:pt-8 pb-16">
            <ProjectNavBar projectId={activeProjectId} activeTab="estimating" />

            <EstimateClient
                defaultTabId={searchParams.tab}
                estimates={(estimates || []).map(toEstimate)}
                project={{
                    id: project.id,
                    name: project.name || "",
                    client_name: project.client_name || "",
                    brief_scope: project.brief_scope || "",
                }}
            />
        </div>
    );
}
