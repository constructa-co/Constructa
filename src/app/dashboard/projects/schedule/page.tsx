import { createClient } from "@/lib/supabase/server";
import ClientSchedulePage from "./client-page";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return <div>Please log in</div>;

    // 1. Fetch Active Project
    const { data: project } = await supabase.from("projects").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).single();
    if (!project) return <div>No active project.</div>;

    // 2. Fetch Estimates & Dependencies
    const { data: estimates } = await supabase.from("estimates").select("*, estimate_lines(*)").eq("project_id", project.id);
    const { data: dependencies } = await supabase.from("estimate_dependencies").select("*");

    if (!estimates) return <div>No Estimates</div>;

    return <ClientSchedulePage project={project} estimates={estimates} dependencies={dependencies || []} />;
}
