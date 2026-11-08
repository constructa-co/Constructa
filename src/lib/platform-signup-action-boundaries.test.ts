import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A023/A091 offline boundary cases for the signup action. Same mocked seams as
// platform-signup-action.test.ts: no real client, email, provider or database.
// Source/offline evidence only — says nothing about hosted or human acceptance.

const mocks = vi.hoisted(() => ({
    signUp: vi.fn(),
    recordConsent: vi.fn(),
    gate: { disabled: false },
}));

vi.mock("@/lib/platform-signup-policy", () => ({ isPlatformSignupDisabled: () => mocks.gate.disabled }));
vi.mock("@/lib/supabase/server", () => ({
    createClient: async () => ({ auth: { signUp: mocks.signUp } }),
}));
vi.mock("@/lib/platform-terms-acceptance", () => ({ recordPlatformTermsAcceptance: mocks.recordConsent }));

import { platformSignupAction } from "@/lib/platform-signup-action";
import { PLATFORM_TERMS_CURRENT_REVISION } from "@/lib/platform-terms";

const VALID = {
    email: "builder@example.com",
    password: "12345678",
    acceptance: true,
    revision: PLATFORM_TERMS_CURRENT_REVISION,
};
const CONFIRMATION = { data: { user: { id: "pending-user" }, session: null }, error: null };
// RC-aligned: the RC signup action always sends the terms evidence as options.data. Key names are
// pinned as literals on purpose so a rename is noticed.
const TERMS_EVIDENCE = {
    platform_terms_revision: PLATFORM_TERMS_CURRENT_REVISION,
    platform_terms_accepted_at: expect.any(String),
};

beforeEach(() => {
    mocks.gate.disabled = false;
    mocks.signUp.mockResolvedValue(CONFIRMATION);
    vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    mocks.signUp.mockReset();
    mocks.recordConsent.mockReset();
});

describe("signup input boundaries", () => {
    it("refuses a 7-character password and accepts exactly 8", async () => {
        expect(await platformSignupAction({ ...VALID, password: "1234567" })).toEqual({ ok: false, code: "invalid-input" });
        expect(mocks.signUp).not.toHaveBeenCalled();
        expect(await platformSignupAction({ ...VALID, password: "12345678" })).toEqual({ ok: true, outcome: "confirmation-required" });
        expect(mocks.signUp).toHaveBeenCalledTimes(1);
    });

    it("does not trim the password", async () => {
        await platformSignupAction({ ...VALID, password: "        " });
        expect(mocks.signUp.mock.calls[0][0].password).toBe("        ");
    });

    it("trims the email before the account call", async () => {
        await platformSignupAction({ ...VALID, email: "  builder@example.com  " });
        expect(mocks.signUp.mock.calls[0][0].email).toBe("builder@example.com");
    });

    it.each(["a@b", "a b@c.d", "a@@b.c", "@b.c", "a@.", 42, null, undefined])("refuses the email %j without an account call", async (email) => {
        expect(await platformSignupAction({ ...VALID, email })).toEqual({ ok: false, code: "invalid-input" });
        expect(mocks.signUp).not.toHaveBeenCalled();
    });
});

describe("signup check order", () => {
    it("checks the source gate before input validation", async () => {
        mocks.gate.disabled = true;
        const malformed = { email: "x", password: "y", acceptance: false, revision: "nope" };
        expect(await platformSignupAction(malformed)).toEqual({ ok: false, code: "signup-disabled" });
        expect(mocks.signUp).not.toHaveBeenCalled();
    });

    it("reports malformed input before a missing acceptance", async () => {
        expect(await platformSignupAction({ ...VALID, email: "x", acceptance: false })).toEqual({ ok: false, code: "invalid-input" });
        expect(mocks.signUp).not.toHaveBeenCalled();
    });

    it("needs acceptance to be exactly true, not merely truthy", async () => {
        for (const acceptance of ["true", 1, "yes", {}, null, undefined]) {
            expect(await platformSignupAction({ ...VALID, acceptance })).toEqual({ ok: false, code: "terms-refused" });
        }
        expect(mocks.signUp).not.toHaveBeenCalled();
    });
});

describe("signup result boundaries", () => {
    it("reports signup-failed when the provider returns a session but no user, and never records consent", async () => {
        mocks.signUp.mockResolvedValue({ data: { user: null, session: { access_token: "x" } }, error: null });
        expect(await platformSignupAction(VALID)).toEqual({ ok: false, code: "signup-failed" });
        expect(mocks.recordConsent).not.toHaveBeenCalled();
    });

    it("sends the trusted confirmation redirect with no trailing-slash drift", async () => {
        vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://constructa-nu.vercel.app/");
        await platformSignupAction(VALID);
        expect(mocks.signUp.mock.calls[0][0].options).toEqual({
            emailRedirectTo: "https://constructa-nu.vercel.app/auth/callback?next=%2Fauth%2Fplatform-terms",
            data: TERMS_EVIDENCE,
        });
    });

    it("omits the redirect, and still signs up, when the configured site url is unusable", async () => {
        vi.stubEnv("NEXT_PUBLIC_SITE_URL", "not a url");
        expect(await platformSignupAction(VALID)).toEqual({ ok: true, outcome: "confirmation-required" });
        expect(mocks.signUp.mock.calls[0][0]).toEqual({
            email: VALID.email,
            password: VALID.password,
            options: { data: TERMS_EVIDENCE },
        });
    });
});
