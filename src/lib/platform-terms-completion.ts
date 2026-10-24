// A023 — completing platform terms acceptance after sign-up confirmation.
//
// When sign-up needs email confirmation there is no server session, so the
// sign-up action cannot record consent (it says so honestly). This module
// names the one place a confirmed, signed-in user explicitly accepts the
// current platform terms, and the only return destination the sign-in page
// will honour for it.
//
//   - The completion path is a server-owned constant. Nothing here accepts an
//     arbitrary redirect: a return is honoured only when it equals this path.
//   - Nothing here records consent. The completion action calls the existing
//     recorder (platform-terms-acceptance.ts), which takes identity from the
//     server session, time from the database and checks the revision against
//     the trusted allow-list. A pre-sign-up checkbox, query string or browser
//     metadata is never treated as acceptance.
//   - No existing user is required to accept retroactively; this is reached
//     from the confirmation email, the consent-not-stored notice, or directly.
//
// Kept free of "use server" so it can export constants and plain helpers.

/** The completion page. Under /auth/ so it uses the application chrome and no dashboard gate. */
export const PLATFORM_TERMS_COMPLETION_PATH = "/auth/platform-terms";

/** Sign-in that returns to the completion page, and nowhere else. */
export const PLATFORM_TERMS_COMPLETION_SIGN_IN = `/login?next=${encodeURIComponent(PLATFORM_TERMS_COMPLETION_PATH)}`;

/** The sign-up confirmation email's redirect: the existing callback, then the completion page. */
export function platformTermsConfirmationRedirect(trustedBaseUrl: string): string {
    return `${trustedBaseUrl}/auth/callback?next=${encodeURIComponent(PLATFORM_TERMS_COMPLETION_PATH)}`;
}

/**
 * Where sign-in may send the user instead of the normal landing page: the
 * completion page when `next` names exactly that, otherwise null.
 */
export function platformTermsCompletionReturn(search: unknown): string | null {
    if (typeof search !== "string" || !search) return null;
    let next: string | null;
    try {
        next = new URLSearchParams(search).get("next");
    } catch {
        return null;
    }
    return next === PLATFORM_TERMS_COMPLETION_PATH ? PLATFORM_TERMS_COMPLETION_PATH : null;
}

export type PlatformTermsCompletionResult =
    | { ok: true; outcome: "recorded" | "already-recorded" }
    | { ok: false; code: "refused" | "unauthenticated" | "unrecognized-revision" | "not-stored" };

/** Fixed copy. No provider, database or transport detail ever reaches the page. */
export const PLATFORM_TERMS_COMPLETION_MESSAGES = {
    "refused": "Please accept the platform terms of service to continue.",
    "unauthenticated": "You're not signed in, so your acceptance wasn't recorded. Sign in, then accept the platform terms.",
    "unrecognized-revision": "The platform terms have been updated. Reload this page to read the current terms, then accept them.",
    "not-stored": "We couldn't confirm that your acceptance was recorded. Please try again.",
    "unconfirmed": "We couldn't confirm that your acceptance was recorded. Please try again.",
    "recorded": "Your acceptance of the platform terms is recorded.",
    "already-recorded": "Your acceptance of the platform terms was already recorded.",
} as const;
