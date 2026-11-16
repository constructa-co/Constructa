"use server";

import { requireAuth } from "@/lib/supabase/auth-utils";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { enhanceCaseStudy, type CaseStudyResult } from "@/lib/cohort-ai/case-study-enhance";
import { caseStudyTextEnhanceEnabled } from "@/lib/cohort-ai/case-study-enhance-enabled";
import { COHORT_AI_OFF, COHORT_AI_UNAVAILABLE } from "@/lib/cohort-ai/shared";
import { legacyCaseStudiesStoredFingerprint, legacyCaseStudiesStoredIsKnown } from "@/lib/server/legacy-case-studies-fingerprint";
import { legacyCaseStudiesPhotosProblem, LEGACY_CASE_STUDY_PHOTOS_MESSAGE } from "./legacy-save-photos";
import { SAVE_MESSAGES, type SaveCaseStudiesResult } from "./save-state";

const FINGERPRINT = /^[0-9a-f]{32}$/;

/**
 * Saves the whole list of older case studies when the stored list is one the
 * tab knows about: the list it last knew to be stored, or one of `unconfirmed`,
 * the lists it sent itself in saves whose answer never came back. A list put
 * there from anywhere else is a conflict.
 */
export async function saveCaseStudiesAction(
    caseStudies: unknown,
    expectedFingerprint: unknown,
    unconfirmed?: unknown,
): Promise<SaveCaseStudiesResult> {
    let auth: Awaited<ReturnType<typeof requireAuth>>;
    try {
        auth = await requireAuth();
    } catch {
        return { status: "signed-out", message: SAVE_MESSAGES.signedOut };
    }
    if (!Array.isArray(caseStudies)) return { status: "refused", message: SAVE_MESSAGES.refused };
    if (typeof expectedFingerprint !== "string" || !FINGERPRINT.test(expectedFingerprint)) {
        return { status: "refused", message: SAVE_MESSAGES.refused };
    }
    if (legacyCaseStudiesPhotosProblem(caseStudies) !== null) {
        return { status: "refused", message: LEGACY_CASE_STUDY_PHOTOS_MESSAGE };
    }
    const { user, supabase } = auth;

    const unknown = (kind: "error-returned" | "threw" | "reply-not-understood" | "row-not-own" | "read-failed"): SaveCaseStudiesResult => {
        console.error("case studies save: outcome not known", { kind });
        return { status: "unknown", message: SAVE_MESSAGES.unknown };
    };

    let stored: unknown;
    try {
        const { data: row, error: readError } = await supabase
            .from("profiles")
            .select("case_studies")
            .eq("id", user.id)
            .maybeSingle();
        if (readError || !row) return unknown("read-failed");
        stored = row.case_studies;
    } catch {
        return unknown("threw");
    }

    if (!legacyCaseStudiesStoredIsKnown(stored, expectedFingerprint, unconfirmed)) {
        return { status: "conflict", message: SAVE_MESSAGES.conflict };
    }

    let reply: { data: unknown; error: unknown };
    try {
        let update = supabase
            .from("profiles")
            .update({ case_studies: caseStudies })
            .eq("id", user.id);
        if (stored === null) update = update.is("case_studies", null);
        else update = update.eq("case_studies", stored);
        reply = await update.select("id, case_studies");
    } catch {
        return unknown("threw");
    }
    if (!reply || typeof reply !== "object") return unknown("reply-not-understood");
    if (reply.error) return unknown("error-returned");
    if (!Array.isArray(reply.data)) return unknown("reply-not-understood");
    if (reply.data.length === 0) {
        const stillThere = await supabase.from("profiles").select("case_studies").eq("id", user.id).maybeSingle();
        if (!stillThere.error && stillThere.data
            && !legacyCaseStudiesStoredIsKnown(stillThere.data.case_studies, expectedFingerprint, unconfirmed)) {
            return { status: "conflict", message: SAVE_MESSAGES.conflict };
        }
        return { status: "no-row", message: SAVE_MESSAGES.noRow };
    }
    if (reply.data.length !== 1) return unknown("reply-not-understood");
    const row = reply.data[0] as { id?: unknown; case_studies?: unknown } | null;
    if (!row || typeof row !== "object" || row.id !== user.id) return unknown("row-not-own");

    let refreshed = true;
    try {
        revalidatePath("/dashboard/settings/case-studies");
    } catch {
        refreshed = false;
        console.error("case studies save: saved, but other pages could not be told to reload");
    }
    return {
        status: "saved",
        refreshed,
        fingerprint: legacyCaseStudiesStoredFingerprint(row.case_studies),
    };
}

/**
 * Suggests clearer wording for a case study's two sections. Saves nothing and
 * changes nothing: the reply is returned for the screen to show as a pending
 * suggestion, which the contractor uses or discards.
 */
export async function enhanceCaseStudyAction(
    whatWeDelivered: string,
    valueAdded: string,
    projectName: string,
    projectType: string
): Promise<CaseStudyResult> {
    const own = (message: string): CaseStudyResult => ({
        whatWeDelivered: typeof whatWeDelivered === "string" ? whatWeDelivered : "",
        valueAdded: typeof valueAdded === "string" ? valueAdded : "",
        suggested: false,
        message,
    });

    let userId: string;
    try {
        userId = (await requireAuth()).user.id;
    } catch {
        return own(COHORT_AI_UNAVAILABLE);
    }

    if (!caseStudyTextEnhanceEnabled()) {
        return own(COHORT_AI_OFF);
    }

    try {
        return await enhanceCaseStudy({ admin: createAdminClient(), userId }, { whatWeDelivered, valueAdded, projectName, projectType });
    } catch (error) {
        console.error("enhanceCaseStudyAction failed", { message: error instanceof Error ? error.message : "unknown" });
        return own(COHORT_AI_UNAVAILABLE);
    }
}