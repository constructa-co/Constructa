import { createAdminClient } from "@/lib/supabase/admin";
import { hashProposalAccessToken, type ProposalPublicationSnapshot } from "@/lib/proposal-publication";
import AcceptanceClient from "./acceptance-client";
import { sendContractorViewedNotification } from "@/lib/email";

export const dynamic = "force-dynamic";

function unavailableProposal() {
    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 max-w-md w-full text-center">
                <h1 className="text-2xl font-bold text-slate-100 mb-3">Proposal Not Found</h1>
                <p className="text-slate-400">
                    This proposal link is invalid or is no longer available. Please contact the contractor for a new link.
                </p>
            </div>
        </div>
    );
}

export default async function ProposalAcceptancePage(props: { params: Promise<{ token: string }> }) {
    const { token } = await props.params;
    let tokenHash: string;
    try {
        tokenHash = await hashProposalAccessToken(token);
    } catch {
        return unavailableProposal();
    }

    // Public tokens are resolved only inside this server-rendered route. The
    // RPC is service-role-only and cannot be invoked from the browser/Data API.
    const adminSupabase = createAdminClient();
    const { data, error } = await adminSupabase.rpc("resolve_proposal_publication", {
        p_token_hash: tokenHash,
        p_mark_viewed: true,
    });
    const resolved = !error && Array.isArray(data) ? data[0] : null;
    if (!resolved?.snapshot) return unavailableProposal();

    const snapshot = resolved.snapshot as ProposalPublicationSnapshot;
    const publicationStatus = String(resolved.publication_status);
    const isExpired = new Date(snapshot.publication.expires_at).getTime() <= Date.now();
    const isRevoked = publicationStatus === "revoked";

    if (resolved.was_just_viewed === true) {
        try {
            const { data: contractorAuth } = await adminSupabase.auth.admin.getUserById(resolved.owner_user_id);
            const contractorEmail = contractorAuth?.user?.email;
            if (contractorEmail) {
                const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://constructa-nu.vercel.app";
                sendContractorViewedNotification({
                    contractorEmail,
                    clientName: snapshot.project.client_name || "Your client",
                    projectName: snapshot.project.name,
                    proposalUrl: `${baseUrl}/dashboard/projects/proposal?projectId=${snapshot.project.id}`,
                }).catch((notificationError) => console.error("Viewed notification email failed:", notificationError));
            }
        } catch (notificationError) {
            console.error("Could not send viewed notification:", notificationError);
        }
    }

    const totalDays = snapshot.programme.reduce((sum, phase) => sum + phase.duration_days, 0);
    const totalWeeks = totalDays > 0 ? Math.ceil(totalDays / 7) : null;
    const project = {
        id: snapshot.project.id,
        name: snapshot.project.name,
        client_name: snapshot.project.client_name,
        project_type: snapshot.project.project_type,
        site_address: snapshot.project.site_address,
        client_address: snapshot.project.client_address,
        start_date: snapshot.project.start_date,
        potential_value: snapshot.commercial.contract_sum_ex_vat,
        proposal_status: publicationStatus,
        proposal_sent_at: snapshot.publication.sent_at,
        proposal_accepted_at: resolved.responded_at,
        proposal_accepted_by: resolved.responded_by,
        proposal_introduction: snapshot.content.introduction,
        scope_text: snapshot.content.scope,
        exclusions_text: snapshot.content.exclusions,
        clarifications_text: snapshot.content.clarifications,
        closing_statement: snapshot.content.closing_statement,
        payment_schedule: snapshot.commercial.payment_schedule,
        gantt_phases: snapshot.programme,
        terms: snapshot.terms.clauses,
        response_mode: snapshot.publication.response_mode,
    };

    return (
        <AcceptanceClient
            project={project}
            profile={snapshot.contractor}
            companyName={snapshot.contractor.company_name}
            token={token}
            isExpired={isExpired}
            isRevoked={isRevoked}
            expiresAt={snapshot.publication.expires_at}
            sentAt={snapshot.publication.sent_at}
            totalWeeks={totalWeeks}
            refCode={`${snapshot.project.id.substring(0, 8).toUpperCase()}-V${snapshot.publication.version_number}`}
            siteAddress={snapshot.project.site_address || snapshot.project.client_address || ""}
        />
    );
}
