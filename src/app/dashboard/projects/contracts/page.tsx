import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProjectNavBar from "@/components/project-navbar";
import ClientContractEditor from "./client-contract-editor";

export const dynamic = "force-dynamic";

export default async function ContractsPage({ searchParams }: { searchParams: { projectId: string } }) {
    const supabase = createClient();
    const { projectId } = searchParams;

    if (!projectId) return <div className="p-8 text-gray-400">Missing Project ID</div>;

    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) redirect("/login");

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
                        <h1 className="text-2xl font-bold text-gray-900">Contracts</h1>
                        <p className="text-sm text-gray-500 mt-0.5">
                            Managing contracts for: <span className="font-semibold text-gray-700">{project?.name}</span>
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
