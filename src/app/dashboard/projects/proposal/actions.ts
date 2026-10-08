"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { caseLibraryEnabled } from "@/lib/case-library/gate";
import { readProposalLibrary } from "@/lib/case-library/proposal-read";
import { sessionReader } from "@/lib/case-library/store";
import { requireProjectAccess } from "@/lib/supabase/auth-utils";
import { requireEditableProjectAccess } from "@/lib/supabase/project-resource-access";
import { validatePublicImage } from "@/lib/storage/public-image";
import { createAdminClient } from "@/lib/supabase/admin";
import { suggestWording } from "@/lib/cohort-ai/proposal-wording";
import { sendProposalEmail } from "@/lib/email";
import { precontractLockMessage } from "@/lib/project-editability";
import {
    buildProposalPublicationSnapshot,
    hashProposalAccessToken,
    hashProposalContent,
    hashProposalPublication,
    safeImageUrl,
    type ProposalPublicationEstimateInput,
    type ProposalPublicationSnapshot,
} from "@/lib/proposal-publication";
import { evaluateProposalReadiness } from "@/lib/proposal-readiness";
import { isProposalResponseKind, responseKindOfSnapshot, type ProposalResponseKind } from "@/lib/proposal-response";
import {
    AI_UNAVAILABLE_ERROR,
    DELIVERY_ERROR,
    DRAFT_SAVE_ERROR,
    MAX_PAYMENT_STAGES,
    MAX_PHOTOS,
    MAX_TERMS,
    PUBLISH_ERROR,
    REVIEW_CHANGED_ERROR,
    TEXT_LIMITS,
    contractSumOf,
    vatFor,
    type DeliveryOutcome,
    type ProposalDraftPayload,
    type WordingField,
} from "@/lib/proposal-review";
import { resolveProgrammeSource } from "@/lib/programme-plan";
import {
    PROPOSAL_TERMS_PROFILE_VERSION,
    resolveProposalTerms,
    type ProposalTermsClause,
} from "@/lib/proposal-terms";

type Failure = { success: false; error: string };
/** Refused because what would be published is not what the contractor reviewed. */
type ChangedFailure = Failure & { changed: true };

const PROFILE_PUBLICATION_COLUMNS =
    "company_name, logo_url, phone, website, accreditations, capability_statement, years_trading, specialisms, insurance_details, pdf_theme, md_name, md_message, case_studies";

function siteBaseUrl(): string {
    return process.env.NEXT_PUBLIC_SITE_URL || "https://constructa-nu.vercel.app";
}

async function editableAccess(projectId: string, denied: string) {
    try {
        return { access: await requireEditableProjectAccess(projectId), error: null };
    } catch (error) {
        return { access: null, error: precontractLockMessage(error) ?? denied };
    }
}

// ── Save the draft ───────────────────────────────────────────────────────────

const DraftSchema = z.object({
    projectId: z.string().uuid(),
    introduction: z.string().max(TEXT_LIMITS.introduction),
    scope: z.string().max(TEXT_LIMITS.scope),
    exclusions: z.string().max(TEXT_LIMITS.exclusions),
    clarifications: z.string().max(TEXT_LIMITS.clarifications),
    closing: z.string().max(TEXT_LIMITS.closing),
    validityDays: z.number().int().min(1).max(365),
    paymentSchedule: z.array(z.object({
        id: z.string().min(1).max(100),
        stage: z.string().trim().min(1).max(200),
        description: z.string().max(1000),
        percentage: z.number().gt(0).max(100),
    })).max(MAX_PAYMENT_STAGES).nullable(),
    photos: z.array(z.object({ url: z.string().max(2000), caption: z.string().max(300) })).max(MAX_PHOTOS),
    caseStudyIds: z.array(z.string().min(1).max(100)).max(50),
    terms: z.array(z.object({
        clause_number: z.number().int().min(1).max(1000),
        title: z.string().max(500),
        body: z.string().max(10_000),
        hidden: z.boolean().optional(),
        custom: z.boolean().optional(),
    })).max(MAX_TERMS).nullable(),
});

/**
 * Saves the proposal draft in one update. Only the contractor's own wording
 * and choices are written; nothing is generated. Blocked once pre-contract
 * information is locked. Published versions are separate, immutable records
 * and are never touched by a draft save.
 */
export async function saveProposalDraftAction(projectId: string, payload: ProposalDraftPayload): Promise<{ success: true } | Failure> {
    const parsed = DraftSchema.safeParse({ projectId, ...payload });
    if (!parsed.success) return { success: false, error: "Some details could not be saved. Check them and try again." };
    const input = parsed.data;

    const photos = input.photos.map((photo) => ({ url: safeImageUrl(photo.url), caption: photo.caption.trim() }));
    if (photos.some((photo) => photo.url === null)) {
        return { success: false, error: "One of the photos can't be used. Remove it and add it again." };
    }
    const paymentTotal = (input.paymentSchedule ?? []).reduce((sum, row) => sum + row.percentage, 0);
    if (paymentTotal > 100.001) return { success: false, error: "The payment stages add up to more than 100%." };

    const { access, error: accessError } = await editableAccess(input.projectId, "You can't change this proposal.");
    if (!access) return { success: false, error: accessError };
    const { user, supabase } = access;

    const update: Record<string, unknown> = {
        proposal_introduction: input.introduction.trim() || null,
        scope_text: input.scope.trim() || null,
        exclusions_text: input.exclusions.trim() || null,
        clarifications_text: input.clarifications.trim() || null,
        closing_statement: input.closing.trim() || null,
        validity_days: input.validityDays,
        site_photos: photos,
        selected_case_study_ids: input.caseStudyIds,
        tc_overrides: input.terms,
    };
    if (input.paymentSchedule !== null) update.payment_schedule = input.paymentSchedule;

    const { data: saved, error } = await supabase
        .from("projects")
        .update(update)
        .eq("id", input.projectId)
        .eq("user_id", user.id)
        .select("id")
        .single();
    if (error || !saved) {
        console.error("saveProposalDraftAction update failed", { projectId: input.projectId, code: error?.code });
        return { success: false, error: DRAFT_SAVE_ERROR };
    }

    revalidatePath("/dashboard/projects/proposal");
    return { success: true };
}

// ── AI wording ───────────────────────────────────────────────────────────────

/**
 * Suggests clearer wording for text the contractor has already written.
 * It never writes to the project: the reply is shown as a pending suggestion
 * and only the contractor's Apply puts it in the draft. The assistant is
 * told to keep every fact and add none. A reply that introduces a figure the
 * contractor did not write is dropped on the server and recorded as rejected,
 * and the screen's own check for the same thing is unchanged.
 *
 * Order: the contractor's right to edit this proposal is checked first. Only
 * then is the text looked at and one call made through the usage budget.
 */
export async function suggestProposalWordingAction(
    projectId: string,
    field: WordingField,
    text: string,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
    const { access, error: accessError } = await editableAccess(projectId, "You can't change this proposal.");
    if (!access) return { ok: false, error: accessError };

    try {
        return await suggestWording({ admin: createAdminClient(), userId: access.user.id }, field, text);
    } catch (error) {
        console.error("suggestProposalWordingAction failed", { projectId, field, error: error instanceof Error ? error.message : "unknown" });
        return { ok: false, error: AI_UNAVAILABLE_ERROR };
    }
}

// ── Publish ──────────────────────────────────────────────────────────────────

function randomProposalToken(): string {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
        byte.toString(16).padStart(2, "0"),
    ).join("");
}

/**
 * Sends the client email for a publication and records the attempt. Called
 * only after the publication has committed, so a failure here is a failed
 * email and nothing more.
 */
async function deliverProposalEmail(args: {
    deliveryId: string | null;
    recipientEmail: string;
    url: string;
    snapshot: ProposalPublicationSnapshot;
    idempotencyKey: string | undefined;
}): Promise<DeliveryOutcome> {
    const { snapshot } = args;
    const responseKind = responseKindOfSnapshot(snapshot);
    const record = async (succeeded: boolean, providerMessageId: string | null, errorCode: string | null) => {
        if (!args.deliveryId) return;
        const { error } = await createAdminClient().rpc("record_proposal_delivery_attempt", {
            p_delivery_id: args.deliveryId,
            p_succeeded: succeeded,
            p_provider_message_id: providerMessageId,
            p_error_code: errorCode,
        });
        if (error) console.error("Proposal delivery outcome could not be recorded", { succeeded, code: error.code });
    };

    try {
        const delivery = await sendProposalEmail({
            clientEmail: args.recipientEmail,
            clientName: snapshot.project.client_name || "Client",
            projectName: snapshot.project.name,
            proposalUrl: args.url,
            companyName: snapshot.contractor.company_name,
            siteAddress: snapshot.project.site_address ?? undefined,
            responseKind: responseKind === "non_binding_intent" ? "non_binding_intent" : "acknowledgement",
            idempotencyKey: args.idempotencyKey,
        });
        if (delivery.error) throw new Error(delivery.error.name || "provider_error");
        await record(true, delivery.data?.id ?? null, null);
        return { status: "sent", email: args.recipientEmail };
    } catch (deliveryError) {
        console.error("Proposal email send failed:", deliveryError instanceof Error ? deliveryError.message : "unknown");
        try {
            await record(false, null, deliveryError instanceof Error ? deliveryError.message : "unknown");
        } catch (recordError) {
            console.error("Proposal delivery failure could not be recorded", recordError instanceof Error ? recordError.message : "unknown");
        }
        return { status: "failed", email: args.recipientEmail };
    }
}

export type PublishProposalResult =
    | { success: true; url: string; versionNumber: number; publicationId: string; delivery: DeliveryOutcome; contentHash: string }
    | Failure
    | ChangedFailure;

/**
 * Publishes the saved draft as a new immutable version.
 *
 * The client is asked for one of two non-binding responses, chosen for this
 * send; binding acceptance cannot be requested. Readiness is checked again
 * here from the saved project, so a proposal missing a required fact cannot
 * be published by any route. An earlier version is superseded by the
 * database, never edited. Success is returned as soon as the publication
 * commits; the email outcome is reported separately inside it.
 *
 * What is published is what was reviewed. The contractor's screen sends the
 * fingerprint of the content it showed (the preview and the pre-send PDF).
 * The snapshot is built again here from the saved project, and if its
 * content fingerprint is different, because the estimate, the programme, the
 * company profile or anything else moved in the meantime, nothing is
 * published and the contractor is asked to read the preview again.
 */
export async function publishProposalAction(
    projectId: string,
    input: { responseKind: ProposalResponseKind; deliverByEmail: boolean; reviewedContent: string },
): Promise<PublishProposalResult> {
    if (!z.string().uuid().safeParse(projectId).success || !isProposalResponseKind(input?.responseKind)) {
        return { success: false, error: PUBLISH_ERROR };
    }
    if (typeof input.reviewedContent !== "string" || !/^[a-f0-9]{64}$/.test(input.reviewedContent)) {
        return { success: false, error: REVIEW_CHANGED_ERROR, changed: true };
    }
    const deliverByEmail = input.deliverByEmail === true;

    const { access, error: accessError } = await editableAccess(projectId, "You can't publish this proposal.");
    if (!access) return { success: false, error: accessError };
    const { user, supabase } = access;

    const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .eq("user_id", user.id)
        .single();
    if (projectError || !project) {
        return { success: false, error: "Could not load the proposal for publishing." };
    }

    const { data: estimates, error: estimateError } = await supabase
        .from("estimates")
        .select("*, estimate_lines(id, trade_section, description, quantity, unit, line_total)")
        .eq("project_id", projectId)
        .eq("is_active", true);
    if (estimateError || !estimates || estimates.length !== 1) {
        return {
            success: false,
            error: "Exactly one active estimate is required before publishing this proposal.",
        };
    }

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select(PROFILE_PUBLICATION_COLUMNS)
        .eq("id", user.id)
        .single();
    if (profileError || !profile) {
        return { success: false, error: "Complete your company profile before publishing." };
    }

    const estimate = estimates[0] as ProposalPublicationEstimateInput;
    const terms = resolveProposalTerms(project.tc_overrides as ProposalTermsClause[] | null);
    const readiness = evaluateProposalReadiness({
        projectName: project.name,
        clientName: project.client_name,
        scope: project.scope_text,
        contractSum: contractSumOf(estimate),
        programmePhases: resolveProgrammeSource(project).phases,
        projectStartDate: project.start_date,
        paymentSchedule: project.payment_schedule,
        terms,
    });
    if (!readiness.ready) {
        return {
            success: false,
            error: `This proposal is not ready to send. ${readiness.missing.map((item) => item.fix).join(" ")}`,
        };
    }

    const { data: latestPublication, error: versionError } = await supabase
        .from("proposal_publications")
        .select("version_number")
        .eq("project_id", projectId)
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle();
    if (versionError) {
        return { success: false, error: "Could not determine the next proposal version." };
    }

    // The contractor's approved library case studies, read again now with
    // their own session. With the library switched off or unreadable there
    // are none, so a saved library tick stops this publication below: it is
    // never sent without a past job the contractor chose.
    const caseStudyLibrary = caseLibraryEnabled()
        ? await readProposalLibrary(sessionReader(supabase), user.id, project.selected_case_study_ids)
        : null;

    const publicationId = crypto.randomUUID();
    const versionNumber = (latestPublication?.version_number ?? 0) + 1;
    const sentAt = new Date().toISOString();
    const validityDays = Math.max(1, Math.min(365, Number(project.validity_days) || 30));
    const token = randomProposalToken();
    let snapshot: ProposalPublicationSnapshot;
    let tokenHash: string;
    let snapshotHash: string;
    let contentHash: string;
    try {
        snapshot = buildProposalPublicationSnapshot({
            publicationId,
            versionNumber,
            sentAt,
            validityDays,
            project,
            profile,
            estimate,
            termsProfileVersion: PROPOSAL_TERMS_PROFILE_VERSION,
            resolvedTerms: terms,
            responseKind: input.responseKind,
            ...vatFor(project),
            ...(caseStudyLibrary ? { caseStudyLibrary: { userId: user.id, rows: caseStudyLibrary.rows } } : {}),
        });
        [tokenHash, snapshotHash, contentHash] = await Promise.all([
            hashProposalAccessToken(token),
            hashProposalPublication(snapshot),
            hashProposalContent(snapshot),
        ]);
    } catch (publicationError) {
        console.error("Proposal snapshot validation failed", { projectId, publicationError });
        return {
            success: false,
            error: publicationError instanceof Error
                ? publicationError.message
                : "The proposal is incomplete and could not be published.",
        };
    }

    if (contentHash !== input.reviewedContent) {
        return { success: false, error: REVIEW_CHANGED_ERROR, changed: true };
    }

    const deliveryEmail = deliverByEmail && project.client_email ? String(project.client_email) : null;
    const { data: publicationRows, error: publishError } = await supabase.rpc("publish_proposal_publication", {
        p_project_id: projectId,
        p_publication_id: publicationId,
        p_estimate_id: estimate.id,
        p_version_number: versionNumber,
        p_token_hash: tokenHash,
        p_snapshot: snapshot,
        p_snapshot_hash: snapshotHash,
        p_contract_sum_ex_vat: snapshot.commercial.contract_sum_ex_vat,
        p_vat_rate: snapshot.commercial.vat_rate,
        p_vat_amount: snapshot.commercial.vat_amount,
        p_contract_sum_inc_vat: snapshot.commercial.contract_sum_inc_vat,
        p_sent_at: snapshot.publication.sent_at,
        p_validity_days: snapshot.publication.validity_days,
        p_expires_at: snapshot.publication.expires_at,
        p_delivery_email: deliveryEmail,
    });
    if (publishError) {
        console.error("publishProposal transaction failed", {
            projectId,
            code: publishError.code,
        });
        return { success: false, error: publishError.message || PUBLISH_ERROR };
    }

    // The publication is committed and immutable from here on. Nothing below
    // may turn this into a failure.
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/projects/proposal");

    const url = `${siteBaseUrl()}/proposal/${token}`;
    const publicationResult = Array.isArray(publicationRows) ? publicationRows[0] : null;
    const deliveryId = (publicationResult?.delivery_id as string | null | undefined) ?? null;

    // Delivery starts only after the publication and attempt-ledger row commit. A
    // stable provider idempotency key makes retry safe if the process exits
    // after Resend accepts the message but before the attempt is recorded.
    const delivery: DeliveryOutcome = deliveryEmail
        ? await deliverProposalEmail({
            deliveryId,
            recipientEmail: deliveryEmail,
            url,
            snapshot,
            idempotencyKey: deliveryId ? `proposal-delivery/${deliveryId}` : undefined,
        })
        : { status: "not_requested" };

    return { success: true, url, versionNumber, publicationId, delivery, contentHash };
}

/**
 * Tries the client email again for a version that is already published. The
 * link is rebuilt here from the token and checked against the publication,
 * and the email is worded from that publication's own snapshot. Nothing
 * about the publication changes.
 */
export async function retryProposalDeliveryAction(
    projectId: string,
    input: { publicationId: string; url: string },
): Promise<{ success: true; delivery: DeliveryOutcome } | Failure> {
    const token = String(input?.url ?? "").split("/").pop() ?? "";
    if (!z.string().uuid().safeParse(projectId).success || !z.string().uuid().safeParse(input?.publicationId).success) {
        return { success: false, error: DELIVERY_ERROR };
    }
    let tokenHash: string;
    try {
        tokenHash = await hashProposalAccessToken(token);
    } catch {
        return { success: false, error: DELIVERY_ERROR };
    }

    let access: Awaited<ReturnType<typeof requireProjectAccess>>;
    try {
        access = await requireProjectAccess(projectId);
    } catch {
        return { success: false, error: "You can't send this proposal." };
    }
    const { supabase } = access;

    const { data: publication, error: publicationError } = await supabase
        .from("proposal_publications")
        .select("id, token_hash, status, snapshot")
        .eq("id", input.publicationId)
        .eq("project_id", projectId)
        .single();
    if (publicationError || !publication || publication.token_hash !== tokenHash) {
        return { success: false, error: DELIVERY_ERROR };
    }
    if (!["sent", "viewed"].includes(String(publication.status))) {
        return { success: false, error: "This version is no longer open, so its email was not sent again." };
    }

    // The delivery ledger is server-only: the contractor's own session is not
    // granted access to it. That this publication is theirs was proved just
    // above, by reading it as the contractor and matching the link's token.
    const { data: attempt, error: attemptError } = await createAdminClient()
        .from("proposal_delivery_attempts")
        .select("id, status, attempt_count, recipient_email")
        .eq("publication_id", publication.id)
        .maybeSingle();
    if (attemptError || !attempt) {
        return { success: false, error: "No email was requested for this version. Share the link yourself." };
    }
    if (attempt.status === "sent") {
        return { success: true, delivery: { status: "sent", email: attempt.recipient_email } };
    }

    const delivery = await deliverProposalEmail({
        deliveryId: attempt.id,
        recipientEmail: attempt.recipient_email,
        url: `${siteBaseUrl()}/proposal/${token}`,
        snapshot: publication.snapshot as ProposalPublicationSnapshot,
        idempotencyKey: `proposal-delivery/${attempt.id}/retry-${Number(attempt.attempt_count) || 0}`,
    });
    revalidatePath("/dashboard/projects/proposal");
    return { success: true, delivery };
}

// ── Published versions ───────────────────────────────────────────────────────

type PublicationResult =
    | { success: true; snapshot: ProposalPublicationSnapshot; snapshotHash: string }
    | Failure;

/**
 * One published version, for its PDF. Read from the immutable publication
 * row, never from the draft. Defaults to the current version.
 */
export async function getProposalPublicationAction(projectId: string, publicationId?: string): Promise<PublicationResult> {
    let access: Awaited<ReturnType<typeof requireProjectAccess>>;
    try {
        access = await requireProjectAccess(projectId);
    } catch {
        return { success: false, error: "The published proposal could not be loaded." };
    }
    const { user, supabase } = access;

    let id = publicationId;
    if (!id) {
        const { data: project, error: projectError } = await supabase
            .from("projects")
            .select("current_proposal_publication_id")
            .eq("id", projectId)
            .eq("user_id", user.id)
            .single();
        if (projectError || !project?.current_proposal_publication_id) {
            return { success: false, error: "Publish the proposal before downloading its PDF." };
        }
        id = String(project.current_proposal_publication_id);
    }

    const { data: publication, error: publicationError } = await supabase
        .from("proposal_publications")
        .select("snapshot, snapshot_hash")
        .eq("id", id)
        .eq("project_id", projectId)
        .single();
    if (publicationError || !publication?.snapshot) {
        return { success: false, error: "The published proposal could not be loaded." };
    }
    return {
        success: true,
        snapshot: publication.snapshot as ProposalPublicationSnapshot,
        snapshotHash: publication.snapshot_hash,
    };
}

// ── Photos ───────────────────────────────────────────────────────────────────

export async function uploadPhotoAction(formData: FormData) {
    const file = formData.get("file");
    const projectId = formData.get("projectId");

    if (!(file instanceof File)) return { error: "No image was provided." };
    if (typeof projectId !== "string" || !projectId) return { error: "Project is required." };
    const { access, error: accessError } = await editableAccess(projectId, "You can't add photos to this proposal.");
    if (!access) return { error: accessError };
    const { user, supabase } = access;
    let validated: Awaited<ReturnType<typeof validatePublicImage>>;
    try {
        validated = await validatePublicImage(file);
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Invalid image." };
    }
    const path = `${user.id}/proposal/${projectId}/${crypto.randomUUID()}.${validated.extension}`;

    const { error } = await supabase.storage
        .from("proposal-photos")
        .upload(path, file, {
            cacheControl: "31536000",
            contentType: validated.contentType,
            upsert: false,
        });

    if (error) return { error: "The photo could not be uploaded. Try again." };

    const { data } = supabase.storage.from("proposal-photos").getPublicUrl(path);
    return { url: data.publicUrl };
}
