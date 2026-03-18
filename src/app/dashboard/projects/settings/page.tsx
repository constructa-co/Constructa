import { createClient } from "@/lib/supabase/server";
import ClientProjectSettings from "./client-page";

export const dynamic = "force-dynamic";

export default async function ProjectSettingsPage() {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;

    if (!user) {
        return <div>Please log in.</div>;
    }

    // Get Latest Project
    const { data: project } = await supabase
        .from("projects")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

    if (!project) {
        return <div className="p-8 text-slate-500">No active project found. Please create an estimate first.</div>;
    }

    return <ClientProjectSettings project={project} />;
}


