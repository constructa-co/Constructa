"use server";

/**
 * Server actions for the case-study library.
 *
 * Every one of them, in this order: who is asking (the session; no action
 * takes a contractor's id); is the library switched on; then the request is
 * handed to the service, which validates it before it makes the privileged
 * client and runs one database function. Reads use the contractor's own
 * session throughout.
 */

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/supabase/auth-utils";
import { caseLibraryEnabled } from "@/lib/case-library/gate";
import { LIBRARY_MESSAGES } from "@/lib/case-library/messages";
import {
    approveStudy, archiveDiscipline, archiveStudy, createStudy, loadForApproval, saveDiscipline, saveStudy, startFromOlder,
    type ApprovalCheck, type LibraryContext, type LibraryResult,
} from "@/lib/case-library/service";
import { sessionReader } from "@/lib/case-library/store";
import { CASE_STUDIES_PATH } from "@/lib/first-session";

type Refusal = { context: null; refusal: LibraryResult };

async function libraryContext(): Promise<{ context: LibraryContext; refusal: null } | Refusal> {
    let auth: Awaited<ReturnType<typeof requireAuth>>;
    try {
        auth = await requireAuth();
    } catch {
        return { context: null, refusal: { status: "signed-out", message: LIBRARY_MESSAGES.signedOut } };
    }
    if (!caseLibraryEnabled()) return { context: null, refusal: { status: "off", message: LIBRARY_MESSAGES.off } };
    return { context: { userId: auth.user.id, reader: sessionReader(auth.supabase), admin: () => createAdminClient() }, refusal: null };
}

async function run(action: (context: LibraryContext) => Promise<LibraryResult>): Promise<LibraryResult> {
    const { context, refusal } = await libraryContext();
    if (!context) return refusal;
    try {
        const result = await action(context);
        if (["saved", "partial", "approved", "unknown"].includes(result.status)) revalidatePath(CASE_STUDIES_PATH);
        return result;
    } catch (error) {
        // Reached only by something unforeseen. It may have happened after a write, so it is not "nothing changed".
        console.error("case library action failed", { message: error instanceof Error ? error.message : "unknown" });
        return { status: "unknown", message: LIBRARY_MESSAGES.unknown };
    }
}

export async function createCaseStudyAction(input: { content: unknown; disciplineIds: unknown }): Promise<LibraryResult> {
    return run((context) => createStudy(context, input));
}

export async function saveCaseStudyAction(input: { id: unknown; revision: unknown; content: unknown; disciplineIds: unknown }): Promise<LibraryResult> {
    return run((context) => saveStudy(context, input));
}

export async function checkCaseStudyAction(id: unknown): Promise<{ status: "ok"; check: ApprovalCheck } | LibraryResult> {
    const { context, refusal } = await libraryContext();
    if (!context) return refusal;
    try {
        return await loadForApproval(context, id);
    } catch {
        return { status: "unavailable", message: LIBRARY_MESSAGES.unavailable };
    }
}

export async function approveCaseStudyAction(input: { id: unknown; revision: unknown; confirmed: unknown; shown: unknown }): Promise<LibraryResult> {
    return run((context) => approveStudy(context, input));
}

export async function archiveCaseStudyAction(input: { id: unknown; revision: unknown; archived: unknown }): Promise<LibraryResult> {
    return run((context) => archiveStudy(context, input));
}

export async function saveDisciplineAction(input: { id: unknown; revision: unknown; label: unknown }): Promise<LibraryResult> {
    return run((context) => saveDiscipline(context, input));
}

export async function archiveDisciplineAction(input: { id: unknown; revision: unknown; archived: unknown }): Promise<LibraryResult> {
    return run((context) => archiveDiscipline(context, input));
}

export async function startFromOlderCaseStudyAction(input: { index: unknown }): Promise<LibraryResult> {
    return run((context) => startFromOlder(context, input));
}
