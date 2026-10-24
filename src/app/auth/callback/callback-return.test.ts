import { beforeEach, describe, expect, it, vi } from "vitest";

// The actual callback GET with only the existing cookie-bound server client
// replaced. No real Auth, provider or network.
const auth = vi.hoisted(() => ({ exchange: vi.fn(), verifyOtp: vi.fn(), createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: auth.createClient }));

import { GET } from "./route";

const ORIGIN = "https://constructa.example.invalid";
// Raw `next` values as the route reads them; URLSearchParams encodes them.
const callback = (params: Record<string, string>) =>
    GET(new Request(`${ORIGIN}/auth/callback?${new URLSearchParams(params).toString()}`));
const BRANCHES = [
    ["code exchange", { code: "synthetic-code" }],
    ["token hash", { token_hash: "synthetic-hash", type: "signup" }],
] as const;

async function landing(params: Record<string, string>) {
    const response = await callback(params);
    expect(response.status).toBe(307);
    const location = response.headers.get("location")!;
    // Every redirect stays on the callback's own origin.
    expect(new URL(location).origin).toBe(ORIGIN);
    return location;
}

beforeEach(() => {
    vi.resetAllMocks();
    auth.createClient.mockResolvedValue({ auth: { exchangeCodeForSession: auth.exchange, verifyOtp: auth.verifyOtp } });
    auth.exchange.mockResolvedValue({ error: null });
    auth.verifyOtp.mockResolvedValue({ error: null });
});

describe("callback return stays on this site", () => {
    const hostile = [
        "@evil.example",
        "@evil.example/auth/platform-terms",
        "https://evil.example",
        "HTTPS://evil.example/dashboard",
        "javascript:alert(1)",
        "evil.example",
        "//evil.example",
        "//evil.example/dashboard",
        "/\\evil.example",
        "\\\\evil.example",
        "/\\/evil.example",
        "/\t/evil.example",
        "/\n/evil.example",
        "/\r//evil.example",
        "/\u0000/evil.example",
        " /dashboard",
        "",
    ];
    for (const [branch, params] of BRANCHES) {
        it.each(hostile)(`${branch}: next %j falls back to the dashboard`, async next => {
            expect(await landing({ ...params, next })).toBe(`${ORIGIN}/dashboard`);
        });
    }

    it.each([
        ["/auth/platform-terms", "/auth/platform-terms"],
        ["/dashboard", "/dashboard"],
        ["/dashboard/projects/costs?projectId=abc&tab=lines#notes", "/dashboard/projects/costs?projectId=abc&tab=lines#notes"],
        ["/onboarding?force=true", "/onboarding?force=true"],
    ])("keeps the local return %j after a successful code exchange and token hash", async (next, path) => {
        expect(await landing({ code: "synthetic-code", next })).toBe(`${ORIGIN}${path}`);
        expect(await landing({ token_hash: "synthetic-hash", type: "signup", next })).toBe(`${ORIGIN}${path}`);
        expect(auth.exchange).toHaveBeenCalledExactlyOnceWith("synthetic-code");
        expect(auth.verifyOtp).toHaveBeenCalledExactlyOnceWith({ token_hash: "synthetic-hash", type: "signup" });
    });

    it.each(BRANCHES)("keeps the ordinary dashboard default with no next (%s)", async (_branch, params) => {
        expect(await landing({ ...params })).toBe(`${ORIGIN}/dashboard`);
    });
});

describe("existing recovery and error handling are unchanged", () => {
    it.each(["@evil.example", "/auth/platform-terms", "//evil.example"])("recovery ignores next %j and goes to reset-password", async next => {
        expect(await landing({ code: "synthetic-code", type: "recovery", next })).toBe(`${ORIGIN}/auth/reset-password`);
        expect(await landing({ token_hash: "synthetic-hash", type: "recovery", next })).toBe(`${ORIGIN}/auth/reset-password`);
    });

    it("sends a failed code exchange or token check to the sign-in error, whatever next says", async () => {
        auth.exchange.mockResolvedValue({ error: { message: "synthetic" } });
        auth.verifyOtp.mockResolvedValue({ error: { message: "synthetic" } });
        expect(await landing({ code: "synthetic-code", next: "@evil.example" })).toBe(`${ORIGIN}/login?error=auth-code-error`);
        expect(await landing({ token_hash: "synthetic-hash", type: "signup", next: "/auth/platform-terms" })).toBe(`${ORIGIN}/login?error=auth-code-error`);
        expect(await landing({ next: "/auth/platform-terms" })).toBe(`${ORIGIN}/login?error=auth-code-error`);
    });
});
