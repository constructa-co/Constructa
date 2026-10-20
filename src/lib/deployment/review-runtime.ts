import { AsyncLocalStorage } from "node:async_hooks";
import dns from "node:dns";
import net from "node:net";
import { assertReviewFetch, REVIEW_ORIGIN, REVIEW_USER } from "./review-policy";
import { assertEditableReviewFetch, editableReview, type ReviewLookup } from "./review-editable";

export function installReviewRuntime() {
  const marker = Symbol.for("constructa.review.runtime.installed");
  if (Reflect.get(globalThis, marker)) return;
  const transport = new AsyncLocalStorage<boolean>();
  const host = new URL(REVIEW_ORIGIN).hostname;
  const local = (value: unknown) => ["localhost", "127.0.0.1", "::1", "[::1]"].includes(String(value));
  const lookup = dns.lookup;
  dns.lookup = function (this: typeof dns, hostname: string, ...args: unknown[]) {
    if (!local(hostname) && !(hostname === host && transport.getStore())) throw new Error("REVIEW_DNS_REFUSED");
    return Reflect.apply(lookup, this, [hostname, ...args]);
  } as typeof dns.lookup;
  const connect = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function (this: net.Socket, ...args: unknown[]) {
    if (Array.isArray(args[0])) args = args[0];
    const options = typeof args[0] === "object" && args[0] !== null ? args[0] as { host?: string; path?: string } : null;
    const hostname = options?.host ?? (typeof args[1] === "string" ? args[1] : "localhost");
    const socketPath = options?.path ?? (typeof args[0] === "string" && !/^\d+$/.test(args[0]));
    if (!socketPath && !local(hostname) && !(hostname === host && transport.getStore())) throw new Error("REVIEW_SOCKET_REFUSED");
    return Reflect.apply(connect, this, args);
  } as typeof net.Socket.prototype.connect;
  const fetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const lookup: ReviewLookup = async (table, id) => {
      if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error("REVIEW_LOOKUP_ID_REFUSED");
      const query = new URL(`${REVIEW_ORIGIN}/rest/v1/${table}`);
      query.searchParams.set("id", `eq.${id}`);
      query.searchParams.set("select", table === "projects" ? "id,user_id,status,is_archived,proposal_status,proposal_accepted_at" : table === "estimates" ? "id,project_id" : table === "estimate_lines" ? "id,estimate_id" : "id,estimate_line_id");
      const probe = new Request(query, { headers: { apikey: request.headers.get("apikey") ?? "", authorization: request.headers.get("authorization") ?? "" } });
      await assertReviewFetch(probe);
      const reply = await transport.run(true, () => fetch(probe, { redirect: "error", signal: AbortSignal.timeout(15000) }));
      if (!reply.ok) throw new Error("REVIEW_OWNERSHIP_READ_FAILED");
      const rows = await reply.json();
      return Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
    };
    await assertReviewFetch(request, editableReview() ? r => assertEditableReviewFetch(r, lookup) : undefined);
    const response = await transport.run(true, () => fetch(request, { redirect: "error" }));
    if (new URL(request.url).pathname === "/auth/v1/token" && response.ok) {
      const body = await response.clone().json();
      if (body?.user?.id !== REVIEW_USER) throw new Error("REVIEW_SESSION_USER_REFUSED");
    }
    return response;
  };
  Reflect.set(globalThis, marker, true);
}
