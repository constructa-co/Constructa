import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ClientVariations from "./client-variations";
import ProjectPicker from "@/components/project-picker";

export const dynamic = "force-dynamic";

export default async function VariationsPage({ searchParams }: { searchParams: { projectId: string } }) {
    const supabase = createClient();
    const { projectId } = searchParams;

    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) redirect("/login");

    if (!projectId) {
        const { data: projects } = await supabase
            .from("projects")
            .select("id, name, client_name, project_type, proposal_status, potential_value, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(25);
        return (
            <ProjectPicker
                projects={projects ?? []}
                targetPath="/dashboard/projects/variations"
                title="Project Variations"
                description="Select a project to log and manage scope changes"
            />
        );
    }

    const { data: project } = await supabase.from("projects").select("*").eq("id", projectId).single();
    const { data: variations } = await supabase.from("variations").select("*").eq("project_id", projectId).order('created_at', { ascending: false });

    return (
        <div className="max-w-6xl mx-auto p-8 space-y-6">
            {/* Hero */}
            <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="h-6 w-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-white">Project Variations</h1>
                    <p className="text-slate-400 text-sm mt-0.5">
                        Scope changes & extra works — <span className="text-slate-300">{project?.name}</span>
                    </p>
                </div>
            </div>

            <ClientVariations
                projectId={projectId}
                project={project}
                initialVariations={variations || []}
            />
        </div>
    );
}
