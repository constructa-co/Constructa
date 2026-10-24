import { createClient } from "@/lib/supabase/server";
import ProjectEntry from "@/components/project-entry";
import ClientProjectSettings from "./client-page";

export const dynamic = "force-dynamic";

export default async function ProjectSettingsPage(props: { searchParams: Promise<{ projectId?: string }> }) {
    const { projectId } = await props.searchParams;
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;

    if (!user) {
        return <div>Please log in.</div>;
    }

    // Resolve browser project memory into the URL before mounting editable details.
    if (projectId === undefined) {
        const { data: projects } = await supabase
            .from("projects")
            .select("id, name")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });
        return <ProjectEntry projects={projects ?? []} path="/dashboard/projects/settings" />;
    }

    const { data: project } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .eq("user_id", user.id)
        .single();

    if (!project) {
        return <div className="p-8 text-slate-500">No active project found. Please create an estimate first.</div>;
    }

    return <ClientProjectSettings key={project.id} project={project} />;
}


