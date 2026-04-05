import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProjectNavBar from "@/components/project-navbar";
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
            .select("id, name, client_name, project_type, proposal_status, potential_value, updated_at")
            .eq("user_id", user.id)
            .order("updated_at", { ascending: false })
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
        <div className="max-w-6xl mx-auto p-8 h-screen flex flex-col">
            <div className="flex flex-col gap-4 mb-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold italic">Project Variations</h1>
                        <p className="text-muted-foreground text-slate-500 uppercase text-[10px] font-black tracking-widest">
                            Scope Changes & Extra Works for: <span className="text-black">{project?.name}</span>
                        </p>
                    </div>
                </div>

                <ProjectNavBar projectId={projectId} activeTab="proposal" />
            </div>

            <ClientVariations
                projectId={projectId}
                initialVariations={variations || []}
            />
        </div>
    );
}
