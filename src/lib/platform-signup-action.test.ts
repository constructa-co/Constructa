import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Offline tests for the A023 signup server-action seam (Rob 15:05;
// coordinator repair 15:46). Boundaries mocked, sequencing proven:
//   - "@/lib/platform-signup-policy"      → the source signup policy
//   - "@/lib/supabase/server"             → the normal cookie-bound server client
//   - "@/lib/platform-terms-acceptance"   → the consent recorder
// The orchestration inside platformSignupAction runs for real: the gate is
// consulted through the policy module, acceptance and trusted revision are
// verified before signUp, and consent is recorded only after a server
// session exists.

const mocks = vi.hoisted(() => ({
    signUp: vi.fn(),
    createClient: vi.fn(),
    recordConsent: vi.fn(),
    // The policy module is mocked at module boundary; the flag makes the
    // real gate-check code path in the action reachable offline without
    // changing the real source policy (enabled per Rob's approval).
    gate: { disabled: true as boolean },
}));

vi.mock("@/lib/platform-signup-policy", () => ({
    isPlatformSignupDisabled: () => mocks.gate.disabled,
}));

vi.mock("@/lib/supabase/server", () => ({
    createClient: mocks.createClient.mockImplementation(async () => ({ auth: { signUp: mocks.signUp } })),
}));

vi.mock("@/lib/platform-terms-acceptance", () => ({
    recordPlatformTermsAcceptance: mocks.recordConsent,
}));

import { platformSignupAction } from "@/lib/platform-signup-action";
import {
    PLATFORM_TERMS_AUTH_METADATA_ACCEPTED_AT,
    PLATFORM_TERMS_AUTH_METADATA_REVISION,
    PLATFORM_TERMS_CURRENT_REVISION,
} from "@/lib/platform-terms";

const VALID_INPUT = {
    email: "builder@example.com",
    password: "correct horse 1",
    acceptance: true,
    revision: PLATFORM_TERMS_CURRENT_REVISION,
};

describe("signup source policy and defensive gate", () => {
    it("policy module keeps signup disabled in source", async () => {
        const actual =
            await vi.importActual<typeof import("@/lib/platform-signup-policy")>(
                "@/lib/platform-signup-policy",
            );
        expect(actual.isPlatformSignupDisabled()).toBe(true);
    });

    it("refuses before the server client or recorder are consulted", async () => {
        mocks.gate.disabled = true;
        const result = await platformSignupAction(VALID_INPUT);

        expect(result).toEqual({ ok: false, code: "signup-disabled" });
        expect(mocks.createClient).not.toHaveBeenCalled();
        expect(mocks.signUp).not.toHaveBeenCalled();
        expect(mocks.recordConsent).not.toHaveBeenCalled();
    });
});

describe("signup orchestration behind the gate (offline mocks)", () => {
    beforeEach(() => {
        mocks.gate.disabled = false;
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-11-07T08:00:00.000Z"));
    });

    afterEach(() => {
        mocks.gate.disabled = true;
        vi.clearAllMocks();
        vi.useRealTimers();
    });

    it("rejects malformed input without touching auth", async () => {
        for (const bad of [
            { ...VALID_INPUT, email: "not-an-email" },
            { ...VALID_INPUT, email: "  " },
            { ...VALID_INPUT, password: "short" },
        ]) {
            const result = await platformSignupAction(bad);
            expect(result).toEqual({ ok: false, code: "invalid-input" });
        }
        expect(mocks.createClient).not.toHaveBeenCalled();
        expect(mocks.signUp).not.toHaveBeenCalled();
    });

    it("refuses signup without explicit acceptance before any account call", async () => {
        for (const acceptance of [false, undefined, null, "yes"]) {
            const result = await platformSignupAction({ ...VALID_INPUT, acceptance });
            expect(result).toEqual({ ok: false, code: "terms-refused" });
        }
        expect(mocks.createClient).not.toHaveBeenCalled();
        expect(mocks.signUp).not.toHaveBeenCalled();
    });

    it("refuses a forged or stale revision before any account call", async () => {
        for (const revision of ["platform-tos-2099-01", "march-2026", "", null]) {
            const result = await platformSignupAction({ ...VALID_INPUT, revision });
            expect(result).toEqual({ ok: false, code: "unrecognized-revision" });
        }
        expect(mocks.createClient).not.toHaveBeenCalled();
        expect(mocks.signUp).not.toHaveBeenCalled();
    });

    it("reports signup failure without leaking provider or transport details", async () => {
        mocks.signUp.mockResolvedValueOnce({
            data: { user: null, session: null },
            error: { message: "User already registered, password hint: hunter2" },
        });
        const fromError = await platformSignupAction(VALID_INPUT);
        expect(fromError).toEqual({ ok: false, code: "signup-failed" });
        expect(JSON.stringify(fromError)).not.toContain("hunter2");

        mocks.signUp.mockRejectedValueOnce(new Error("ECONNRESET provider internal detail"));
        const fromThrow = await platformSignupAction(VALID_INPUT);
        expect(fromThrow).toEqual({ ok: false, code: "signup-failed" });
        expect(JSON.stringify(fromThrow)).not.toContain("ECONNRESET");

        expect(mocks.recordConsent).not.toHaveBeenCalled();
    });

    it("acknowledges email-confirmation signup without claiming a stored consent record", async () => {
        // Account creation succeeded but there is no server session yet.
        mocks.signUp.mockResolvedValue({
            data: { user: { id: "pending-user-1" }, session: null },
            error: null,
        });

        const result = await platformSignupAction(VALID_INPUT);

        expect(result).toEqual({ ok: true, outcome: "confirmation-required" });
        expect(mocks.signUp).toHaveBeenCalledTimes(1);
        expect(mocks.signUp.mock.calls[0][0].options?.data).toEqual({
            [PLATFORM_TERMS_AUTH_METADATA_REVISION]: PLATFORM_TERMS_CURRENT_REVISION,
            [PLATFORM_TERMS_AUTH_METADATA_ACCEPTED_AT]: "2026-11-07T08:00:00.000Z",
        });
        // No session → the recorder must not run and nothing is persisted.
        expect(mocks.recordConsent).not.toHaveBeenCalled();
    });

    it("records consent after a session exists, deriving identity only from the recorder", async () => {
        mocks.signUp.mockResolvedValue({
            data: { user: { id: "server-user-1" }, session: { access_token: "server-session" } },
            error: null,
        });
        mocks.recordConsent.mockResolvedValue({
            ok: true,
            outcome: "recorded",
            userId: "server-user-1",
            revision: PLATFORM_TERMS_CURRENT_REVISION,
        });

        const result = await platformSignupAction(VALID_INPUT);

        expect(result).toEqual({ ok: true, outcome: "created-and-recorded", userId: "server-user-1" });
        // signUp receives only email/password and the trusted-app-URL
        // redirect (existing requireTrustedAppUrl convention; deployed
        // default origin in the test environment — no arbitrary Origin).
        expect(mocks.signUp).toHaveBeenCalledWith({
            email: "builder@example.com",
            password: "correct horse 1",
            options: {
                emailRedirectTo: "https://constructa-nu.vercel.app/auth/callback?next=%2Fauth%2Fplatform-terms",
                data: {
                    [PLATFORM_TERMS_AUTH_METADATA_REVISION]: PLATFORM_TERMS_CURRENT_REVISION,
                    [PLATFORM_TERMS_AUTH_METADATA_ACCEPTED_AT]: "2026-11-07T08:00:00.000Z",
                },
            },
        });
        // Sequencing: consent is recorded strictly after account creation,
        // with the trusted revision and explicit acceptance only.
        expect(mocks.recordConsent).toHaveBeenCalledTimes(1);
        expect(mocks.recordConsent).toHaveBeenCalledWith({
            acceptance: true,
            revision: PLATFORM_TERMS_CURRENT_REVISION,
        });
        expect(mocks.recordConsent.mock.invocationCallOrder[0]).toBeGreaterThan(
            mocks.signUp.mock.invocationCallOrder[0],
        );
    });

    it("treats an already-recorded consent as success", async () => {
        mocks.signUp.mockResolvedValue({
            data: { user: { id: "server-user-1" }, session: { access_token: "server-session" } },
            error: null,
        });
        mocks.recordConsent.mockResolvedValue({
            ok: true,
            outcome: "already-recorded",
            userId: "server-user-1",
            revision: PLATFORM_TERMS_CURRENT_REVISION,
        });

        const result = await platformSignupAction(VALID_INPUT);

        expect(result).toEqual({ ok: true, outcome: "created-and-recorded", userId: "server-user-1" });
    });

    it("does not claim a stored consent record when the consent table is not installed", async () => {
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        mocks.signUp.mockResolvedValue({
            data: { user: { id: "server-user-1" }, session: { access_token: "server-session" } },
            error: null,
        });
        mocks.recordConsent.mockResolvedValue({ ok: false, code: "storage-not-installed" });

        const result = await platformSignupAction(VALID_INPUT);

        // user_metadata is user-editable and carries the app server's clock, so
        // it is never reported as a stored consent record.
        expect(result).toEqual({ ok: false, code: "consent-not-stored" });
        expect(result).not.toHaveProperty("outcome");
        expect(result).not.toHaveProperty("userId");
        // One signup, one consent attempt, no internal retry.
        expect(mocks.signUp).toHaveBeenCalledTimes(1);
        expect(mocks.recordConsent).toHaveBeenCalledTimes(1);
        // The supplementary metadata is still written at signUp (unchanged by this fix).
        expect(mocks.signUp.mock.calls[0][0].options?.data).toEqual({
            [PLATFORM_TERMS_AUTH_METADATA_REVISION]: PLATFORM_TERMS_CURRENT_REVISION,
            [PLATFORM_TERMS_AUTH_METADATA_ACCEPTED_AT]: "2026-11-07T08:00:00.000Z",
        });
        // Typed code only in the log; no email, password or user id.
        expect(log).toHaveBeenCalledWith("platformSignupAction: consent not stored", {
            code: "storage-not-installed",
        });
        const logged = JSON.stringify(log.mock.calls);
        expect(logged).not.toContain("builder@example.com");
        expect(logged).not.toContain("correct horse 1");
        expect(logged).not.toContain("server-user-1");
        log.mockRestore();
    });

    it("keeps the confirmation-required outcome when the consent table is not installed and no session exists", async () => {
        mocks.signUp.mockResolvedValue({
            data: { user: { id: "server-user-1" }, session: null },
            error: null,
        });

        const result = await platformSignupAction(VALID_INPUT);

        expect(result).toEqual({ ok: true, outcome: "confirmation-required" });
        expect(mocks.recordConsent).not.toHaveBeenCalled();
    });

    it("reports consent-not-stored honestly and never retries signup internally", async () => {
        mocks.signUp.mockResolvedValue({
            data: { user: { id: "server-user-1" }, session: { access_token: "server-session" } },
            error: null,
        });
        mocks.recordConsent.mockResolvedValue({ ok: false, code: "storage-error" });

        const result = await platformSignupAction(VALID_INPUT);

        expect(result).toEqual({ ok: false, code: "consent-not-stored" });
        // One invocation → exactly one signup and one consent attempt. The
        // failed consent write never triggers a silent account re-creation.
        expect(mocks.signUp).toHaveBeenCalledTimes(1);
        expect(mocks.recordConsent).toHaveBeenCalledTimes(1);
    });

    it("maps a thrown recorder transport failure to consent-not-stored with no persistence claim", async () => {
        mocks.signUp.mockResolvedValue({
            data: { user: { id: "server-user-1" }, session: { access_token: "server-session" } },
            error: null,
        });
        mocks.recordConsent.mockRejectedValue(new Error("insert transport reset"));

        const result = await platformSignupAction(VALID_INPUT);

        expect(result).toEqual({ ok: false, code: "consent-not-stored" });
        expect(mocks.signUp).toHaveBeenCalledTimes(1);
    });

    it("maps a recorder without authenticated identity to consent-not-stored", async () => {
        mocks.signUp.mockResolvedValue({
            data: { user: { id: "server-user-1" }, session: { access_token: "server-session" } },
            error: null,
        });
        mocks.recordConsent.mockResolvedValue({ ok: false, code: "unauthenticated" });

        const result = await platformSignupAction(VALID_INPUT);

        expect(result).toEqual({ ok: false, code: "consent-not-stored" });
    });
});

