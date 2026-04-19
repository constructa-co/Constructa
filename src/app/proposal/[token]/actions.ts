"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
    sendAcceptanceConfirmationEmail,
    sendContractorAcceptanceNotification,
} from "@/lib/email";

export async function acceptProposalAction(
    token: string,
    clientName: string,
    clientEmail: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = createClient();

    const { data: project } = await supabase
        .from("projects")
        .select("id, name, site_address, potential_value, proposal_accepted_at, user_id, client_name")
        .eq("proposal_token", token)
        .single();

    if (!project) return { success: false, error: "Proposal not found" };
    if (project.proposal_accepted_at)
        return { success: false, error: "This proposal has already been accepted" };

    const acceptedAt = new Date().toISOString();
    const refCode = project.id.substring(0, 8).toUpperCase();

    // Write acceptance to DB
    await supabase
        .from("projects")
        .update({
            proposal_accepted_at: acceptedAt,
            proposal_accepted_by: clientName || "Client",
            client_email: clientEmail || null,
            proposal_status: "accepted",
        })
        .eq("id", project.id);

    // Fetch contractor profile for company name + email
    const { data: profile } = await supabase
        .from("profiles")
        .select("company_name")
        .eq("id", project.user_id)
        .single();

    // Stage 3 hardening (19 Apr 2026): the contractor auth email lookup must
    // use the service-role admin client, not the cookie-based public client
    // above. Previously `supabase.auth.admin.getUserById(...)` was called on
    // the anon-key client which is not authorised for admin auth methods —
    // the notification path either silently failed or returned an empty user.
    //
    // Mirrors the pattern already used in the /proposal/[token]/page.tsx
    // viewed-notification flow (page.tsx lines 50–67) so both public-proposal
    // notification paths share one consistent, safe shape: admin client only
    // where admin privilege is needed, wrapped in try/catch so a contractor-
    // auth-lookup failure never breaks acceptance itself (the DB write above
    // is already committed). The client-confirmation email is independent
    // and still fires.
    let contractorEmail: string | undefined;
    try {
        const adminSupabase = createAdminClient();
        const { data: contractorAuth } =
            await adminSupabase.auth.admin.getUserById(project.user_id);
        contractorEmail = contractorAuth?.user?.email;
    } catch (e) {
        console.error("Contractor auth lookup failed:", e);
    }

    const companyName = profile?.company_name || "The Contractor";

    // Fire emails in parallel — don't let email failure block the acceptance
    const emailPromises: Promise<unknown>[] = [];

    if (clientEmail) {
        emailPromises.push(
            sendAcceptanceConfirmationEmail({
                clientEmail,
                clientName: clientName || "Client",
                projectName: project.name,
                companyName,
                refCode,
                siteAddress: project.site_address,
            }).catch((e) => console.error("Client confirmation email failed:", e))
        );
    }

    if (contractorEmail) {
        emailPromises.push(
            sendContractorAcceptanceNotification({
                contractorEmail,
                clientName: clientName || "Client",
                projectName: project.name,
                projectValue: project.potential_value || undefined,
                refCode,
            }).catch((e) => console.error("Contractor notification email failed:", e))
        );
    }

    await Promise.all(emailPromises);

    return { success: true };
}
