import { describe, expect, it } from "vitest";
import {
    forgotPasswordExpiredUrl,
    isRecoveryLinkExpiredNotice,
    isRecoveryLinkFailureHash,
    isRecoveryLinkFailureSearch,
    shouldRedirectRecoveryLinkFailure,
} from "./auth-recovery-link-failure";

describe("recognising Supabase recovery link failures in the query string", () => {
    it.each([
        ["?error=access_denied&error_code=otp_expired", true],
        ["error=access_denied&error_code=otp_expired", true],
        ["?error=access_denied&error_code=otp_disabled", true],
        ["", false],
        ["?error=auth-code-error", false],
        ["?error=access_denied", false],
        ["?error=access_denied&error_code=otp_expired&error=x", false],
        ["?notice=link-expired", false],
    ])("%j → %s", (search, expected) => {
        expect(isRecoveryLinkFailureSearch(search)).toBe(expected);
    });

    it.each([undefined, null, 42])("rejects non-string %j", value => {
        expect(isRecoveryLinkFailureSearch(value)).toBe(false);
    });
});

describe("recognising Supabase recovery link failures in the hash fragment", () => {
    it.each([
        ["#error=access_denied&error_code=otp_expired", true],
        ["error=access_denied&error_code=otp_expired", true],
        ["#access_token=synthetic&refresh_token=synthetic", false],
        ["", false],
    ])("%j → %s", (hash, expected) => {
        expect(isRecoveryLinkFailureHash(hash)).toBe(expected);
    });
});

describe("proxy redirect policy for recovery failures", () => {
    it("redirects the homepage and other public routes, not reset or forgot-password", () => {
        const search = "?error=access_denied&error_code=otp_expired";
        expect(shouldRedirectRecoveryLinkFailure("/", search)).toBe(true);
        expect(shouldRedirectRecoveryLinkFailure("/landing", search)).toBe(true);
        expect(shouldRedirectRecoveryLinkFailure("/auth/reset-password", search)).toBe(false);
        expect(shouldRedirectRecoveryLinkFailure("/auth/forgot-password", search)).toBe(false);
        expect(shouldRedirectRecoveryLinkFailure("/api/theme", search)).toBe(false);
    });

    it("builds the normalised forgot-password destination", () => {
        expect(forgotPasswordExpiredUrl("https://qa.example")).toBe(
            "https://qa.example/auth/forgot-password?notice=link-expired",
        );
    });
});

describe("forgot-password expired notice flag", () => {
    it.each([
        ["?notice=link-expired", true],
        ["notice=link-expired", true],
        ["?notice=link-expired&notice=link-expired", false],
        ["?notice=other", false],
    ])("%j → %s", (search, expected) => {
        expect(isRecoveryLinkExpiredNotice(search)).toBe(expected);
    });
});
