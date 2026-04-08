import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProjectPicker from "@/components/project-picker";
import ChangeManagementClient from "./change-management-client";

export const dynamic = "force-dynamic";

export default async function ChangeManagementPage({ searchParams }: { searchParams: { projectId: string } }) {
    const supabase = createClient();
    const { projectId } = searchParams;

    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) redirect("/login");

    if (!projectId) {
        const { data: projects } = await supabase
            .from("projects")
            .select("id, name, client_name, project_type, proposal_status, potential_value, updated_at")
            .eq("user_id", user.id)
            .order("updated_at", { ascending: false })
            .limit(25);
        return (
            <ProjectPicker
                projects={projects ?? []}
                targetPath="/dashboard/projects/change-management"
                title="Change Management"
                description="Select a project to view its change control register"
            />
        );
    }

    const [
        { data: project },
        { data: changeEvents },
    ] = await Promise.all([
        supabase.from("projects").select("*").eq("id", projectId).single(),
        supabase.from("change_events").select("*").eq("project_id", projectId).order("created_at", { ascending: true }),
    ]);

    return (
        <div className="max-w-6xl mx-auto p-8 space-y-6">
            <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="h-6 w-6 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-white">Change Management</h1>
                    <p className="text-slate-400 text-sm mt-0.5">
                        Change control register — <span className="text-slate-300">{project?.name}</span>
                    </p>
                </div>
            </div>

            <ChangeManagementClient
                projectId={projectId}
                project={project}
                initialEvents={changeEvents ?? []}
            />
        </div>
    );
}
