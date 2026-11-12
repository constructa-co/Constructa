import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A091 / A023 batch 3: offline error-path and confirmation-redirect cases for the signup
// action that the existing signup tests do not pin. Same seams as
// platform-signup-action-boundaries.test.ts: no real client, email, provider or database.
// Source/offline evidence only. It says nothing about hosted, real-email or human acceptance.
//
// Not repeated here (already covered): 7/8 password boundary, email trim and invalid emails,
// gate-before-input, input-before-acceptance, acceptance exactly true, forged revisions
// ("platform-tos-2099-01", "march-2026", "", null), provider error leak check, confirmation
// without a recorder call, recorder failure/throw/unauthenticated, trusted redirect with a
// trailing slash, unusable site URL.

const mocks = vi.hoisted(() => ({
    createClient: vi.fn(),
    signUp: vi.fn(),
    recordConsent: vi.fn(),
}));

vi.mock("@/lib/platform-signup-policy", () => ({ isPlatformSignupDisabled: () => false }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/platform-terms-acceptance", () => ({ recordPlatformTermsAcceptance: mocks.recordConsent }));

import { platformSignupAction } from "@/lib/platform-signup-action";
import { PLATFORM_TERMS_CURRENT_REVISION } from "@/lib/platform-terms";

const EMAIL = "dave.private@example.com";
// Low-entropy on purpose: a random-looking password literal in a "password" assignment trips the
// default Gitleaks generic-api-key rule. The scanner stays enabled; the fixture just is not secret-shaped.
const PASSWORD = "fixture-0000-0000";
const VALID = { email: EMAIL, password: PASSWORD, acceptance: true, revision: PLATFORM_TERMS_CURRENT_REVISION };
const WITH_SESSION = { data: { user: { id: "provider-user" }, session: { access_token: "s" } }, error: null };
const NO_SESSION = { data: { user: { id: "pending-user" }, session: null }, error: null };
// RC-aligned: the RC signup action always sends the terms evidence as options.data (revision plus an
// app-server timestamp). Key names are pinned as literals on purpose so a rename is noticed.
const TERMS_EVIDENCE = {
    platform_terms_revision: PLATFORM_TERMS_CURRENT_REVISION,
    platform_terms_accepted_at: expect.any(String),
};

const ENV_KEYS = ["NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_APP_URL"] as const;
let savedEnv: Record<string, string | undefined>;

// console.error is replaced by a spy in beforeEach; read its recorded calls without a typed handle.
const loggedCalls = () => (console.error as unknown as { mock: { calls: unknown[][] } }).mock.calls;

beforeEach(() => {
    savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
    for (const key of ENV_KEYS) delete process.env[key];
    mocks.createClient.mockResolvedValue({ auth: { signUp: mocks.signUp } });
    mocks.signUp.mockResolvedValue(NO_SESSION);
    vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    for (const key of ENV_KEYS) {
        if (savedEnv[key] === undefined) delete process.env[key];
        else process.env[key] = savedEnv[key];
    }
    vi.restoreAllMocks();
    mocks.createClient.mockReset();
    mocks.signUp.mockReset();
    mocks.recordConsent.mockReset();
});

describe("check order after the first three checks", () => {
    it("reports a missing acceptance before an unrecognised revision", async () => {
        const result = await platformSignupAction({ ...VALID, acceptance: false, revision: "bogus" });
        expect(result).toEqual({ ok: false, code: "terms-refused" });
        expect(mocks.createClient).not.toHaveBeenCalled();
    });

    it.each([
        "Platform-TOS-2026-03",
        " platform-tos-2026-03",
        "platform-tos-2026-03 ",
        "platform-tos-2026-03\n",
        ["platform-tos-2026-03"],
        202603,
        {},
    ])("refuses the revision %j without opening a client", async (revision) => {
        expect(await platformSignupAction({ ...VALID, revision })).toEqual({ ok: false, code: "unrecognized-revision" });
        expect(mocks.createClient).not.toHaveBeenCalled();
        expect(mocks.signUp).not.toHaveBeenCalled();
    });

    it("treats a null or missing input object as invalid input, not a crash", async () => {
        expect(await platformSignupAction(null as never)).toEqual({ ok: false, code: "invalid-input" });
        expect(await platformSignupAction(undefined as never)).toEqual({ ok: false, code: "invalid-input" });
        expect(mocks.createClient).not.toHaveBeenCalled();
    });

    it.each([12345678, ["12345678"], null, undefined, {}])("refuses the non-string password %j", async (password) => {
        expect(await platformSignupAction({ ...VALID, password })).toEqual({ ok: false, code: "invalid-input" });
        expect(mocks.createClient).not.toHaveBeenCalled();
    });
});

describe("provider result shapes", () => {
    it("reports signup-failed when the provider returns no data object", async () => {
        mocks.signUp.mockResolvedValue({ data: null, error: null });
        expect(await platformSignupAction(VALID)).toEqual({ ok: false, code: "signup-failed" });
        expect(mocks.recordConsent).not.toHaveBeenCalled();
    });

    it("lets an error beat a returned user and session, and never records consent", async () => {
        mocks.signUp.mockResolvedValue({ ...WITH_SESSION, error: { message: "rate limited" } });
        expect(await platformSignupAction(VALID)).toEqual({ ok: false, code: "signup-failed" });
        expect(mocks.recordConsent).not.toHaveBeenCalled();
    });

    it("reports signup-failed when the server client cannot be built, without calling signUp", async () => {
        mocks.createClient.mockRejectedValue(new Error("cookie store unavailable"));
        expect(await platformSignupAction(VALID)).toEqual({ ok: false, code: "signup-failed" });
        expect(mocks.signUp).not.toHaveBeenCalled();
        expect(mocks.recordConsent).not.toHaveBeenCalled();
    });

    it("returns exactly the confirmation outcome, with no user id, when there is no session", async () => {
        const result = await platformSignupAction(VALID);
        expect(result).toStrictEqual({ ok: true, outcome: "confirmation-required" });
        expect(mocks.recordConsent).not.toHaveBeenCalled();
    });

    it("calls the recorder once with only the acceptance and trusted revision, and returns the recorder's user id", async () => {
        mocks.signUp.mockResolvedValue(WITH_SESSION);
        mocks.recordConsent.mockResolvedValue({ ok: true, userId: "server-user", outcome: "recorded" });
        const result = await platformSignupAction(VALID);
        expect(mocks.recordConsent).toHaveBeenCalledTimes(1);
        expect(mocks.recordConsent.mock.calls[0][0]).toStrictEqual({
            acceptance: true,
            revision: PLATFORM_TERMS_CURRENT_REVISION,
        });
        expect(result).toStrictEqual({ ok: true, outcome: "created-and-recorded", userId: "server-user" });
    });
});

describe("log redaction", () => {
    function everythingLogged(): string {
        return JSON.stringify(loggedCalls());
    }

    it("never logs the email, the password or provider text on any failure path", async () => {
        mocks.signUp.mockResolvedValueOnce({ data: { user: null, session: null }, error: { message: `${EMAIL} ${PASSWORD} ECONNRESET` } });
        await platformSignupAction(VALID);

        mocks.signUp.mockRejectedValueOnce(new Error(`${EMAIL} ${PASSWORD} socket hang up`));
        await platformSignupAction(VALID);

        mocks.createClient.mockRejectedValueOnce(new Error(`${EMAIL} ${PASSWORD} no cookies`));
        await platformSignupAction(VALID);

        mocks.signUp.mockResolvedValueOnce(WITH_SESSION);
        mocks.recordConsent.mockResolvedValueOnce({ ok: false, code: "storage-error", detail: `${EMAIL} ${PASSWORD}` });
        await platformSignupAction(VALID);

        mocks.signUp.mockResolvedValueOnce(WITH_SESSION);
        mocks.recordConsent.mockRejectedValueOnce(new Error(`${EMAIL} ${PASSWORD} insert reset`));
        await platformSignupAction(VALID);

        expect(loggedCalls().length).toBe(5);
        const logged = everythingLogged();
        for (const secret of [EMAIL, PASSWORD, "ECONNRESET", "socket hang up", "no cookies", "insert reset"]) {
            expect(logged).not.toContain(secret);
        }
    });

    it("logs only the typed consent code when the recorder refuses", async () => {
        mocks.signUp.mockResolvedValue(WITH_SESSION);
        mocks.recordConsent.mockResolvedValue({ ok: false, code: "storage-error" });
        await platformSignupAction(VALID);
        expect(loggedCalls()).toEqual([["platformSignupAction: consent not stored", { code: "storage-error" }]]);
    });
});

describe("confirmation redirect trust", () => {
    const REDIRECT_PATH = "/auth/callback?next=%2Fauth%2Fplatform-terms";

    it("sends a configured local http site URL as the redirect base", async () => {
        process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
        await platformSignupAction(VALID);
        expect(mocks.signUp.mock.calls[0][0].options).toEqual({
            emailRedirectTo: `http://localhost:3000${REDIRECT_PATH}`,
            data: TERMS_EVIDENCE,
        });
    });

    it("omits the redirect when the configured site URL carries credentials", async () => {
        process.env.NEXT_PUBLIC_SITE_URL = "https://user:pw@constructa-nu.vercel.app";
        expect(await platformSignupAction(VALID)).toEqual({ ok: true, outcome: "confirmation-required" });
        expect(mocks.signUp.mock.calls[0][0]).toStrictEqual({
            email: EMAIL,
            password: PASSWORD,
            options: { data: TERMS_EVIDENCE },
        });
    });

    it("omits the redirect for a non-http scheme", async () => {
        process.env.NEXT_PUBLIC_SITE_URL = "ftp://constructa-nu.vercel.app";
        await platformSignupAction(VALID);
        expect(mocks.signUp.mock.calls[0][0]).toStrictEqual({
            email: EMAIL,
            password: PASSWORD,
            options: { data: TERMS_EVIDENCE },
        });
    });

    it("RECORDED OBSERVATION: an unusable NEXT_PUBLIC_APP_URL also removes the redirect even when the site URL is fine", async () => {
        // requireTrustedAppUrl builds its allowed-origin set from both env values before
        // comparing, so one unparseable value throws and the redirect is silently dropped.
        // The confirmation email would then fall back to the provider's own default redirect.
        // This case documents current behaviour; if the helper is made tolerant, update it.
        process.env.NEXT_PUBLIC_SITE_URL = "https://constructa-nu.vercel.app";
        process.env.NEXT_PUBLIC_APP_URL = "not a url";
        await platformSignupAction(VALID);
        expect(mocks.signUp.mock.calls[0][0]).toStrictEqual({
            email: EMAIL,
            password: PASSWORD,
            options: { data: TERMS_EVIDENCE },
        });
    });

    it("uses the deployed default origin when no site URL is configured", async () => {
        await platformSignupAction(VALID);
        expect(mocks.signUp.mock.calls[0][0].options).toEqual({
            emailRedirectTo: `https://constructa-nu.vercel.app${REDIRECT_PATH}`,
            data: TERMS_EVIDENCE,
        });
    });
});
