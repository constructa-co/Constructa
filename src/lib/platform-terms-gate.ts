import { PLATFORM_TERMS_COMPLETION_PATH } from "@/lib/platform-terms-completion";
import { isPlatformTermsConsentTableMissing } from "@/lib/platform-terms-consent-storage";

// A023 F1/F4 — routing signed-in users who have not accepted the CURRENT
// platform terms revision to the explicit acceptance page, before the app.
//
// This module decides; it never records anything. Recording stays with
// platform-terms-acceptance.ts (server identity, database clock, trusted
// revision) via the existing /auth/platform-terms page.
//
//   - Default OFF (F4). Enforcement happens only when the server-side env var
//     below is exactly "on". Unset, empty, "true", "1" or anything else is OFF,
//     so merging this changes nothing until the operator opts in. It is not a
//     NEXT_PUBLIC_ variable: the decision is made on the server (proxy.ts) and
//     is never shipped to the browser. Do NOT enable it before the per-version
//     migration (20261114032000) and the acceptance table exist in that
//     environment; see "unknown" below for what happens if they do not.
//   - No redirect loop. The acceptance page lives under /auth/, which is not a
//     gated prefix, and only "missing" ever redirects. The page itself needs a
//     session and sends anonymous visitors to sign in with a return to itself.
//   - Auth gates unchanged. This only runs for an already-authenticated user;
//     the unauthenticated /dashboard -> /login redirect, the launch-profile
//     gate, onboarding and the /admin guard keep their own behaviour.
//   - "unknown" fails OPEN. If the acceptance table is not installed or the
//     lookup errors or throws, the user is NOT locked out: the acceptance page
//     could not record for them either, so redirecting would trap them in a
//     page that cannot succeed. Only a confirmed absence ("missing", a clean
//     empty result) redirects. Consequence: a brief database outage lets users
//     through; it cannot grant or fabricate an acceptance record.

/** Server-side switch. Exactly "on" enables enforcement; everything else is OFF. */
export const PLATFORM_TERMS_ENFORCEMENT_ENV = "CONSTRUCTA_PLATFORM_TERMS_ENFORCEMENT";

/** Prefixes that are "the app". Boundary-safe: /dashboard-x is not /dashboard. */
const GATED_PREFIXES = ["/dashboard", "/onboarding"] as const;

export function isPlatformTermsEnforcementEnabled(
    value: string | undefined = process.env[PLATFORM_TERMS_ENFORCEMENT_ENV],
): boolean {
    return typeof value === "string" && value.trim().toLowerCase() === "on";
}

export function isPlatformTermsGatedPath(pathname: string): boolean {
    return GATED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** accepted: a current-revision record exists. missing: confirmed none. unknown: could not tell. */
export type PlatformTermsStatus = "accepted" | "missing" | "unknown";

/**
 * Runs the caller's lookup of the signed-in user's CURRENT-revision acceptance
 * row (user, document and revision all filtered by the caller from the trusted
 * constants) and classifies it. Never throws; logs a typed code only, never
 * provider detail.
 */
export async function resolvePlatformTermsStatus(
    run: () => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<PlatformTermsStatus> {
    try {
        const { data, error } = await run();
        if (error) {
            // A missing table is the expected not-yet-migrated state; stay quiet.
            if (!isPlatformTermsConsentTableMissing(error)) {
                console.error("platform terms gate lookup failed", {
                    code: (error as { code?: string })?.code,
                });
            }
            return "unknown";
        }
        if (!Array.isArray(data)) return "unknown";
        return data.length > 0 ? "accepted" : "missing";
    } catch {
        console.error("platform terms gate lookup transport failed");
        return "unknown";
    }
}

/** The acceptance page path when this request must be routed there, otherwise null. */
export function platformTermsGateRedirect(pathname: string, status: PlatformTermsStatus): string | null {
    if (status !== "missing") return null;
    if (!isPlatformTermsGatedPath(pathname)) return null;
    return PLATFORM_TERMS_COMPLETION_PATH;
}
