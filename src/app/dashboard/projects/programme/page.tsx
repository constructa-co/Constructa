import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProjectPicker from "@/components/project-picker";
import ProgrammeClient from "./programme-client";
import Link from "next/link";
import ProgrammeOverview from "@/components/programme-overview";
import { computeRelativeProgramme, hasRelativeProgramme } from "@/lib/relative-programme";
import { readProgrammeInclusion } from "@/lib/programme-inclusion";

export const dynamic = "force-dynamic";

export default async function AsBuiltProgrammePage(props: { searchParams: Promise<{ projectId: string }> }) {
    const searchParams = await props.searchParams;
    const supabase = await createClient();
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
                targetPath="/dashboard/projects/programme"
                title="Live Programme"
                description="Select a project to view its as-built programme"
            />
        );
    }

    const { data: project } = await supabase
        .from("projects")
        .select("id, name, start_date, programme_phases")
        .eq("id", projectId)
        .eq("user_id", user.id)
        .single();

    const inclusion = readProgrammeInclusion(project?.programme_phases);
    if (inclusion.intent === "invalid") return <p role="alert">Check the programme inclusion choice in Programme before using live tracking.</p>;
    if (hasRelativeProgramme(inclusion.phases)) {
        const plan = computeRelativeProgramme(inclusion.phases);
        return (
            <div className="max-w-7xl mx-auto p-8 space-y-6" data-relative-live-programme>
                <h1 className="text-2xl font-bold text-white">Programme: {project?.name}</h1>
                <p className="text-slate-300">Start date not agreed. Live date tracking is unavailable until you explicitly save a dated programme. Your relative activities have not been changed.</p>
                {plan ? <ProgrammeOverview plan={plan} isDark /> : <p role="alert">The relative programme needs checking in Programme.</p>}
                <Link href={`/dashboard/projects/schedule?projectId=${encodeURIComponent(projectId)}`} className="inline-flex min-h-11 items-center text-emerald-300 underline">Open Programme</Link>
            </div>
        );
    }

    const phases: any[] = inclusion.phases;

    return (
        <div className="max-w-7xl mx-auto p-8 space-y-6">
            <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="h-6 w-6 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-white">Live Programme</h1>
                    <p className="text-slate-400 text-sm mt-0.5">
                        As-built vs baseline — <span className="text-slate-300">{project?.name}</span>
                    </p>
                </div>
            </div>

            {inclusion.intent === "omit" && <p className="text-sm text-slate-300">This programme is deliberately excluded from the proposal. These retained activities are for project tracking; editing them does not re-include the programme.</p>}
            <ProgrammeClient
                projectId={projectId}
                projectName={project?.name ?? ""}
                startDate={project?.start_date ?? null}
                initialPhases={phases}
            />
        </div>
    );
}
