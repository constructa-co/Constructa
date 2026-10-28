"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashProposalAccessToken } from "@/lib/proposal-publication";
import { sendProposalResponseReceipt } from "@/lib/email";
import { proposalReference } from "@/lib/proposal-document";
import { parseProposalResponseInput, responseKindOfSnapshot } from "@/lib/proposal-response";

const NOT_RECORDED = "Your response could not be recorded. Please try again, or contact the contractor.";
const UNCONFIRMED = "Your response could not be confirmed. Refresh this page to check whether it was recorded before trying again, or contact the contractor.";

// One row of respond_to_proposal_publication (RETURNS TABLE in
// 20260930150000_proposal_publication_foundation.sql). This action only ever
// asks for "acknowledged", so that is the only status that confirms it.
const Id = z.string().trim().min(1).max(128).regex(/^[^\s\u0000-\u001f]+$/);
const RespondedRow = z.object({
    publication_id: Id,
    publication_status: z.literal("acknowledged"),
    responded_at: z.string().refine(value => Number.isFinite(Date.parse(value))),
    owner_user_id: z.unknown(),
    snapshot: z.unknown(),
    publication_snapshot_hash: z.unknown(),
});
// Only what the receipts read. An unreadable snapshot never blocks a recorded response.
const ReceiptSnapshot = z.object({
    project: z.object({ id: z.string().min(1), name: z.string() }),
    contractor: z.object({ company_name: z.string() }),
    publication: z.object({ version_number: z.number().int().positive(), response_mode: z.string().nullable().optional() }),
    response: z.object({ kind: z.string().nullable().optional() }).nullable().optional(),
});

/** A database refusal carries a SQLSTATE or PostgREST code; a lost reply (code "") may still have committed. */
function isDefiniteRefusal(code: unknown): boolean {
    return typeof code === "string" && (/^[0-9A-Z]{5}$/.test(code) || /^PGRST\d+$/.test(code));
}
const errorName = (error: unknown) => error instanceof Error ? error.name : typeof error;

/**
 * Records the client's response to a published proposal.
 *
 * The browser sends a name and an optional email, nothing else. The only
 * response this action can record is the non-binding one the publication
 * asked for: confirmation of receipt, or an intention to proceed. It cannot
 * record acceptance. What the response means is read from the immutable
 * snapshot, and the database refuses anything the publication does not
 * permit.
 *
 * Outcomes are reported as they are known: recorded (confirmed by a row that
 * matches the RPC contract), refused (the database said no), or unconfirmed
 * (the reply was lost or did not match, so it may have been recorded). An
 * identical retry is safe: the database returns the existing record.
 */
export async function respondToProposalAction(
    token: string,
    clientName: string,
    clientEmail: string,
): Promise<{ success: boolean; status?: string; respondedAt?: string; error?: string; unconfirmed?: true }> {
    const parsed = parseProposalResponseInput({ token, clientName, clientEmail });
    if (!parsed.success) {
        return { success: false, error: "Enter your full name and, if you add one, a valid email address." };
    }
    ({ token, clientName, clientEmail } = parsed.data);

    let tokenHash: string;
    try {
        tokenHash = await hashProposalAccessToken(token);
    } catch {
        return { success: false, error: "Proposal not found." };
    }

    // The public server action is the only response ingress. The underlying
    // RPC is service-role-only, so clients cannot bypass validation through
    // PostgREST even when they possess a valid bearer token.
    let adminSupabase: ReturnType<typeof createAdminClient>;
    try {
        adminSupabase = createAdminClient();
    } catch (error) {
        console.error("Proposal response could not start", { error: errorName(error) });
        return { success: false, error: NOT_RECORDED };
    }

    let reply: { data: unknown; error: { code?: unknown } | null };
    try {
        reply = await adminSupabase.rpc("respond_to_proposal_publication", {
            p_token_hash: tokenHash,
            p_response: "acknowledged",
            p_name: clientName,
            p_email: clientEmail || null,
            p_note: null,
        });
    } catch (error) {
        console.error("Proposal response reply was lost", { error: errorName(error) });
        return { success: false, unconfirmed: true, error: UNCONFIRMED };
    }

    if (reply.error) {
        const code = reply.error.code;
        console.error("Proposal response transaction failed", { code });
        if (!isDefiniteRefusal(code)) return { success: false, unconfirmed: true, error: UNCONFIRMED };
        return {
            success: false,
            error: code === "P0002"
                ? "Proposal not found."
                : code === "23514"
                    ? "This proposal can no longer receive a response. Please contact the contractor."
                    : NOT_RECORDED,
        };
    }

    const rows = Array.isArray(reply.data) ? reply.data : [];
    const checked = rows.length === 1 ? RespondedRow.safeParse(rows[0]) : null;
    if (!checked?.success) {
        // No error, but the reply does not show what was recorded. Never confirm,
        // dereference or send receipts from it.
        console.error("Proposal response reply did not match its contract", { rows: rows.length });
        return { success: false, unconfirmed: true, error: UNCONFIRMED };
    }

    const result = checked.data;
    const publicationId = result.publication_id;
    const respondedAt = result.responded_at;
    const ownerUserId = Id.safeParse(result.owner_user_id).success ? result.owner_user_id as string : null;
    const snapshotReference = typeof result.publication_snapshot_hash === "string" ? result.publication_snapshot_hash : "";
    const readable = ReceiptSnapshot.safeParse(result.snapshot);

    // The response is committed from here on. Nothing below may turn it into a
    // failure for the client: every receipt, lookup and record is contained.
    const recordReceipt = async (audience: "client" | "owner", succeeded: boolean, providerMessageId: string | null, errorCode: string | null) => {
        try {
            const { error: recordError } = await adminSupabase.rpc("record_proposal_receipt_delivery", {
                p_publication_id: publicationId,
                p_audience: audience,
                p_succeeded: succeeded,
                p_provider_message_id: providerMessageId,
                p_error_code: errorCode,
            });
            if (recordError) console.error("Response receipt outcome could not be recorded", { audience, succeeded, code: recordError.code });
        } catch (error) {
            console.error("Response receipt outcome could not be recorded", { audience, succeeded, error: errorName(error) });
        }
    };

    if (!readable.success) {
        console.error("Proposal response snapshot unreadable; no receipt sent", { publicationId });
        await Promise.allSettled([
            ...(clientEmail ? [recordReceipt("client", false, null, "snapshot_unreadable")] : []),
            ...(ownerUserId ? [recordReceipt("owner", false, null, "snapshot_unreadable")] : []),
        ]);
        return { success: true, status: result.publication_status, respondedAt };
    }

    const snapshot = readable.data;
    const refCode = proposalReference(snapshot);
    const responseKind = responseKindOfSnapshot(snapshot);

    let contractorEmail: string | undefined;
    if (ownerUserId) {
        try {
            const { data: contractorAuth } = await adminSupabase.auth.admin.getUserById(ownerUserId);
            contractorEmail = contractorAuth?.user?.email;
        } catch (authError) {
            console.error("Contractor auth lookup failed", { error: errorName(authError) });
        }
    }

    const sendReceipt = async (audience: "client" | "owner", recipientEmail: string) => {
        try {
            const delivery = await sendProposalResponseReceipt({
                recipientEmail,
                recipientKind: audience,
                clientName,
                projectName: snapshot.project.name,
                companyName: snapshot.contractor.company_name,
                response: "acknowledged",
                responseKind,
                respondedAt,
                refCode,
                publicationVersion: snapshot.publication.version_number,
                snapshotReference,
                idempotencyKey: `proposal-response-${audience}/${publicationId}/acknowledged`,
            });
            if (delivery.error) throw new Error(delivery.error.name || "provider_error");
            await recordReceipt(audience, true, delivery.data?.id ?? null, null);
        } catch (emailError) {
            console.error("Proposal response receipt failed", { audience, error: errorName(emailError) });
            await recordReceipt(audience, false, null, emailError instanceof Error ? emailError.message : "unknown");
        }
    };

    await Promise.allSettled([
        ...(clientEmail ? [sendReceipt("client", clientEmail)] : []),
        ...(contractorEmail ? [sendReceipt("owner", contractorEmail)] : []),
    ]);

    return {
        success: true,
        status: result.publication_status,
        respondedAt,
    };
}
