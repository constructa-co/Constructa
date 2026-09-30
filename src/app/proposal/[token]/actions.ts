"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { hashProposalAccessToken, type ProposalPublicationSnapshot } from "@/lib/proposal-publication";
import {
    sendAcceptanceConfirmationEmail,
    sendContractorAcceptanceNotification,
} from "@/lib/email";

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

    // Binding-acceptance notifications remain isolated from acknowledgement
    // mode so the system never tells either party that a contract was accepted
    // when the publication asked only for receipt acknowledgement.
    if (response === "accepted") {
        let contractorEmail: string | undefined;
        try {
            const { data: contractorAuth } = await adminSupabase.auth.admin.getUserById(result.owner_user_id);
            contractorEmail = contractorAuth?.user?.email;
        } catch (authError) {
            console.error("Contractor auth lookup failed:", authError);
        }

        const emailPromises: Promise<unknown>[] = [];
        if (clientEmail) {
            emailPromises.push(sendAcceptanceConfirmationEmail({
                clientEmail,
                clientName,
                projectName: snapshot.project.name,
                companyName: snapshot.contractor.company_name,
                refCode,
                siteAddress: snapshot.project.site_address || undefined,
            }).catch((emailError) => console.error("Client confirmation email failed:", emailError)));
        }
        if (contractorEmail) {
            emailPromises.push(sendContractorAcceptanceNotification({
                contractorEmail,
                clientName,
                projectName: snapshot.project.name,
                projectValue: snapshot.commercial.contract_sum_ex_vat,
                refCode,
            }).catch((emailError) => console.error("Contractor notification email failed:", emailError)));
        }
        await Promise.all(emailPromises);
    }

    return {
        success: true,
        status: result.publication_status,
        respondedAt: result.responded_at,
    };
}
