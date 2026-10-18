import { createClient } from "@/lib/supabase/server";
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

    let query = supabase
        .from("projects")
        .select("*")
        .eq("user_id", user.id);

    if (projectId) query = query.eq("id", projectId);

    const { data: project } = await query
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

    if (!project) {
        return <div className="p-8 text-slate-500">No active project found. Please create an estimate first.</div>;
    }

    return <ClientProjectSettings key={project.id} project={project} />;
}


