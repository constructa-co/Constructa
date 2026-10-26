"use server";

import { createClient } from "@/lib/supabase/server";
import { requireTrustedAppUrl } from "@/lib/email";
import { isPlatformSignupDisabled } from "@/lib/platform-signup-policy";
import { isRecognizedPlatformTermsRevision } from "@/lib/platform-terms";
import { recordPlatformTermsAcceptance } from "@/lib/platform-terms-acceptance";
import { platformTermsConfirmationRedirect } from "@/lib/platform-terms-completion";

// A023 (Rob 15:05; coordinator source repair 15:46) — server-side signup
// orchestration seam with consent.
//
// This is the real seam the login page's "Get started" flow calls: explicit
// platform-terms acceptance and the trusted technical revision are verified
// BEFORE any account call, the account is created with the normal
// cookie-bound server client, and consent is recorded only when a server
// session exists to bind it to.
//
// Hard rules, matching the standing A023 boundaries:
//
//   - Signup gate: imported from platform-signup-policy.ts and hard-coded
//     false per Rob's source-only approval. No env flag or request-driven
//     toggle; policy changes require a deliberate code change. The
//     defensive disabled branch remains before any account call.
//   - Consent before account: refusal and unrecognized/false revision are
//     returned before auth is consulted. No browser userId, timestamp,
//     arbitrary revision or dependency object is ever read: identity comes
//     from the server session inside the recorder, time from the database,
//     revision from the trusted allow-list in platform-terms.ts.
//   - Email-confirmation honesty: when signUp succeeds without a session
//     (email confirmation required), the result acknowledges only the
//     account-creation request. It does NOT claim a stored consent record
//     and the recorder is never called without a session.
//   - No silent recreation: one signUp attempt per invocation; a failed or
//     thrown consent write never triggers an internal retry of signUp. The
//     typed consent-not-stored result tells the caller to sign in to
//     complete acceptance instead of re-running signup.
//   - Redacted failures: logs and results carry typed codes only — no raw
//     provider errors, transport details, email or password.
//   - The confirmation redirect uses the app's existing trusted-URL
//     convention (NEXT_PUBLIC_SITE_URL with the deployed default, validated
//     by requireTrustedAppUrl) — never an arbitrary Origin header, and no
//     new env/config. If the trusted URL cannot be derived, the redirect is
//     omitted rather than guessing.
//   - Password bounds match the existing login contract exactly (minimum 8;
//     the client page documents "At least 8 characters."). Nothing else is
//     invented here.
//
// Platform TOS only; the twelve STANDARD_PROPOSAL_TERMS contract clauses and
// the migration are unaffected. The March 2026 descriptor is a technical
// document revision, not a new approved legal policy.

export type PlatformSignupErrorCode =
    | "signup-disabled"
    | "invalid-input"
    | "terms-refused"
    | "unrecognized-revision"
    | "signup-failed"
    | "consent-not-stored";

export type PlatformSignupResult =
    | { ok: true; outcome: "created-and-recorded"; userId: string }
    | { ok: true; outcome: "confirmation-required" }
    | { ok: false; code: PlatformSignupErrorCode };

export interface PlatformSignupInput {
    email: unknown;
    password: unknown;
    /** Explicit affirmative acceptance of the platform terms. Must be exactly true. */
    acceptance: unknown;
    /** The revision the user was shown. Must match the trusted current revision. */
    revision: unknown;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// The existing login contract: "At least 8 characters." — aligned, not extended.
const PASSWORD_MIN = 8;

const DEFAULT_TRUSTED_APP_URL = "https://constructa-nu.vercel.app";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

async function trustedEmailRedirect(): Promise<{ emailRedirectTo: string } | undefined> {
    try {
        const baseUrl = requireTrustedAppUrl(
            process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_TRUSTED_APP_URL,
        ).replace(/\/+$/, "");
        // The confirmed user lands on the explicit platform terms completion page.
        return { emailRedirectTo: platformTermsConfirmationRedirect(baseUrl) };
    } catch {
        // Trusted URL unavailable (e.g. misconfigured site URL): omit the
        // redirect rather than guessing or trusting arbitrary input.
        return undefined;
    }
}

export async function platformSignupAction(input: PlatformSignupInput): Promise<PlatformSignupResult> {
    // 1. Source signup policy — checked before anything
    //    else, including input validation.
    if (isPlatformSignupDisabled()) {
        return { ok: false, code: "signup-disabled" };
    }

    // 2. Input shape — no provider call is made for malformed input.
    const email = typeof input?.email === "string" ? input.email.trim() : "";
    const password = typeof input?.password === "string" ? input.password : "";
    if (!EMAIL_PATTERN.test(email) || password.length < PASSWORD_MIN) {
        return { ok: false, code: "invalid-input" };
    }

    // 3. Explicit acceptance + trusted revision, BEFORE any account call.
    if (input.acceptance !== true) {
        return { ok: false, code: "terms-refused" };
    }
    if (!isRecognizedPlatformTermsRevision(input.revision)) {
        return { ok: false, code: "unrecognized-revision" };
    }

    // 4. Account creation via the normal cookie-bound server client, with
    //    the confirmation redirect derived from the trusted app URL only.
    let session: unknown = null;
    try {
        const supabase: ServerClient = await createClient();
        const redirect = await trustedEmailRedirect();
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            ...(redirect ? { options: redirect } : {}),
        });
        if (error || !data?.user) {
            console.error("platformSignupAction: signup rejected");
            return { ok: false, code: "signup-failed" };
        }
        session = data.session;
    } catch {
        // Transport-level failure (including client construction) — typed,
        // redacted, no provider details.
        console.error("platformSignupAction: signup transport failed");
        return { ok: false, code: "signup-failed" };
    }

    // 5. Email-confirmation honesty: no server session means the account
    //    exists only as an unconfirmed creation request. We acknowledge that
    //    and stop — no consent record is claimed, and the recorder (which
    //    requires an authenticated session) is not called.
    if (!session) {
        return { ok: true, outcome: "confirmation-required" };
    }

    // 6. Session-backed consent record, one attempt. A returned failure OR a
    //    thrown transport error is reported as consent-not-stored: the
    //    account exists, acceptance is NOT persisted, and the caller must
    //    sign in to complete it. signUp is never retried internally.
    let consent: Awaited<ReturnType<typeof recordPlatformTermsAcceptance>>;
    try {
        consent = await recordPlatformTermsAcceptance({
            acceptance: true,
            revision: input.revision,
        });
    } catch {
        console.error("platformSignupAction: consent transport failed");
        return { ok: false, code: "consent-not-stored" };
    }
    if (!consent.ok) {
        console.error("platformSignupAction: consent not stored", { code: consent.code });
        return { ok: false, code: "consent-not-stored" };
    }

    return { ok: true, outcome: "created-and-recorded", userId: consent.userId };
}

