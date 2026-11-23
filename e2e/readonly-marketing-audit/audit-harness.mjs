/**
 * Shared read-only marketing audit guards (D69/D79).
 * GET/HEAD only; blocks auth, API, providers, signup, and unsafe redirects.
 */
import {
  isSamePublicSite,
  normalizePathname,
  pathIsMarketingSitemap,
} from "./load-audit-target.mjs";

export const MOBILE_WIDTH = 390;
export const MOBILE_HEIGHT = 844;

export const EXTRA_BLOCKED_PATH_PREFIXES = ["/signup", "/sign-up", "/register"];

export const BLOCKED_HOST_PATTERNS = [
  /supabase\.co/i,
  /formspree\.io/i,
  /convertkit\.com/i,
];

export function slugForPath(pathname) {
  if (pathname === "/") return "root";
  return pathname.replace(/^\//, "").replace(/\//g, "_");
}

export function classifyRequest(urlString, method, disallowPrefixes) {
  const upper = method.toUpperCase();
  if (upper !== "GET" && upper !== "HEAD") {
    return { allowed: false, reason: `blocked method ${upper}` };
  }
  let url;
  try {
    url = new URL(urlString);
  } catch {
    return { allowed: false, reason: "invalid URL" };
  }
  if (BLOCKED_HOST_PATTERNS.some((re) => re.test(url.hostname))) {
    return { allowed: false, reason: `blocked provider host ${url.hostname}` };
  }
  const path = normalizePathname(url.pathname);
  const blocked = [...disallowPrefixes, ...EXTRA_BLOCKED_PATH_PREFIXES];
  if (blocked.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return { allowed: false, reason: `blocked path ${path}` };
  }
  if (path === "/api" || path.startsWith("/api/")) {
    return { allowed: false, reason: "blocked API path" };
  }
  return { allowed: true };
}

/**
 * Playwright context with route guards and service workers blocked.
 */
export async function createGuardedBrowserContext(browser, target, report) {
  const context = await browser.newContext({
    userAgent:
      "ConstructaMarketingReadonlyAudit/1.0 (+https://www.constructa.co; read-only CI)",
    viewport: { width: MOBILE_WIDTH, height: MOBILE_HEIGHT },
    deviceScaleFactor: 1,
    serviceWorkers: "block",
  });

  const state = { activePagePath: null };

  await context.route("**/*", (route) => {
    const req = route.request();
    if (
      req.isNavigationRequest() &&
      (!isSamePublicSite(req.url(), target.publicOrigin) ||
        !pathIsMarketingSitemap(
          new URL(req.url()).pathname,
          target.sitemapPaths,
        ))
    ) {
      report.interceptedRequests.push({
        method: req.method(),
        url: req.url(),
        reason: "navigation outside public marketing allowlist",
        pagePath: state.activePagePath,
      });
      return route.abort("blockedbyclient");
    }
    const decision = classifyRequest(
      req.url(),
      req.method(),
      target.disallowPrefixes,
    );
    if (!decision.allowed) {
      report.interceptedRequests.push({
        method: req.method(),
        url: req.url(),
        reason: decision.reason,
        pagePath: state.activePagePath,
      });
      void route.abort("blockedbyclient");
      return;
    }
    void route.continue();
  });

  return {
    context,
    setActivePagePath(pathname) {
      state.activePagePath = normalizePathname(pathname);
    },
  };
}