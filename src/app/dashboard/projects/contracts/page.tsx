import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProjectNavBar from "@/components/project-navbar";
import ClientContractEditor from "./client-contract-editor";
import ProjectPicker from "@/components/project-picker";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // extend Vercel function timeout for AI calls (Pro plan: up to 60s)

export default async function ContractsPage({ searchParams }: { searchParams: { projectId: string } }) {
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
                targetPath="/dashboard/projects/contracts"
                title="Contracts"
                description="Select a project to manage T&Cs, risk register and Contract Shield review"
            />
        );
    }

    const { data: project } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .eq("user_id", user.id)
        .single();

    const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    return (
        <div className="max-w-7xl mx-auto px-6 py-8 min-h-screen">
            <div className="flex flex-col gap-4 mb-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-100">Contracts</h1>
                        <p className="text-sm text-slate-400 mt-0.5">
                            Managing contracts for: <span className="font-semibold text-slate-200">{project?.name}</span>
                        </p>
                    </div>
                </div>
                <ProjectNavBar projectId={projectId} activeTab="contracts" />
            </div>

            <ClientContractEditor
                projectId={projectId}
                project={project}
                profile={profile}
            />
        </div>
    );
}
