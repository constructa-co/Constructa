/** Query flag set by the proxy when an expired recovery link is normalised onto forgot-password. */
export const RECOVERY_LINK_EXPIRED_NOTICE = "link-expired";

export const FORGOT_PASSWORD_PATH = "/auth/forgot-password";

export const RECOVERY_LINK_EXPIRED_MESSAGE =
    "This password reset link has expired or is no longer valid. Request a new one below.";

export function forgotPasswordExpiredUrl(origin = ""): string {
    const path = `${FORGOT_PASSWORD_PATH}?notice=${RECOVERY_LINK_EXPIRED_NOTICE}`;
    return origin ? `${origin}${path}` : path;
}

function searchParams(search: string): URLSearchParams | null {
    if (!search) return null;
    try {
        return new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
    } catch {
        return null;
    }
}

/** Supabase recovery failures arrive as ?error=…&error_code=… on the configured site URL. */
export function isRecoveryLinkFailureSearch(search: unknown): boolean {
    if (typeof search !== "string" || !search) return false;
    const params = searchParams(search);
    if (!params) return false;

    const errors = params.getAll("error");
    if (errors.length !== 1) return false;

    const errorCode = params.get("error_code");
    if (errorCode === "otp_expired") return true;

    // Other one-time recovery codes that should not fall through to a silent marketing page.
    if (errors[0] === "access_denied" && errorCode) return true;

    return false;
}

export function shouldRedirectRecoveryLinkFailure(pathname: string, search: string): boolean {
    if (!isRecoveryLinkFailureSearch(search)) return false;
    if (pathname.startsWith("/api/")) return false;
    if (pathname === FORGOT_PASSWORD_PATH || pathname === "/auth/reset-password") return false;
    return true;
}

export function isRecoveryLinkExpiredNotice(search: unknown): boolean {
    if (typeof search !== "string" || !search) return false;
    const params = searchParams(search);
    return params?.get("notice") === RECOVERY_LINK_EXPIRED_NOTICE && params.getAll("notice").length === 1;
}
