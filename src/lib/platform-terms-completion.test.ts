import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PLATFORM_TERMS_CURRENT_REVISION, PLATFORM_TERMS_DOCUMENT_ID } from "./platform-terms";
import {
    PLATFORM_TERMS_COMPLETION_PATH,
    PLATFORM_TERMS_COMPLETION_SIGN_IN,
    PLATFORM_TERMS_COMPLETION_MESSAGES,
    platformTermsCompletionReturn,
    platformTermsConfirmationRedirect,
} from "./platform-terms-completion";

// The completion action and the existing recorder both run for real; only
// the default cookie-bound server factory is replaced by an offline transport.
const transport = vi.hoisted(() => ({ createClient: vi.fn(), getUser: vi.fn(), from: vi.fn(), insert: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: transport.createClient }));

import { completePlatformTermsAcceptanceAction } from "./platform-terms-completion-action";

const forged = {
    acceptance: true, revision: PLATFORM_TERMS_CURRENT_REVISION,
    userId: "forged-browser-id", user_id: "forged-browser-id", accepted_at: "2099-01-01T00:00:00Z", accepted_revision: "platform-tos-2099-01",
};

beforeEach(() => {
    vi.resetAllMocks();
    transport.createClient.mockResolvedValue({ auth: { getUser: transport.getUser }, from: transport.from });
    transport.from.mockReturnValue({ insert: transport.insert });
    transport.getUser.mockResolvedValue({ data: { user: { id: "server-user" } }, error: null });
    transport.insert.mockResolvedValue({ error: null });
});
afterEach(() => vi.restoreAllMocks());

describe("explicit authenticated completion through the actual recorder", () => {
    it("records with the server identity and trusted revision only, and returns no identity to the browser", async () => {
        expect(await completePlatformTermsAcceptanceAction(forged)).toEqual({ ok: true, outcome: "recorded" });
        expect(transport.createClient).toHaveBeenCalledExactlyOnceWith();
        expect(transport.getUser).toHaveBeenCalledOnce();
        expect(transport.from).toHaveBeenCalledExactlyOnceWith("platform_terms_acceptances");
        expect(transport.insert).toHaveBeenCalledExactlyOnceWith({
            user_id: "server-user", terms_document: PLATFORM_TERMS_DOCUMENT_ID, accepted_revision: PLATFORM_TERMS_CURRENT_REVISION,
        });
        expect(transport.insert.mock.invocationCallOrder[0]).toBeGreaterThan(transport.getUser.mock.invocationCallOrder[0]);
    });

    it("acknowledges an existing record as already recorded, in one attempt", async () => {
        transport.insert.mockResolvedValue({ error: { code: "23505" } });
        expect(await completePlatformTermsAcceptanceAction(forged)).toEqual({ ok: true, outcome: "already-recorded" });
        expect(transport.insert).toHaveBeenCalledTimes(1);
    });

    it.each([false, "true", 1, null, undefined])("refuses acceptance %j before any server client or session is consulted", async acceptance => {
        expect(await completePlatformTermsAcceptanceAction({ acceptance, revision: PLATFORM_TERMS_CURRENT_REVISION })).toEqual({ ok: false, code: "refused" });
        expect(transport.createClient).not.toHaveBeenCalled();
        expect(transport.insert).not.toHaveBeenCalled();
    });

    it.each(["platform-tos-2099-01", "", null, { revision: PLATFORM_TERMS_CURRENT_REVISION }])("refuses a revision the server does not recognise: %j", async revision => {
        expect(await completePlatformTermsAcceptanceAction({ acceptance: true, revision })).toEqual({ ok: false, code: "unrecognized-revision" });
        expect(transport.insert).not.toHaveBeenCalled();
    });

    it("reports no session, a session error or a thrown identity lookup as unauthenticated without inserting", async () => {
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        transport.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
        expect(await completePlatformTermsAcceptanceAction(forged)).toEqual({ ok: false, code: "unauthenticated" });
        transport.getUser.mockResolvedValueOnce({ data: { user: { id: "server-user" } }, error: { message: "synthetic auth refusal" } });
        expect(await completePlatformTermsAcceptanceAction(forged)).toEqual({ ok: false, code: "unauthenticated" });
        transport.createClient.mockRejectedValueOnce(new Error("synthetic cookie transport"));
        expect(await completePlatformTermsAcceptanceAction(forged)).toEqual({ ok: false, code: "unauthenticated" });
        expect(transport.insert).not.toHaveBeenCalled();
        expect(JSON.stringify(log.mock.calls)).not.toMatch(/synthetic (auth refusal|cookie transport)/);
    });

    it.each([
        ["a returned database error (for example the table is not applied)", () => transport.insert.mockResolvedValue({ error: { code: "42P01", message: "synthetic relation detail" } })],
        ["a thrown insert transport", () => transport.insert.mockRejectedValue(new Error("synthetic relation detail"))],
    ])("fails closed as not stored on %s, once, with redacted logs", async (_label, arrange) => {
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        arrange();
        expect(await completePlatformTermsAcceptanceAction(forged)).toEqual({ ok: false, code: "not-stored" });
        expect(transport.insert).toHaveBeenCalledTimes(1);
        expect(JSON.stringify(log.mock.calls)).not.toContain("synthetic relation detail");
    });
});

describe("server-owned completion destinations", () => {
    it("does not claim a failed insert transport proves nothing was saved", () => {
        expect(PLATFORM_TERMS_COMPLETION_MESSAGES["not-stored"]).toBe("We couldn't confirm that your acceptance was recorded. Please try again.");
        expect(PLATFORM_TERMS_COMPLETION_MESSAGES["not-stored"]).not.toContain("Nothing has been saved");
    });

    it("names one completion page, its sign-in return and the confirmation redirect", () => {
        expect(PLATFORM_TERMS_COMPLETION_PATH).toBe("/auth/platform-terms");
        expect(PLATFORM_TERMS_COMPLETION_SIGN_IN).toBe("/login?next=%2Fauth%2Fplatform-terms");
        expect(platformTermsConfirmationRedirect("https://constructa-nu.vercel.app"))
            .toBe("https://constructa-nu.vercel.app/auth/callback?next=%2Fauth%2Fplatform-terms");
        expect(new URL(platformTermsConfirmationRedirect("https://constructa-nu.vercel.app")).searchParams.get("next")).toBe(PLATFORM_TERMS_COMPLETION_PATH);
    });

    it.each([
        ["?next=%2Fauth%2Fplatform-terms", PLATFORM_TERMS_COMPLETION_PATH],
        ["?next=/auth/platform-terms", PLATFORM_TERMS_COMPLETION_PATH],
        ["?error=x&next=%2Fauth%2Fplatform-terms", PLATFORM_TERMS_COMPLETION_PATH],
        ["?next=/dashboard", null],
        ["?next=//evil.example/auth/platform-terms", null],
        ["?next=https://evil.example", null],
        ["?next=@evil.example", null],
        ["?next=/auth/platform-terms?x=1", null],
        ["?next=/auth/platform-terms/", null],
        ["?next=%2FAUTH%2Fplatform-terms", null],
        ["", null],
        [undefined, null],
        [null, null],
    ])("honours only the exact completion return for %j", (search, expected) => {
        expect(platformTermsCompletionReturn(search)).toBe(expected);
    });
});
