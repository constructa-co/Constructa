"use server";

import { recordPlatformTermsAcceptance } from "@/lib/platform-terms-acceptance";
import type { PlatformTermsCompletionResult } from "@/lib/platform-terms-completion";

// A023 — the completion page's server action.
//
// Explicit acceptance of the platform terms by a signed-in user, recorded by
// the EXISTING recorder with its default cookie-bound server client. Only
// `acceptance` and the revision the page showed are passed on; any other
// field (a browser user id, time or version label) is dropped here, and the
// recorder independently refuses anything but exactly-true acceptance, an
// authenticated server session and a trusted current revision.
//
// One attempt per call, no retry. Success is reported only on the recorder's
// own recorded / already-recorded acknowledgement; the user id is not sent
// back to the browser. Every failure is a fixed typed code.

export async function completePlatformTermsAcceptanceAction(input: {
    acceptance: unknown;
    revision: unknown;
}): Promise<PlatformTermsCompletionResult> {
    if (input?.acceptance !== true) return { ok: false, code: "refused" };

    let result: Awaited<ReturnType<typeof recordPlatformTermsAcceptance>>;
    try {
        result = await recordPlatformTermsAcceptance({ acceptance: true, revision: input.revision });
    } catch {
        console.error("completePlatformTermsAcceptanceAction: recorder failed");
        return { ok: false, code: "not-stored" };
    }
    if (result.ok) return { ok: true, outcome: result.outcome };
    return { ok: false, code: result.code === "storage-error" ? "not-stored" : result.code };
}
