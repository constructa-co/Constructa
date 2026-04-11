import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProjectPicker from "@/components/project-picker";
import LessonsClient from "./lessons-client";

export const dynamic = "force-dynamic";

export default async function LessonsLearnedPage({ searchParams }: { searchParams: { projectId: string } }) {
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
                targetPath="/dashboard/projects/lessons-learned"
                title="Lessons Learned"
                description="Select a project to write its post-project review"
            />
        );
    }

    const [
        { data: project },
        { data: review },
        { data: items },
    ] = await Promise.all([
        supabase.from("projects").select("*").eq("id", projectId).single(),
        supabase.from("lessons_learned").select("*").eq("project_id", projectId).maybeSingle(),
        supabase.from("lesson_items").select("*").eq("project_id", projectId).order("order_index", { ascending: true }),
    ]);

    return (
        <div className="max-w-5xl mx-auto p-8 space-y-6">
            <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="h-6 w-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-white">Lessons Learned</h1>
                    <p className="text-slate-400 text-sm mt-0.5">
                        Post-project review — <span className="text-slate-300">{project?.name}</span>
                    </p>
                </div>
            </div>

            <LessonsClient
                projectId={projectId}
                project={project}
                review={review}
                initialItems={items ?? []}
            />
        </div>
    );
}
