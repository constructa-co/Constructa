import { createClient } from "@/lib/supabase/server";
import ProjectNavBar from "@/components/project-navbar";
import ClientContractEditor from "./client-contract-editor";

export const dynamic = "force-dynamic";

export default async function ContractsPage({ searchParams }: { searchParams: { projectId: string } }) {
    const supabase = createClient();
    const { projectId } = searchParams;

    if (!projectId) return <div>Missing Project ID</div>;

    // Fetch Project and Estimate data
    const { data: project } = await supabase.from("projects").select("*").eq("id", projectId).single();
    const { data: estimates } = await supabase.from("estimates").select("*").eq("project_id", projectId);

    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    let profile = null;
    if (user) {
        const { data } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
        profile = data;
    }

    return (
        <div className="max-w-6xl mx-auto p-8 h-screen flex flex-col">
            <div className="flex flex-col gap-4 mb-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold">Smart Contracts</h1>
                        <p className="text-muted-foreground text-slate-500">Legal agreement for: <span className="font-semibold text-black">{project?.name}</span></p>
                    </div>
                </div>

                <ProjectNavBar projectId={projectId} activeTab="contracts" />
            </div>

            <ClientContractEditor
                projectId={projectId}
                initialContract={project?.contract_text || ""}
                projectName={project?.name || ""}
                project={project}
                profile={profile}
            />
        </div>
    );
}
