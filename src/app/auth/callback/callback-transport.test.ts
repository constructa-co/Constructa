import { beforeEach, describe, expect, it, vi } from "vitest";

// A023 / F4 candidate: the actual callback GET when the provider call itself
// throws (a transport failure), rather than returning an error. Same harness as
// callback-return.test.ts: only the cookie-bound server client is replaced.
// Expected: the existing fixed sign-in error, nothing from the failure exposed.
const auth = vi.hoisted(() => ({ exchange: vi.fn(), verifyOtp: vi.fn(), createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: auth.createClient }));

import { GET } from "./route";

const ORIGIN = "https://constructa.example.invalid";
const SIGN_IN_ERROR = `${ORIGIN}/login?error=auth-code-error`;
const DETAIL = "synthetic provider transport detail token=secret";
const callback = (params: Record<string, string>) =>
    GET(new Request(`${ORIGIN}/auth/callback?${new URLSearchParams(params).toString()}`));

beforeEach(() => {
    vi.resetAllMocks();
    auth.createClient.mockResolvedValue({ auth: { exchangeCodeForSession: auth.exchange, verifyOtp: auth.verifyOtp } });
    auth.exchange.mockRejectedValue(new Error(DETAIL));
    auth.verifyOtp.mockRejectedValue(new Error(DETAIL));
});

describe("a provider call that throws during the auth callback", () => {
    it.each([
        { code: "synthetic-code" },
        { code: "synthetic-code", next: "/auth/platform-terms" },
        { code: "synthetic-code", type: "recovery" },
    ] as Record<string, string>[])("code exchange %j lands on the fixed sign-in error, once, with nothing exposed", async params => {
        const response = await callback(params);
        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe(SIGN_IN_ERROR);
        expect(auth.exchange).toHaveBeenCalledExactlyOnceWith("synthetic-code");
        expect(auth.verifyOtp).not.toHaveBeenCalled();
        expect(JSON.stringify([...response.headers])).not.toContain("secret");
    });

    it.each(["signup", "email", "recovery"])("token check of type %s lands on the fixed sign-in error, once, with nothing exposed", async type => {
        const response = await callback({ token_hash: "synthetic-hash", type, next: "/auth/platform-terms" });
        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe(SIGN_IN_ERROR);
        expect(auth.verifyOtp).toHaveBeenCalledExactlyOnceWith({ token_hash: "synthetic-hash", type });
        expect(auth.exchange).not.toHaveBeenCalled();
        expect(JSON.stringify([...response.headers])).not.toContain("secret");
    });
});

// Coordinator regressions: uncertain exchange must not trigger a second provider.
it("does not fall through to token verification after an uncertain exchange", async () => {
 const response = await callback({code:"synthetic-code",token_hash:"synthetic-hash",type:"email"});
 expect(response.headers.get("location")).toBe(SIGN_IN_ERROR);
 expect(auth.exchange).toHaveBeenCalledTimes(1);
 expect(auth.verifyOtp).not.toHaveBeenCalled();
});
it.each(["exchange","verifyOtp"] as const)("recovers a synchronous %s provider throw", async method => {
 auth[method].mockImplementation(() => {throw new Error(DETAIL)});
 const response=await callback(method==="exchange"?{code:"synthetic-code"}:{token_hash:"synthetic-hash",type:"email"});
 expect(response.headers.get("location")).toBe(SIGN_IN_ERROR);
});
it.each([{code:"synthetic-code"},{token_hash:"synthetic-hash",type:"email"}] as Record<string, string>[])("does not hide server-client configuration failure %j", async params => {
 auth.createClient.mockRejectedValue(new Error("synthetic configuration failure"));
 await expect(callback(params)).rejects.toThrow("synthetic configuration failure");
 expect(auth.exchange).not.toHaveBeenCalled();expect(auth.verifyOtp).not.toHaveBeenCalled();
});
