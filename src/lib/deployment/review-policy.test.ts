import { describe, expect, it } from "vitest";
import { assertReviewFetch, reviewEnabled, reviewPageAllowed, REVIEW_CSP, REVIEW_ORIGIN, REVIEW_PROJECT, REVIEW_USER } from "./review-policy";

const key = (claims: object) => `not-a-real-signature.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.test-only`;
const anon = key({ ref: REVIEW_PROJECT, role: "anon" });
const actor = key({ sub: REVIEW_USER, role: "authenticated", iss: `${REVIEW_ORIGIN}/auth/v1` });
function request(path: string, method = "GET", body?: object, token = actor, apiKey = anon) {
  return new Request(REVIEW_ORIGIN + path, { method, headers: { apikey: apiKey, authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
}

describe("protected review configuration", () => {
  it("does not change normal deployments", () => expect(reviewEnabled({})).toBe(false));
  it("requires preview plus the exact isolated project", () => {
    const env = { CONSTRUCTA_REVIEW_ONLY: "1", VERCEL_ENV: "preview", NEXT_PUBLIC_SUPABASE_URL: REVIEW_ORIGIN, CONSTRUCTA_NONPROD_SUPABASE_PROJECT_REF: REVIEW_PROJECT };
    expect(reviewEnabled(env)).toBe(true);
    expect(() => reviewEnabled({ ...env, VERCEL_ENV: "production" })).toThrow();
    expect(() => reviewEnabled({ ...env, NEXT_PUBLIC_SUPABASE_URL: "https://wrong.supabase.co" })).toThrow();
    expect(() => reviewEnabled({ ...env, CONSTRUCTA_NONPROD_SUPABASE_PROJECT_REF: "wrong" })).toThrow();
  });
  it.each(["POST", "PATCH", "PUT", "DELETE"])("refuses incoming %s", method => expect(reviewPageAllowed(method, "/dashboard/projects/costs")).toBe(false));
  it.each(["/api/theme", "/api/cron/contract-alerts", "/proposal/token", "/supervisor/token", "/admin", "/auth/reset-password", "/auth/forgot-password", "/auth/callback"])("refuses side-effect or unapproved entry %s", path => expect(reviewPageAllowed("GET", path)).toBe(false));
  it.each(["/", "/login", "/dashboard", "/dashboard/projects/costs", "/dashboard/projects/schedule", "/dashboard/projects/proposal"])("allows view %s", path => expect(reviewPageAllowed("GET", path)).toBe(true));
  it("does not permit direct browser data writes, external analytics or signup", () => {
    expect(REVIEW_CSP).toContain(`${REVIEW_ORIGIN}/auth/v1/token`);
    expect(REVIEW_CSP).not.toMatch(/rest\/v1|storage\/v1|signup|plausible|clarity|https:\s|\*|unsafe-eval/);
  });
});

describe("review server egress", () => {
  it.each(["/auth/v1/user", "/rest/v1/profiles?select=company_name", "/rest/v1/projects", "/rest/v1/estimate_lines"])("allows existing labelled user read %s", async path => {
    await expect(assertReviewFetch(request(path))).resolves.toBeUndefined();
  });
  it.each(["POST", "PATCH", "DELETE"])("rejects saved-record %s", async method => {
    await expect(assertReviewFetch(request("/rest/v1/projects", method, { name: "Do not save" }))).rejects.toThrow("REFUSED");
  });
  it.each(["/rest/v1/rpc/publish_proposal", "/rest/v1/rpc/create_phase1_project_graph", "/storage/v1/object/example", "/auth/v1/signup", "/auth/v1/recover", "/auth/v1/admin/users"])("rejects %s", async path => {
    await expect(assertReviewFetch(request(path, "POST", {}))).rejects.toThrow("REFUSED");
  });
  it("rejects unknown tables, different actors and privileged keys", async () => {
    await expect(assertReviewFetch(request("/rest/v1/secrets"))).rejects.toThrow();
    await expect(assertReviewFetch(request("/rest/v1/projects", "GET", undefined, key({ sub: "another-user", role: "authenticated", iss: `${REVIEW_ORIGIN}/auth/v1` })))).rejects.toThrow();
    await expect(assertReviewFetch(request("/rest/v1/projects", "GET", undefined, actor, key({ ref: REVIEW_PROJECT, role: "service_role" })))).rejects.toThrow();
  });
  it.each(["https://api.openai.com/v1/chat/completions", "https://api.resend.com/emails", "https://pudadynieiuypxeoimnz.supabase.co/rest/v1/projects", "https://umqtzfsnyoofmgfbnrgv.supabase.co.evil.test/rest/v1/projects"])("rejects other target %s", async url => {
    await expect(assertReviewFetch(new Request(url))).rejects.toThrow();
  });
  it("permits only existing-session refresh, not password login or user changes on the server", async () => {
    await expect(assertReviewFetch(request("/auth/v1/token?grant_type=refresh_token", "POST", { refresh_token: "test-not-a-real-refresh-token" }, anon))).resolves.toBeUndefined();
    await expect(assertReviewFetch(request("/auth/v1/token?grant_type=password", "POST", { email: "test@example.test", password: "not-real" }, anon))).rejects.toThrow();
    await expect(assertReviewFetch(request("/auth/v1/user", "PUT", {}))).rejects.toThrow();
  });
});
