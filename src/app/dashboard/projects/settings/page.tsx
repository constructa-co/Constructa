import { createClient } from "@/lib/supabase/server";
import ProjectEntry from "@/components/project-entry";
import ClientProjectSettings from "./client-page";
import { buildJobTypeDatalistOptions, priorProjectTypesFromRows } from "@/lib/job-type-datalist";

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

    const [{ data: project }, { data: profile }, { data: priorRows }] = await Promise.all([
        supabase.from("projects").select("*").eq("id", projectId).eq("user_id", user.id).single(),
        supabase.from("profiles").select("business_type, specialisms, preferred_trades").eq("id", user.id).single(),
        supabase.from("projects").select("project_type").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
    ]);

    if (!project) {
        return <div className="p-8 text-slate-500">No active project found. Please create an estimate first.</div>;
    }

    const jobTypeDatalistOptions = buildJobTypeDatalistOptions({
        priorProjectTypes: priorProjectTypesFromRows(priorRows ?? []),
        businessType: profile?.business_type,
        specialisms: profile?.specialisms,
        preferredTrades: (profile?.preferred_trades as string[] | null) ?? null,
    });

    return (
        <ClientProjectSettings
            key={project.id}
            project={project}
            jobTypeDatalistOptions={jobTypeDatalistOptions}
        />
    );
}


