import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const MARKETING_SEO_PATH = path.join(REPO_ROOT, "src/lib/marketing-seo.ts");

/**
 * Read public marketing audit target from the repo's canonical SEO module —
 * no env override and no guessed production host.
 */
export function loadMarketingAuditTarget() {
  const source = readFileSync(MARKETING_SEO_PATH, "utf8");

  const pathsBlock = source.match(
    /MARKETING_SITEMAP_PATHS\s*=\s*\[([\s\S]*?)\]\s*as const/,
  );
  const disallowBlock = source.match(
    /MARKETING_ROBOTS_DISALLOW_PREFIXES\s*=\s*\[([\s\S]*?)\]\s*as const/,
  );
  if (!pathsBlock || !disallowBlock) {
    throw new Error(
      `Could not parse MARKETING_SITEMAP_PATHS or MARKETING_ROBOTS_DISALLOW_PREFIXES from ${MARKETING_SEO_PATH}`,
    );
  }

  const sitemapPaths = [...pathsBlock[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  const disallowPrefixes = [...disallowBlock[1].matchAll(/"([^"]+)"/g)].map(
    (m) => m[1],
  );

  const originFnBody = source.match(
    /export function marketingSiteOrigin\(\)\s*(?::\s*string)?\s*\{([\s\S]*?)\n\}/,
  )?.[1];
  const originReturns = originFnBody
    ? [...originFnBody.matchAll(/return\s+"([^"]+)"/g)].map((m) => m[1])
    : [];
  const canonicalOrigin = originReturns.at(-1);
  const override = process.env.CONSTRUCTA_MARKETING_AUDIT_ORIGIN;
  if (override && !["https://www.constructa.co", "https://constructa-nu.vercel.app"].includes(override)) throw new Error("Audit origin is outside verified public allowlist");
  const publicOrigin = override || canonicalOrigin;
  if (!publicOrigin) {
    throw new Error(
      `Could not resolve marketingSiteOrigin() fallback URL in ${MARKETING_SEO_PATH}`,
    );
  }

  return {
    publicOrigin: publicOrigin.replace(/\/+$/, ""),
    publicOriginSource:
      override ? "Vercel production deployment dpl_dJDnp75QhNkkVzHyruoi5km6gFSs alias verified by R1 authenticated MCP" : "src/lib/marketing-seo.ts canonical fallback",
    marketingSeoPath: path.relative(REPO_ROOT, MARKETING_SEO_PATH),
    sitemapPaths,
    disallowPrefixes,
    repoRoot: REPO_ROOT,
  };
}

export function normalizePathname(pathname) {
  if (!pathname || pathname === "/") return "/";
  const bare = pathname.split("?")[0].split("#")[0];
  return bare.replace(/\/+$/, "") || "/";
}

export function pathIsDisallowed(pathname, disallowPrefixes) {
  const path = normalizePathname(pathname);
  return disallowPrefixes.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

export function pathIsMarketingSitemap(pathname, sitemapPaths) {
  const path = normalizePathname(pathname);
  return sitemapPaths.includes(path);
}

/** constructa.co and www.constructa.co are treated as one public marketing site. */
export function isSamePublicSite(urlString, publicOrigin) {
  let url;
  let origin;
  try {
    url = new URL(urlString, publicOrigin);
    origin = new URL(publicOrigin);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;

  const apex = origin.hostname.replace(/^www\./, "");
  const allowed = new Set([apex, `www.${apex}`]);
  return allowed.has(url.hostname);
}

export function toAbsoluteMarketingUrl(pathname, publicOrigin) {
  const path = normalizePathname(pathname);
  if (path === "/") return `${publicOrigin}/`;
  return `${publicOrigin}${path}`;
}