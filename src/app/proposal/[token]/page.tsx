import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import AcceptanceClient from "./acceptance-client";
import { sendContractorViewedNotification } from "@/lib/email";

export const dynamic = "force-dynamic";

export default async function ProposalAcceptancePage({ params }: { params: { token: string } }) {
    const supabase = createClient();
    const { token } = params;

    // Fetch project by proposal_token — no auth required (public route)
    const { data: project } = await supabase
        .from("projects")
        .select("id, name, client_name, potential_value, proposal_status, proposal_sent_at, proposal_accepted_at, proposal_accepted_by, user_id, scope_text, exclusions_text, payment_schedule, gantt_phases, programme_phases, timeline_phases, project_type, start_date, site_address, client_address")
        .eq("proposal_token", token)
        .single();

    if (!project) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 max-w-md w-full text-center">
                    <h1 className="text-2xl font-bold text-slate-100 mb-3">Proposal Not Found</h1>
                    <p className="text-slate-400">
                        This proposal link is invalid or has expired. Please contact the contractor for a new link.
                    </p>
                </div>
            </div>
        );
    }

    // Mark as viewed if it was sent but not yet viewed/accepted
    const wasJustViewed = project.proposal_status === "sent";
    if (wasJustViewed) {
        await supabase
            .from("projects")
            .update({ proposal_status: "viewed" })
            .eq("proposal_token", token);
        project.proposal_status = "viewed";
    }

    // Fetch contractor profile
    const { data: profile } = await supabase
        .from("profiles")
        .select("company_name, logo_url, phone, website, accreditations, capability_statement, years_trading, specialisms, insurance_details")
        .eq("id", project.user_id)
        .single();

    // Sprint 23: Fire "proposal viewed" notification email to contractor (fire-and-forget)
    if (wasJustViewed) {
        try {
            const adminSupabase = createAdminClient();
            const { data: contractorAuth } = await adminSupabase.auth.admin.getUserById(project.user_id);
            const contractorEmail = contractorAuth?.user?.email;
            if (contractorEmail) {
                const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://constructa-nu.vercel.app";
                sendContractorViewedNotification({
                    contractorEmail,
                    clientName: project.client_name || "Your client",
                    projectName: project.name || "the project",
                    proposalUrl: `${baseUrl}/dashboard/projects/proposal?projectId=${project.id}`,
                }).catch((e) => console.error("Viewed notification email failed:", e));
            }
        } catch (e) {
            console.error("Could not send viewed notification:", e);
        }
    }

    const companyName = profile?.company_name || "The Contractor";

    // Check if proposal was sent more than 30 days ago (expired)
    const sentAt = project.proposal_sent_at ? new Date(project.proposal_sent_at) : null;
    const isExpired = sentAt ? (Date.now() - sentAt.getTime()) > 30 * 86400000 : false;

    // Calculate total project duration — try all phase sources in priority order
    let totalWeeks: number | null = null;
    const programmePhasesRaw = project.programme_phases || project.timeline_phases || project.gantt_phases || [];
    const allPhaseSources = Array.isArray(programmePhasesRaw) ? programmePhasesRaw : [];
    if (allPhaseSources.length > 0) {
        // programme_phases use calculatedDays/manualDays; gantt_phases use duration_days
        const totalDays = allPhaseSources.reduce((sum: number, p: any) => {
            const days = p.duration_days ?? p.manualDays ?? p.calculatedDays ?? 0;
            return sum + days;
        }, 0);
        if (totalDays > 0) totalWeeks = Math.ceil(totalDays / 7);
    }

    const refCode = project.id.substring(0, 8).toUpperCase();
    const siteAddress = project.site_address || project.client_address || "";

    return (
        <AcceptanceClient
            project={project}
            profile={profile}
            companyName={companyName}
            token={token}
            isExpired={isExpired}
            sentAt={sentAt?.toISOString() || null}
            totalWeeks={totalWeeks}
            refCode={refCode}
            siteAddress={siteAddress}
        />
    );
}
