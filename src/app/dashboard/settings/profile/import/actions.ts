"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/supabase/auth-utils";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireLaunchCapability } from "@/lib/launch-profile";
import { IMPORT_GENERIC_ERROR, IMPORT_PATH, IMPORT_SAVE_ERROR } from "@/lib/company-import/draft";
import { applyImport, previewImport, type ApplyResult, type PreviewResult } from "@/lib/company-import/service";
import { PROFILE_PATH, PROPOSAL_READINESS_PATH } from "@/lib/first-session";

/**
 * Reads the contractor's own website and saves a draft of suggestions.
 * Nothing on the profile changes here. Drafts, the fetch budget and
 * approvals are written through the service role, which the browser cannot
 * use; see `company-import/service.ts`.
 */
export async function previewWebsiteImportAction(input: { url: string; permissionConfirmed: boolean }): Promise<PreviewResult> {
    try {
        requireLaunchCapability("company-profile");
        const { user, supabase } = await requireAuth();
        // The service-role client is created only after the contractor is authenticated,
        // and is only ever handed that contractor's id.
        return await previewImport({ supabase, admin: createAdminClient(), userId: user.id }, input);
    } catch (error) {
        console.error("previewWebsiteImportAction threw", { message: error instanceof Error ? error.message : String(error) });
        return { ok: false, error: IMPORT_GENERIC_ERROR };
    }
}

/** Saves the suggestions the contractor ticked, one profile field each, and no others. */
export async function applyWebsiteImportAction(input: {
    draftId: string;
    approvals: { field: string; expectedExisting: string | null }[];
}): Promise<ApplyResult> {
    let result: ApplyResult;
    try {
        requireLaunchCapability("company-profile");
        const { user, supabase } = await requireAuth();
        result = await applyImport({ supabase, admin: createAdminClient(), userId: user.id }, input);
    } catch (error) {
        console.error("applyWebsiteImportAction threw", { message: error instanceof Error ? error.message : String(error) });
        return { ok: false, error: IMPORT_SAVE_ERROR };
    }
    if (result.outcomes?.some((entry) => entry.outcome === "applied")) {
        for (const path of [IMPORT_PATH, PROFILE_PATH, PROPOSAL_READINESS_PATH]) revalidatePath(path);
    }
    return result;
}
