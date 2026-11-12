import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardRouteShell from "@/components/dashboard-route-shell";
import ProjectNavBar from "@/components/project-navbar";
import ProjectEntry from "@/components/project-entry";
import EstimateClient from "./estimate-client";
import { toEstimate } from "./estimate-mapping";
import { getPrecontractEditLockReason } from "@/lib/project-editability";
import { loadPricingExperienceSource } from "@/lib/server/pricing-experience";
import { jobAssistantReadiness } from "@/lib/server/job-assistant-transport";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // BoQ import (GPT-4o Vision PDF / Excel AI parse) can take 20-40s

export default async function EstimatingPage(props: { searchParams: Promise<{ projectId?: string; tab?: string }> }) {
    const searchParams = await props.searchParams;
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;

    if (!user) redirect("/login");

    // Fetch all projects for the switcher
    const { data: allProjects } = await supabase
        .from("projects")
        .select("id, name")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

    // Canonicalise the project identity before mounting any editable job state.
    if (searchParams.projectId === undefined) {
        if (!allProjects?.length) return <div className="p-8 text-slate-400">No projects found. Create one in the dashboard first.</div>;
        return <ProjectEntry projects={allProjects} path="/dashboard/projects/costs" />;
    }
    const activeProjectId = searchParams.projectId;

    // Fetch active project
    const { data: project } = await supabase
        .from("projects")
        .select("id, user_id, name, client_name, brief_scope, brief_trade_sections, payment_schedule, status, is_archived, proposal_status, proposal_accepted_at, exclusions_text, clarifications_text, contract_exclusions, contract_clarifications, proposal_introduction, scope_text, selected_case_study_ids")
        .eq("id", activeProjectId)
        .single();

    if (!project) {
        return <div className="p-8 text-slate-400">No projects found. Create one in the dashboard first.</div>;
    }

    // Estimates with lines and components. A blank project has none, and
    // none is created until the contractor saves a first price line. The cost
    // library, labour rates and rate build-ups are loaded on demand when
    // Advanced estimating is opened.
    const { data: estimates } = await supabase
        .from("estimates")
        .select("*, estimate_lines(*, estimate_line_components(*))")
        .eq("project_id", project.id)
        .order("created_at");

    const experience = await loadPricingExperienceSource(supabase, user.id, project.selected_case_study_ids);
    const assistant = await jobAssistantReadiness("pricing", { owner: project.user_id === user.id });

    return (
        <DashboardRouteShell header={<ProjectNavBar projectId={activeProjectId} projectName={project.name || ""} activeTab="estimating" />}>
            <EstimateClient
                key={project.id}
                defaultTabId={searchParams.tab}
                pricingAssistantEnabled={assistant.available}
                pricingAssistantOffReason={assistant.offReason}
                estimates={(estimates || []).map(toEstimate)}
                project={{
                    id: project.id,
                    name: project.name || "",
                    client_name: project.client_name || "",
                    brief_scope: project.brief_scope || "",
                    brief_trade_sections: project.brief_trade_sections ?? [],
                    payment_schedule: project.payment_schedule ?? null,
                    proposal_introduction: project.proposal_introduction ?? null,
                    experience,
                    full_scope: { scope_text: project.scope_text ?? null, brief_scope: project.brief_scope ?? null },
                    payment_lock_reason: getPrecontractEditLockReason(project),
                    scope_notes: {
                        exclusions_text: project.exclusions_text ?? null, clarifications_text: project.clarifications_text ?? null,
                        contract_exclusions: project.contract_exclusions ?? null, contract_clarifications: project.contract_clarifications ?? null,
                    },
                }}
            />
        </DashboardRouteShell>
    );
}
