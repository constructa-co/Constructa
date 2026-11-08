import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A091 / A023 batch 4: offline input-shape, forged-field and recorder-code cases for the
// signup action that platform-signup-error-paths.test.ts, platform-signup-action-boundaries.test.ts
// and platform-signup-action.test.ts do not pin. Same offline seams: no real client, email,
// provider or database. Source/offline evidence only; it says nothing about hosted, real-email
// or human acceptance.
//
// Written against THIS branch's platform-signup-action.ts. The RC head
// (origin/cursor/rc-integration-20261108) differs: it passes auth user_metadata on signUp and maps
// a missing consent table to "created-and-recorded". See
// docs/delivery/2026-11-08/claude-batch4-handoff.md; these cases are not claims about that variant.

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

const VALID = {
    email: "dave.private@example.com",
    password: "pw-secret-9876",
    acceptance: true,
    revision: PLATFORM_TERMS_CURRENT_REVISION,
};
const WITH_SESSION = { data: { user: { id: "provider-user" }, session: { access_token: "s" } }, error: null };
const NO_SESSION = { data: { user: { id: "pending-user" }, session: null }, error: null };

beforeEach(() => {
    mocks.createClient.mockResolvedValue({ auth: { signUp: mocks.signUp } });
    mocks.signUp.mockResolvedValue(NO_SESSION);
    vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
    mocks.createClient.mockReset();
    mocks.signUp.mockReset();
    mocks.recordConsent.mockReset();
});

describe("non-string email values", () => {
    it.each([12345, ["a@b.co"], { toString: () => "a@b.co" }, null, undefined, true])(
        "refuses the email %j as invalid input without opening a client",
        async (email) => {
            expect(await platformSignupAction({ ...VALID, email })).toEqual({ ok: false, code: "invalid-input" });
            expect(mocks.createClient).not.toHaveBeenCalled();
            expect(mocks.signUp).not.toHaveBeenCalled();
        },
    );
});

describe("email shape (pins the current permissive pattern)", () => {
    it.each(["a@b.co", "a.b+tag@sub.example.co.uk", "a@b.c.", "a@-b.c", "a@b..c"])(
        "accepts %j: the pattern only needs non-space, non-@ text around one @ and a dot",
        async (email) => {
            expect(await platformSignupAction({ ...VALID, email })).toEqual({ ok: true, outcome: "confirmation-required" });
            expect(mocks.signUp).toHaveBeenCalledTimes(1);
        },
    );

    it.each(["", "   ", "a", "a@b", "@b.co", "a@.co", "a b@c.co", "a@b .co", "a@@b.co", "a@b@c.co", "a@b. co"])(
        "refuses %j before any account call",
        async (email) => {
            expect(await platformSignupAction({ ...VALID, email })).toEqual({ ok: false, code: "invalid-input" });
            expect(mocks.createClient).not.toHaveBeenCalled();
        },
    );

    it("sends the trimmed email, not the padded one, to the provider", async () => {
        await platformSignupAction({ ...VALID, email: "\t a@b.co \n" });
        expect(mocks.signUp.mock.calls[0][0].email).toBe("a@b.co");
    });
});

describe("password length is counted in UTF-16 units (recorded observation)", () => {
    it("accepts four emoji, which are eight UTF-16 units but only four characters", async () => {
        const password = "\u{1F600}".repeat(4);
        expect(password.length).toBe(8);
        expect([...password].length).toBe(4);
        expect(await platformSignupAction({ ...VALID, password })).toEqual({ ok: true, outcome: "confirmation-required" });
    });

    it("refuses three emoji plus one letter, which is seven units", async () => {
        const password = "\u{1F600}".repeat(3) + "a";
        expect(password.length).toBe(7);
        expect(await platformSignupAction({ ...VALID, password })).toEqual({ ok: false, code: "invalid-input" });
    });
});

describe("acceptance values that are not exactly true", () => {
    it.each(["true", 1, "yes", [true], { value: true }, null, undefined, 0, ""])(
        "refuses the acceptance %j before any account call",
        async (acceptance) => {
            expect(await platformSignupAction({ ...VALID, acceptance })).toEqual({ ok: false, code: "terms-refused" });
            expect(mocks.createClient).not.toHaveBeenCalled();
        },
    );
});

describe("forged extra fields are never forwarded", () => {
    it("passes only email, password and the redirect option to signUp", async () => {
        const forged = { ...VALID, userId: "someone-else", accepted_at: "1999-01-01T00:00:00Z", role: "admin", data: { x: 1 } };
        await platformSignupAction(forged as never);
        const arg = mocks.signUp.mock.calls[0][0];
        expect(Object.keys(arg).sort()).toEqual(expect.arrayContaining(["email", "password"]));
        expect(Object.keys(arg).every((k) => ["email", "password", "options"].includes(k))).toBe(true);
        expect(JSON.stringify(arg)).not.toContain("someone-else");
        expect(JSON.stringify(arg)).not.toContain("1999");
        expect(JSON.stringify(arg)).not.toContain("admin");
    });

    it("passes only acceptance and the trusted revision to the recorder", async () => {
        mocks.signUp.mockResolvedValue(WITH_SESSION);
        mocks.recordConsent.mockResolvedValue({ ok: true, userId: "server-user", outcome: "recorded" });
        await platformSignupAction({ ...VALID, userId: "someone-else", accepted_at: "1999-01-01T00:00:00Z" } as never);
        expect(mocks.recordConsent.mock.calls[0][0]).toStrictEqual({
            acceptance: true,
            revision: PLATFORM_TERMS_CURRENT_REVISION,
        });
    });
});

describe("provider throw and recorder failure codes", () => {
    it("reports signup-failed when signUp itself throws, and records nothing", async () => {
        mocks.signUp.mockRejectedValue(new Error("socket hang up for dave.private@example.com"));
        expect(await platformSignupAction(VALID)).toEqual({ ok: false, code: "signup-failed" });
        expect(mocks.recordConsent).not.toHaveBeenCalled();
        const logged = JSON.stringify((console.error as unknown as { mock: { calls: unknown[][] } }).mock.calls);
        expect(logged).not.toContain("dave.private");
        expect(logged).not.toContain("socket hang up");
    });

    it.each(["refused", "unauthenticated", "unrecognized-revision", "storage-error"])(
        "maps the recorder code %s to consent-not-stored and never retries signUp",
        async (code) => {
            mocks.signUp.mockResolvedValue(WITH_SESSION);
            mocks.recordConsent.mockResolvedValue({ ok: false, code });
            expect(await platformSignupAction(VALID)).toEqual({ ok: false, code: "consent-not-stored" });
            expect(mocks.signUp).toHaveBeenCalledTimes(1);
            expect(mocks.recordConsent).toHaveBeenCalledTimes(1);
        },
    );

    it("treats any falsy session value as confirmation-required and never calls the recorder", async () => {
        for (const session of [null, undefined, false, 0, ""]) {
            mocks.recordConsent.mockClear();
            mocks.signUp.mockResolvedValue({ data: { user: { id: "u" }, session }, error: null });
            expect(await platformSignupAction(VALID)).toEqual({ ok: true, outcome: "confirmation-required" });
            expect(mocks.recordConsent).not.toHaveBeenCalled();
        }
    });
});

describe("repeat submission (recorded observation)", () => {
    it("the action itself does not de-duplicate: two submissions make two signUp calls", async () => {
        await platformSignupAction(VALID);
        await platformSignupAction(VALID);
        expect(mocks.signUp).toHaveBeenCalledTimes(2);
    });
});
