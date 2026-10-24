"use server";

import { requireAuth } from "@/lib/supabase/auth-utils";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { enhanceCaseStudy, type CaseStudyResult } from "@/lib/cohort-ai/case-study-enhance";
import { COHORT_AI_UNAVAILABLE } from "@/lib/cohort-ai/shared";
import { SAVE_MESSAGES, type SaveCaseStudiesResult } from "./save-state";

/**
 * Saves the whole list of older case studies, and says honestly what happened.
 *
 * This is NOT protection against two tabs. The write replaces whatever list is
 * stored, with no condition on what that was, so a tab that loaded an older
 * list still overwrites a newer one and is still told "saved", because it was.
 *
 * In order: who is asking; is it a list; ONE update of the caller's own row
 * with their own session, asking for the changed row's id back. No read first,
 * no privileged client, no retry.
 *
 *   - "saved" only when exactly one row comes back and its id is the caller's.
 *   - No row back: the save is not confirmed. Missing and not-theirs are not told apart.
 *   - Anything else at the write (an error of any kind, a thrown call, a reply
 *     that is not understood): NOT KNOWN. An error after a write is possible,
 *     so no error is taken as proof that nothing was written.
 *
 * What is inside the list is not inspected, capped, tidied or reshaped: every
 * entry and every key is sent as it was given. No other column is named.
 * The database's own words never reach the result or the log.
 */
export async function saveCaseStudiesAction(caseStudies: unknown): Promise<SaveCaseStudiesResult> {
    let auth: Awaited<ReturnType<typeof requireAuth>>;
    try {
        auth = await requireAuth();
    } catch {
        return { status: "signed-out", message: SAVE_MESSAGES.signedOut };
    }
    if (!Array.isArray(caseStudies)) return { status: "refused", message: SAVE_MESSAGES.refused };
    const { user, supabase } = auth;

    const unknown = (kind: "error-returned" | "threw" | "reply-not-understood" | "row-not-own"): SaveCaseStudiesResult => {
        console.error("case studies save: outcome not known", { kind });
        return { status: "unknown", message: SAVE_MESSAGES.unknown };
    };

    let reply: { data: unknown; error: unknown };
    try {
        reply = await supabase
            .from("profiles")
            .update({ case_studies: caseStudies })
            .eq("id", user.id)
            .select("id");
    } catch {
        return unknown("threw");
    }
    if (!reply || typeof reply !== "object") return unknown("reply-not-understood");
    if (reply.error) return unknown("error-returned");
    if (!Array.isArray(reply.data)) return unknown("reply-not-understood");
    if (reply.data.length === 0) return { status: "no-row", message: SAVE_MESSAGES.noRow };
    if (reply.data.length !== 1) return unknown("reply-not-understood");
    const row = reply.data[0] as { id?: unknown } | null;
    if (!row || typeof row !== "object" || row.id !== user.id) return unknown("row-not-own");

    // The write is confirmed. Telling other pages to reload is a separate thing: if it fails, the save still happened.
    let refreshed = true;
    try {
        revalidatePath("/dashboard/settings/case-studies");
    } catch {
        refreshed = false;
        console.error("case studies save: saved, but other pages could not be told to reload");
    }
    return { status: "saved", refreshed };
}

/**
 * Suggests clearer wording for a case study's two sections. Saves nothing and
 * changes nothing: the reply is returned for the screen to show as a pending
 * suggestion, which the contractor uses or discards.
 *
 * The result always carries both sections. If nothing usable was produced,
 * for any reason, they are the contractor's own text, `suggested` is false
 * and `message` says why. It is never a success that changed nothing.
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

    // Who is asking, first: before any input is read, trimmed or sent, and
    // before the budget or the provider. A signed-out caller gets their own
    // words back unchanged and reaches neither. (The dashboard proxy also
    // redirects unsigned requests; this is the action's own check, the same
    // defence-in-depth every other AI action carries.)
    let userId: string;
    try {
        userId = (await requireAuth()).user.id;
    } catch {
        return own(COHORT_AI_UNAVAILABLE);
    }

    try {
        // One call for both sections, through the usage budget. No second call.
        return await enhanceCaseStudy({ admin: createAdminClient(), userId }, { whatWeDelivered, valueAdded, projectName, projectType });
    } catch (error) {
        console.error("enhanceCaseStudyAction failed", { message: error instanceof Error ? error.message : "unknown" });
        return own(COHORT_AI_UNAVAILABLE);
    }
}
