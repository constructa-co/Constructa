import dns from "node:dns";
import net from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installReviewRuntime } from "./review-runtime";
import { REVIEW_ORIGIN, REVIEW_PROJECT, REVIEW_USER } from "./review-policy";
import { REVIEW_JOBS } from "./review-editable";

const original = { lookup: dns.lookup, connect: net.Socket.prototype.connect, fetch: globalThis.fetch };
const key = (claims: object) => `test.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.not-a-real-token`;
const headers = { apikey: key({ ref: REVIEW_PROJECT, role: "anon" }), authorization: `Bearer ${key({ sub: REVIEW_USER, role: "authenticated", iss: REVIEW_ORIGIN + "/auth/v1" })}` };
afterEach(() => {
  dns.lookup = original.lookup;
  net.Socket.prototype.connect = original.connect;
  globalThis.fetch = original.fetch;
  Reflect.deleteProperty(globalThis, Symbol.for("constructa.review.runtime.installed"));
  vi.unstubAllEnvs();
});
describe("installed review runtime boundary", () => {
  it("refuses a provider fetch before the underlying transport", async () => {
    const send = vi.fn(); globalThis.fetch = send; installReviewRuntime();
    await expect(fetch("https://api.openai.com/v1/responses")).rejects.toThrow("REFUSED");
    expect(send).not.toHaveBeenCalled();
  });
  it("allows only a validated read and forces redirect refusal", async () => {
    const send = vi.fn().mockResolvedValue(new Response("[]")); globalThis.fetch = send; installReviewRuntime();
    await fetch(REVIEW_ORIGIN + "/rest/v1/projects", { headers });
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0][1]).toEqual({ redirect: "error" });
  });
  it("refuses direct DNS and sockets outside validated fetch context", () => {
    installReviewRuntime();
    expect(() => dns.lookup("api.resend.com", () => {})).toThrow("REVIEW_DNS_REFUSED");
    expect(() => new net.Socket().connect({ host: "192.0.2.1", port: 443 })).toThrow("REVIEW_SOCKET_REFUSED");
    expect(() => new net.Socket().connect({ host: new URL(REVIEW_ORIGIN).hostname, port: 443 })).toThrow("REVIEW_SOCKET_REFUSED");
  });
  it("rejects a refreshed session for a different test user", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ user: { id: "someone-else" } })));
    installReviewRuntime();
    await expect(fetch(REVIEW_ORIGIN + "/auth/v1/token?grant_type=refresh_token", { method: "POST", headers, body: JSON.stringify({ refresh_token: "not-real" }) })).rejects.toThrow("REVIEW_SESSION_USER_REFUSED");
  });
  it("installs once", () => { installReviewRuntime(); const installed = fetch; installReviewRuntime(); expect(fetch).toBe(installed); });
  it("checks live ownership before forwarding an editable project save", async () => {
    vi.stubEnv("CONSTRUCTA_REVIEW_EDITABLE", "1");
    const id = REVIEW_JOBS[0];
    const send = vi.fn<typeof fetch>(async (input, init) => new Request(input, init).method === "GET"
      ? new Response(JSON.stringify([{ id, user_id: REVIEW_USER, status: "Lead", proposal_status: "draft" }]))
      : new Response(JSON.stringify([{ id }])));
    globalThis.fetch = send;
    installReviewRuntime();
    const response = await fetch(`${REVIEW_ORIGIN}/rest/v1/projects?id=eq.${id}&user_id=eq.${REVIEW_USER}`, {
      method: "PATCH", headers, body: JSON.stringify({ scope_text: "Test draft" }),
    });
    expect(response.ok).toBe(true);
    expect(send.mock.calls.map(([r]) => r instanceof Request ? r.method : "unexpected input")).toEqual(["GET", "PATCH"]);
    const first = send.mock.calls[0][0];
    expect(first instanceof Request ? first.url : "unexpected input").toContain("select=id%2Cuser_id%2Cstatus");
  });
  it("never forwards a mutation when the ownership read fails", async () => {
    vi.stubEnv("CONSTRUCTA_REVIEW_EDITABLE", "1");
    const send = vi.fn().mockResolvedValue(new Response("[]", { status: 403 }));
    globalThis.fetch = send;
    installReviewRuntime();
    await expect(fetch(`${REVIEW_ORIGIN}/rest/v1/projects?id=eq.${REVIEW_JOBS[0]}&user_id=eq.${REVIEW_USER}`, {
      method: "PATCH", headers, body: JSON.stringify({ scope_text: "Test draft" }),
    })).rejects.toThrow("REVIEW_OWNERSHIP_READ_FAILED");
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0][0].method).toBe("GET");
  });
});
