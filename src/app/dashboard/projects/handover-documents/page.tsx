import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProjectPicker from "@/components/project-picker";
import HandoverClient from "./handover-client";
import { seedHandoverItemsAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function HandoverDocumentsPage({ searchParams }: { searchParams: { projectId: string } }) {
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
                targetPath="/dashboard/projects/handover-documents"
                title="Handover Documents"
                description="Select a project to manage its handover checklist"
            />
        );
    }

    // Seed standard items on first visit
    await seedHandoverItemsAction(projectId);

    const [
        { data: project },
        { data: items },
    ] = await Promise.all([
        supabase.from("projects").select("*").eq("id", projectId).single(),
        supabase.from("handover_items").select("*").eq("project_id", projectId).order("order_index", { ascending: true }),
    ]);

    return (
        <div className="max-w-5xl mx-auto p-8 space-y-6">
            <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="h-6 w-6 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-white">Handover Documents</h1>
                    <p className="text-slate-400 text-sm mt-0.5">
                        Project closeout checklist — <span className="text-slate-300">{project?.name}</span>
                    </p>
                </div>
            </div>

            <HandoverClient
                projectId={projectId}
                project={project}
                initialItems={items ?? []}
            />
        </div>
    );
}
