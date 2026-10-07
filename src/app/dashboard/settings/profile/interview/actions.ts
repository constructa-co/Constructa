"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/supabase/auth-utils";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireLaunchCapability } from "@/lib/launch-profile";
import { PROFILE_PATH, PROPOSAL_READINESS_PATH } from "@/lib/first-session";
import { INTERVIEW_PATH } from "@/lib/company-interview/questions";
import {
    INTERVIEW_SAVE_ERROR,
    approve,
    buildDraft,
    saveAnswer,
    type ApproveResult,
    type DraftResult,
    type SaveAnswerResult,
} from "@/lib/company-interview/service";

/**
 * Every action authenticates the contractor first and only then creates the
 * service-role client, which is handed that contractor's id and no other.
 * Answers, drafts and approvals are written through it; the browser cannot.
 */
async function context() {
    requireLaunchCapability("company-profile");
    const { user, supabase } = await requireAuth();
    return { supabase, admin: createAdminClient(), userId: user.id };
}

const failed = (name: string, error: unknown) => {
    console.error(`${name} threw`, { message: error instanceof Error ? error.message : String(error) });
    return { ok: false as const, error: INTERVIEW_SAVE_ERROR };
};

export async function saveInterviewAnswerAction(input: { key: string; answer: string; skipped: boolean; expectedRevision: number }): Promise<SaveAnswerResult> {
    try {
        return await saveAnswer(await context(), input);
    } catch (error) {
        return failed("saveInterviewAnswerAction", error);
    }
}

/** Puts a draft together from the saved answers. The profile is not changed. */
export async function buildInterviewDraftAction(): Promise<DraftResult> {
    try {
        return await buildDraft(await context());
    } catch (error) {
        return failed("buildInterviewDraftAction", error);
    }
}

export async function approveInterviewAction(input: { draftId: string; target: string; text: string | null; expectedExisting: string | null }): Promise<ApproveResult> {
    let result: ApproveResult;
    try {
        result = await approve(await context(), input);
    } catch (error) {
        return failed("approveInterviewAction", error);
    }
    if (result.ok && result.outcome === "applied") {
        for (const path of [INTERVIEW_PATH, PROFILE_PATH, PROPOSAL_READINESS_PATH]) revalidatePath(path);
    }
    return result;
}
