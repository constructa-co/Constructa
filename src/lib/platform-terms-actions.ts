"use server";

import {
    recordPlatformTermsAcceptance,
    type RecordPlatformTermsAcceptanceInput,
    type RecordPlatformTermsAcceptanceResult,
} from "@/lib/platform-terms-acceptance";

// A023 — server action exposing the platform terms acceptance recorder.
//
// Runs exclusively on the server: the user id comes from the session, the
// timestamp from the database, and the revision from the trusted descriptor
// in platform-terms.ts. As of the RC, nothing imports this action: the signup
// action (platform-signup-action.ts) and the completion action
// (platform-terms-completion-action.ts) both call recordPlatformTermsAcceptance
// directly. It is kept as a standalone server-action wrapper of the same
// recorder; wire it to a screen or remove it.

export async function recordPlatformTermsAcceptanceAction(
    input: RecordPlatformTermsAcceptanceInput,
): Promise<RecordPlatformTermsAcceptanceResult> {
    return recordPlatformTermsAcceptance(input);
}
