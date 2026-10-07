import { createAdminClient } from "@/lib/supabase/admin";
import { hashProposalAccessToken, type ProposalPublicationSnapshot } from "@/lib/proposal-publication";
import { buildProposalDocument } from "@/lib/proposal-document";
import { responseWording } from "@/lib/proposal-response";
import ProposalDocumentView from "@/components/proposal/proposal-document-view";
import { sendContractorViewedNotification } from "@/lib/email";
import ResponseClient from "./response-client";
import PublicPdfButton from "./public-pdf-button";

export const dynamic = "force-dynamic";

function unavailableProposal() {
    return (
        <div className="min-h-screen bg-stone-100 flex items-center justify-center p-6">
            <div className="bg-white ring-1 ring-stone-200 p-8 sm:p-10 max-w-md w-full text-center">
                <h1 className="font-serif text-3xl text-stone-900 mb-3">Proposal not found</h1>
                <p className="text-base text-stone-600">
                    This proposal link is invalid or is no longer available. Please contact the contractor for a new link.
                </p>
            </div>
        </div>
    );
}

export default async function PublicProposalPage(props: { params: Promise<{ token: string }> }) {
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

    // Everything on this page comes from the immutable snapshot. No drafting
    // table is read, so later edits by the contractor cannot change it.
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

    const document = buildProposalDocument(snapshot);
    const wording = responseWording(document.response.kind);

    return (
        // The root layout already provides the page's <main> landmark.
        <div className="min-h-screen bg-stone-100 sm:py-10">
            <ProposalDocumentView doc={document}>
                <ResponseClient
                    token={token}
                    kind={document.response.kind}
                    heading={document.response.heading}
                    notice={document.response.notice}
                    actionLabel={document.response.actionLabel}
                    recordedHeading={wording.recordedHeading}
                    recordedNoun={wording.recordedNoun}
                    companyName={document.company.name}
                    reference={document.reference}
                    defaultName={snapshot.project.client_name || ""}
                    status={publicationStatus}
                    respondedAt={resolved.responded_at ?? null}
                    respondedBy={resolved.responded_by ?? null}
                    isExpired={isExpired}
                    isRevoked={isRevoked}
                />
                <PublicPdfButton snapshot={snapshot} />
            </ProposalDocumentView>
        </div>
    );
}
