import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProjectNavBar from "@/components/project-navbar";
import ProjectPicker from "@/components/project-picker";
import { getPrecontractEditLockReason } from "@/lib/project-editability";
import type { ProposalPublicationEstimateInput } from "@/lib/proposal-publication";
import ReviewSendClient, { type CaseStudyOption } from "./review-send-client";
import type { ProposalPublicationHistoryRow } from "./publication-history-panel";

export const dynamic = "force-dynamic";

export default async function ProposalPage(props: { searchParams: Promise<{ projectId: string }> }) {
    const searchParams = await props.searchParams;
    const supabase = await createClient();

    // Auth check
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user ?? null;
    if (!user) redirect("/login");

    const { projectId } = searchParams;

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
                targetPath="/dashboard/projects/proposal"
                title="Proposal"
                description="Select a project to review and send its proposal"
            />
        );
    }

    // Fetch project — scoped to user_id
    const { data: project } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .eq("user_id", user.id)
        .single();

    if (!project) {
        return <div className="p-8 text-slate-400">Project not found.</div>;
    }

    // The estimate the proposal is priced from: the one marked active.
    const { data: estimates } = await supabase
        .from("estimates")
        .select("*, estimate_lines(id, trade_section, description, quantity, unit, line_total)")
        .eq("project_id", projectId)
        .eq("is_active", true);
    const activeEstimates = estimates ?? [];
    const estimate = activeEstimates.length === 1 ? (activeEstimates[0] as ProposalPublicationEstimateInput) : null;
    const estimateIssue = activeEstimates.length > 1
        ? "More than one estimate is marked as the one used in the proposal. Choose one in Estimating before you send."
        : null;

    const { data: profile } = await supabase
        .from("profiles")
        .select("company_name, logo_url, phone, website, accreditations, capability_statement, years_trading, specialisms, insurance_details, pdf_theme, md_name, md_message, case_studies")
        .eq("id", user.id)
        .single();

    // Published history is immutable and distinct from the editable draft.
    const { data: publications } = await supabase
        .from("proposal_publications")
        .select("id, version_number, status, sent_at, expires_at, first_viewed_at, responded_at, responded_by, superseded_by, snapshot_hash, response_kind:snapshot->response->>kind, response_mode:snapshot->publication->>response_mode")
        .eq("project_id", projectId)
        .order("version_number", { ascending: false });

    const caseStudies: CaseStudyOption[] = (Array.isArray(profile?.case_studies) ? profile.case_studies : [])
        .map((entry: unknown, index: number) => {
            const study = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
            return {
                id: typeof study.id === "string" && study.id ? study.id : String(index),
                index,
                title: typeof study.projectName === "string" ? study.projectName.trim() : "",
                projectType: typeof study.projectType === "string" ? study.projectType.trim() : "",
            };
        })
        .filter((study: CaseStudyOption) => study.title !== "");

    const history = (publications ?? []) as unknown as ProposalPublicationHistoryRow[];

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-8 pt-4 sm:pt-8 pb-16">
            <ProjectNavBar projectId={projectId} activeTab="proposal" />
            <ReviewSendClient
                context={{
                    project,
                    profile: profile ?? {},
                    estimate,
                    nextVersion: (history[0]?.version_number ?? 0) + 1,
                }}
                caseStudies={caseStudies}
                lockReason={getPrecontractEditLockReason(project)}
                estimateIssue={estimateIssue}
                publications={history}
            />
        </div>
    );
}
