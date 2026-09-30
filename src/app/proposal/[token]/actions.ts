"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { hashProposalAccessToken, type ProposalPublicationSnapshot } from "@/lib/proposal-publication";
import { sendProposalResponseReceipt } from "@/lib/email";

export async function respondToProposalAction(
    token: string,
    response: "acknowledged" | "accepted" | "declined",
    clientName: string,
    clientEmail: string,
): Promise<{ success: boolean; status?: string; respondedAt?: string; error?: string }> {
    let tokenHash: string;
    try {
        tokenHash = await hashProposalAccessToken(token);
    } catch {
        return { success: false, error: "Proposal not found." };
    }

    // The public server action is the only response ingress. The underlying
    // RPC is service-role-only, so clients cannot bypass validation through
    // PostgREST even when they possess a valid bearer token.
    const adminSupabase = createAdminClient();
    const { data, error } = await adminSupabase.rpc("respond_to_proposal_publication", {
        p_token_hash: tokenHash,
        p_response: response,
        p_name: clientName,
        p_email: clientEmail || null,
        p_note: null,
    });
    const result = !error && Array.isArray(data) ? data[0] : null;
    if (error || !result?.snapshot) {
        console.error("Proposal response transaction failed", { code: error?.code });
        const publicError = error?.code === "P0002"
            ? "Proposal not found."
            : error?.code === "23514"
                ? "This proposal can no longer receive a response. Please contact the contractor."
                : "Could not record your response. Please contact the contractor.";
        return {
            success: false,
            error: publicError,
        };
    }

    const snapshot = result.snapshot as ProposalPublicationSnapshot;
    const refCode = `${snapshot.project.id.substring(0, 8).toUpperCase()}-V${snapshot.publication.version_number}`;

    let contractorEmail: string | undefined;
    try {
        const { data: contractorAuth } = await adminSupabase.auth.admin.getUserById(result.owner_user_id);
        contractorEmail = contractorAuth?.user?.email;
    } catch (authError) {
        console.error("Contractor auth lookup failed:", authError);
    }

    const publicationId = String(result.publication_id);
    const respondedAt = String(result.responded_at);
    const snapshotReference = String(result.publication_snapshot_hash || "");
    const sendReceipt = async (audience: "client" | "owner", recipientEmail: string) => {
        try {
            const delivery = await sendProposalResponseReceipt({
                recipientEmail,
                recipientKind: audience,
                clientName,
                projectName: snapshot.project.name,
                companyName: snapshot.contractor.company_name,
                response,
                respondedAt,
                refCode,
                publicationVersion: snapshot.publication.version_number,
                snapshotReference,
                idempotencyKey: `proposal-response-${audience}/${publicationId}/${response}`,
            });
            if (delivery.error) throw new Error(delivery.error.name || "provider_error");
            const { error: recordError } = await adminSupabase.rpc("record_proposal_receipt_delivery", {
                p_publication_id: publicationId,
                p_audience: audience,
                p_succeeded: true,
                p_provider_message_id: delivery.data?.id ?? null,
                p_error_code: null,
            });
            if (recordError) console.error("Response receipt success could not be recorded", { audience, code: recordError.code });
        } catch (emailError) {
            console.error("Proposal response receipt failed", { audience, emailError });
            const { error: recordError } = await adminSupabase.rpc("record_proposal_receipt_delivery", {
                p_publication_id: publicationId,
                p_audience: audience,
                p_succeeded: false,
                p_provider_message_id: null,
                p_error_code: emailError instanceof Error ? emailError.message : "unknown",
            });
            if (recordError) console.error("Response receipt failure could not be recorded", { audience, code: recordError.code });
        }
    };

    const receiptPromises: Promise<void>[] = [];
    if (clientEmail) receiptPromises.push(sendReceipt("client", clientEmail));
    if (contractorEmail) receiptPromises.push(sendReceipt("owner", contractorEmail));
    await Promise.all(receiptPromises);

    return {
        success: true,
        status: result.publication_status,
        respondedAt: result.responded_at,
    };
}
