import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PLATFORM_TERMS_CURRENT_REVISION, PLATFORM_TERMS_DOCUMENT_ID } from "./platform-terms";

const transport = vi.hoisted(() => ({
    createClient: vi.fn(), signUp: vi.fn(), getUser: vi.fn(), from: vi.fn(), insert: vi.fn(),
}));
vi.mock("@/lib/platform-signup-policy", () => ({ isPlatformSignupDisabled: () => false }));
vi.mock("@/lib/supabase/server", () => ({ createClient: transport.createClient }));

// Neither the action nor the recorder is mocked or given injected dependencies.
import { platformSignupAction } from "./platform-signup-action";

const input = {
    email: "synthetic@example.invalid", password: "synthetic-password",
    acceptance: true, revision: PLATFORM_TERMS_CURRENT_REVISION,
    userId: "forged-browser-id", accepted_at: "2099-01-01T00:00:00Z",
};

beforeEach(() => {
    vi.resetAllMocks();
    transport.createClient.mockResolvedValue({
        auth: { signUp: transport.signUp, getUser: transport.getUser }, from: transport.from,
    });
    transport.from.mockReturnValue({ insert: transport.insert });
    transport.signUp.mockResolvedValue({
        data: { user: { id: "server-user" }, session: { access_token: "synthetic-session" } }, error: null,
    });
    transport.getUser.mockResolvedValue({ data: { user: { id: "server-user" } }, error: null });
    transport.insert.mockResolvedValue({ error: null });
});
afterEach(() => vi.restoreAllMocks());

describe("actual signup action to actual consent recorder with offline transport", () => {
    it("uses the default server factory and authenticated identity, never browser id or time", async () => {
        expect(await platformSignupAction(input)).toEqual({
            ok: true, outcome: "created-and-recorded", userId: "server-user",
        });
        expect(transport.createClient).toHaveBeenCalledTimes(2);
        expect(transport.getUser).toHaveBeenCalledOnce();
        expect(transport.from).toHaveBeenCalledExactlyOnceWith("platform_terms_acceptances");
        expect(transport.insert).toHaveBeenCalledExactlyOnceWith({
            user_id: "server-user", terms_document: PLATFORM_TERMS_DOCUMENT_ID,
            accepted_revision: PLATFORM_TERMS_CURRENT_REVISION,
        });
        expect(transport.getUser.mock.invocationCallOrder[0]).toBeGreaterThan(transport.signUp.mock.invocationCallOrder[0]);
        expect(transport.insert.mock.invocationCallOrder[0]).toBeGreaterThan(transport.getUser.mock.invocationCallOrder[0]);
    });

    it("fails closed when authenticated-user lookup reports an error, without inserting", async () => {
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        transport.getUser.mockResolvedValue({ data: { user: { id: "server-user" } }, error: { message: "synthetic auth refusal" } });
        expect(await platformSignupAction(input)).toEqual({ ok: false, code: "consent-not-stored" });
        expect(transport.insert).not.toHaveBeenCalled();
        expect(transport.signUp).toHaveBeenCalledTimes(1);
        expect(JSON.stringify(log.mock.calls)).not.toContain("synthetic auth refusal");
    });

    it("maps the real recorder duplicate acknowledgement without recreating the account", async () => {
        transport.insert.mockResolvedValue({ error: { code: "23505" } });
        expect(await platformSignupAction(input)).toEqual({
            ok: true, outcome: "created-and-recorded", userId: "server-user",
        });
        expect(transport.signUp).toHaveBeenCalledTimes(1);
        expect(transport.insert).toHaveBeenCalledTimes(1);
    });

    it("does not claim stored consent or retry signup when the real insert transport throws", async () => {
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        transport.insert.mockRejectedValue(new Error("synthetic transport detail"));
        expect(await platformSignupAction(input)).toEqual({ ok: false, code: "consent-not-stored" });
        expect(transport.signUp).toHaveBeenCalledTimes(1);
        expect(transport.insert).toHaveBeenCalledTimes(1);
        expect(JSON.stringify(log.mock.calls)).not.toContain("synthetic transport detail");
    });
});
