"use server";

import { requireAuth } from "@/lib/supabase/auth-utils";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { enhanceCaseStudy, type CaseStudyResult } from "@/lib/cohort-ai/case-study-enhance";
import { COHORT_AI_UNAVAILABLE } from "@/lib/cohort-ai/shared";

export async function saveCaseStudiesAction(caseStudies: any[]) {
    const { user, supabase } = await requireAuth();

    const { error } = await supabase
        .from("profiles")
        .update({ case_studies: caseStudies })
        .eq("id", user.id);

    if (error) throw new Error(error.message);

    revalidatePath("/dashboard/settings/case-studies");
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
