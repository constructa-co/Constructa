export const REVIEW_PROJECT = "umqtzfsnyoofmgfbnrgv";
export const REVIEW_ORIGIN = `https://${REVIEW_PROJECT}.supabase.co`;
export const REVIEW_USER = "5f13c70d-7cf4-4080-9b2a-650a5a7f4ff2";

const READ_TABLES = new Set([
  "profiles", "projects", "estimates", "estimate_lines", "estimate_line_components",
  "organization_members", "organizations", "invoices", "variations", "change_events",
  "rfis", "early_warnings", "contracts", "proposal_publications", "proposal_delivery_attempts",
  "rate_buildups", "labour_rates", "cost_library_items",
]);

export function reviewEnabled(env: Record<string, string | undefined> = process.env) {
  if (env.CONSTRUCTA_REVIEW_ONLY !== "1") return false;
  if (env.VERCEL_ENV && env.VERCEL_ENV !== "preview") throw new Error("Review mode requires a Preview deployment.");
  if (env.NEXT_PUBLIC_SUPABASE_URL !== REVIEW_ORIGIN || env.CONSTRUCTA_NONPROD_SUPABASE_PROJECT_REF !== REVIEW_PROJECT) {
    throw new Error("Review mode requires the declared test backend.");
  }
  return true;
}

export function reviewPageAllowed(method: string, pathname: string) {
  return ["GET", "HEAD"].includes(method.toUpperCase()) &&
    !/^\/(api|admin|proposal|supervisor)(\/|$)/.test(pathname) &&
    !/^\/auth\/(forgot-password|reset-password|callback)(\/|$)/.test(pathname);
}

export const REVIEW_CSP = [
  "default-src 'self'", "script-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:", "font-src 'self' data:",
  `connect-src 'self' ${REVIEW_ORIGIN}/auth/v1/token ${REVIEW_ORIGIN}/auth/v1/user ${REVIEW_ORIGIN}/auth/v1/logout`,
  "form-action 'self'", "frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'",
].join("; ");

function claims(token: string) {
  try { return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()) as Record<string, unknown>; }
  catch { return {}; }
}

export async function assertReviewFetch(request: Request, edit?: (request: Request) => Promise<void>) {
  const refuse = () => { throw new Error("REVIEW_READ_ONLY_REQUEST_REFUSED"); };
  const url = new URL(request.url);
  if (url.origin !== REVIEW_ORIGIN || url.username || url.password || url.hash) refuse();
  const key = claims(request.headers.get("apikey") ?? "");
  if (key.ref !== REVIEW_PROJECT || key.role !== "anon") refuse();
  const actor = claims((request.headers.get("authorization") ?? "").replace(/^Bearer /i, ""));
  const ownUser = actor.sub === REVIEW_USER && actor.role === "authenticated" && actor.iss === `${REVIEW_ORIGIN}/auth/v1`;
  if (request.method === "GET" && url.pathname === "/auth/v1/user" && ownUser) return;
  if (["GET", "HEAD"].includes(request.method) && ownUser && url.pathname.startsWith("/rest/v1/") && READ_TABLES.has(url.pathname.slice(9))) return;
  // Refreshing/signing out an existing session is not permission to create
  // users, change credentials, send email or modify saved project records.
  if (request.method === "POST" && url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "refresh_token") {
    const body = await request.clone().json().catch(() => null);
    if (typeof body?.refresh_token === "string" && body.refresh_token.length > 0) return;
  }
  if (request.method === "POST" && url.pathname === "/auth/v1/logout" && ownUser && url.searchParams.get("scope") === "local") return;
  if (edit && ownUser) return edit(request);
  refuse();
}
