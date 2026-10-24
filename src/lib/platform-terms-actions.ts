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
// in platform-terms.ts. Nothing in the login page or signup payload changed;
// this action is the consent bridge for whatever surface the coordinator
// wires it to (no screen calls it yet — see A023-1210-BUILD-REPORT.md).

export async function recordPlatformTermsAcceptanceAction(
    input: RecordPlatformTermsAcceptanceInput,
): Promise<RecordPlatformTermsAcceptanceResult> {
    return recordPlatformTermsAcceptance(input);
}
