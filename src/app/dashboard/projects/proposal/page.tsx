import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId } from "@/lib/supabase/auth-utils";
import Link from "next/link";
import ProjectNavBar from "@/components/project-navbar";
import ProposalPdfButton from "./proposal-pdf-button";
import ClientEditor from "./client-editor";

export const dynamic = "force-dynamic";

export default async function ProposalPage({ searchParams }: { searchParams: { projectId: string } }) {
    const supabase = createClient();
    const orgId = await getActiveOrganizationId();
    const { projectId } = searchParams;

    if (!projectId) return <div>Missing Project ID</div>;

    // 1. FETCH ALL DATA NEEDED FOR PDF (Scoping to orgId for security)
    const { data: project } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .eq("organization_id", orgId)
        .single();

    const { data: estimates } = await supabase
        .from("estimates")
        .select("*, estimate_lines(*)")
        .eq("project_id", projectId)
        .eq("organization_id", orgId);

    const { data: { user } } = await supabase.auth.getUser();
    let profile = null;
    if (user) {
        const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
        profile = data;
    }

    return (
        <div className="max-w-6xl mx-auto p-8 h-screen flex flex-col">
            {/* HEADER WITH NAV */}
            <div className="flex flex-col gap-4 mb-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold">Proposal Editor</h1>
                        <p className="text-muted-foreground text-slate-500">Drafting for: <span className="font-semibold text-black">{project?.name}</span></p>
                    </div>
                    {/* THE PDF BUTTON - NOW AVAILABLE HERE */}
                    <ProposalPdfButton
                        estimates={estimates || []}
                        project={project}
                        profile={profile}
                    />
                </div>

                {/* THE NEW NAV BAR */}
                <ProjectNavBar projectId={projectId} activeTab="proposal" />
            </div>

            {/* THE EDITOR FORM (Must be Client Component) */}
            <ClientEditor
                projectId={projectId}
                initialScope={project?.scope_text || ""}
                initialExclusions={project?.exclusions_text || ""}
                initialClarifications={project?.clarifications_text || ""}
            />
        </div>
    );
}
