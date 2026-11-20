#!/usr/bin/env node
/**
 * D69 read-only production marketing audit (CI only).
 * GET/HEAD against the repo-configured public origin; no writes, no auth routes.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import {
  loadMarketingAuditTarget,
  normalizePathname,
  pathIsDisallowed,
  pathIsMarketingSitemap,
  isSamePublicSite,
  toAbsoluteMarketingUrl,
} from "./load-audit-target.mjs";
import {
  KNOWN_TELEMETRY_IGNORES,
  matchKnownTelemetryIgnore,
} from "./known-telemetry-ignores.mjs";

const MOBILE_WIDTH = 390;
const MOBILE_HEIGHT = 844;
const OUTPUT_DIR = path.resolve("readonlyaudit");
const SCREENSHOT_DIR = path.join(OUTPUT_DIR, "screenshots");

const EXTRA_BLOCKED_PATH_PREFIXES = [
  "/signup",
  "/sign-up",
  "/register",
];

const BLOCKED_HOST_PATTERNS = [
  /supabase\.co/i,
  /formspree\.io/i,
  /convertkit\.com/i,
];

function slugForPath(pathname) {
  if (pathname === "/") return "root";
  return pathname.replace(/^\//, "").replace(/\//g, "_");
}

function classifyRequest(urlString, method, disallowPrefixes) {
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
  const blocked = [
    ...disallowPrefixes,
    ...EXTRA_BLOCKED_PATH_PREFIXES,
  ];
  if (blocked.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return { allowed: false, reason: `blocked path ${path}` };
  }
  if (path.startsWith("/api/")) {
    return { allowed: false, reason: "blocked API path" };
  }
  return { allowed: true };
}

function checkOpenGraph(meta) {
  const required = ["og:title", "og:description"];
  const recommended = ["og:image", "og:url"];
  const missingRequired = required.filter((key) => !meta[key]?.trim());
  const missingRecommended = recommended.filter((key) => !meta[key]?.trim());
  let status = "pass";
  if (missingRequired.length) status = "fail";
  else if (missingRecommended.length) status = "fail";
  return { status, missingRequired, missingRecommended, values: meta };
}

function renderMarkdown(report) {
  const lines = [
    "# D69 production marketing audit (read-only)",
    "",
    `Generated: ${report.generatedAt}`,
    `Public origin: ${report.publicOrigin}`,
    `Origin source: ${report.publicOriginSource}`,
    `Git ref: ${report.gitRef ?? "unknown"}`,
    "",
    "## Summary",
    "",
    `| Metric | Value |`,
    `| --- | --- |`,
    `| Pages audited | ${report.summary.pagesAudited} |`,
    `| Pages failed | ${report.summary.pagesFailed} |`,
    `| Pages passed | ${report.summary.pagesPassed} |`,
    `| Intercepted non-GET/HEAD or disallowed requests | ${report.interceptedRequests.length} |`,
    `| Missing checks | ${report.missingChecks.length} |`,
    "",
    "## Known telemetry ignores (never treated as pass)",
    "",
    ...KNOWN_TELEMETRY_IGNORES.map(
      (e) => `- **${e.id}**: ${e.reason}`,
    ),
    "",
    "## Pages",
    "",
  ];

  for (const page of report.pages) {
    lines.push(`### ${page.path}`);
    lines.push("");
    lines.push(`- URL: ${page.url}`);
    lines.push(`- HTTP: ${page.httpStatus ?? "n/a"} (${page.checks.httpSuccess.status})`);
    lines.push(`- Title: ${page.checks.title.status} — ${page.checks.title.value ?? "(missing)"}`);
    lines.push(
      `- Meta description: ${page.checks.metaDescription.status}`,
    );
    lines.push(
      `- Open Graph: ${page.checks.openGraph.status}` +
        (page.checks.openGraph.missingRequired?.length
          ? ` — missing ${page.checks.openGraph.missingRequired.join(", ")}`
          : ""),
    );
    lines.push(
      `- Mobile ${MOBILE_WIDTH}px overflow: ${page.checks.mobileOverflow.status}` +
        (page.checks.mobileOverflow.scrollWidth != null
          ? ` (scroll ${page.checks.mobileOverflow.scrollWidth} / client ${page.checks.mobileOverflow.clientWidth})`
          : ""),
    );
    lines.push(`- Console errors: ${page.checks.consoleErrors.status}`);
    lines.push(`- Page errors: ${page.checks.pageErrors.status}`);
    if (page.checks.internalLinks.failures.length) {
      lines.push("- Broken same-origin public links:");
      for (const link of page.checks.internalLinks.failures) {
        lines.push(`  - ${link.href}: ${link.detail}`);
      }
    }
    if (page.checks.consoleErrors.errors.length) {
      lines.push("- Console (counted):");
      for (const err of page.checks.consoleErrors.errors) {
        lines.push(`  - ${err.text}`);
      }
    }
    if (page.checks.consoleErrors.ignored.length) {
      lines.push("- Console (ignored telemetry):");
      for (const err of page.checks.consoleErrors.ignored) {
        lines.push(`  - ${err.text} — ${err.ignoreReason}`);
      }
    }
    if (page.screenshot) {
      lines.push(`- Screenshot: ${page.screenshot}`);
    }
    lines.push("");
  }

  if (report.missingChecks.length) {
    lines.push("## Missing checks");
    lines.push("");
    for (const item of report.missingChecks) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  if (report.interceptedRequests.length) {
    lines.push("## Intercepted requests (harness enforcement, not product pass/fail)");
    lines.push("");
    for (const v of report.interceptedRequests.slice(0, 50)) {
      lines.push(`- ${v.method} ${v.url} — ${v.reason}`);
    }
    if (report.interceptedRequests.length > 50) {
      lines.push(`- …and ${report.interceptedRequests.length - 50} more`);
    }
    lines.push("");
  }

  lines.push("## Limitations");
  lines.push("");
  for (const note of report.limitations) {
    lines.push(`- ${note}`);
  }
  lines.push("");

  return lines.join("\n");
}

async function main() {
  const target = loadMarketingAuditTarget();
  mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const report = {
    auditId: "d69-marketing-production-readonly",
    generatedAt: new Date().toISOString(),
    publicOrigin: target.publicOrigin,
    publicOriginSource: target.publicOriginSource,
    marketingSeoPath: target.marketingSeoPath,
    gitRef: process.env.GITHUB_SHA ?? process.env.GIT_COMMIT ?? null,
    sitemapPaths: target.sitemapPaths,
    disallowPrefixes: target.disallowPrefixes,
    pages: [],
    interceptedRequests: [],
    missingChecks: [],
    limitations: [
      "Audit scope is MARKETING_SITEMAP_PATHS only; /guides and app routes are not loaded.",
      "Sign-in and dashboard links may appear in chrome but those destinations are not fetched.",
      "Third-party assets (fonts, images CDN) are allowed when request method is GET/HEAD.",
      "No product or schema changes; findings are evidence for a follow-up source-fix PR.",
    ],
    summary: {
      pagesAudited: 0,
      pagesPassed: 0,
      pagesFailed: 0,
    },
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "ConstructaD69MarketingAudit/1.0 (+https://www.constructa.co; read-only CI)",
    viewport: { width: MOBILE_WIDTH, height: MOBILE_HEIGHT },
    deviceScaleFactor: 1,
    serviceWorkers: "block",
  });

  let activePagePath = null;

  await context.route("**/*", (route) => {
    const req = route.request();
    if (req.isNavigationRequest() && (!isSamePublicSite(req.url(), target.publicOrigin) || !pathIsMarketingSitemap(new URL(req.url()).pathname, target.sitemapPaths))) {
      report.interceptedRequests.push({ method: req.method(), url: req.url(), reason: "navigation outside public marketing allowlist", pagePath: activePagePath });
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
        pagePath: activePagePath,
      });
      void route.abort("blockedbyclient");
      return;
    }
    void route.continue();
  });

  const request = context.request;

  for (const pathname of target.sitemapPaths) {
    const url = toAbsoluteMarketingUrl(pathname, target.publicOrigin);
    activePagePath = normalizePathname(pathname);
    const pageReport = {
      path: normalizePathname(pathname),
      url,
      httpStatus: null,
      screenshot: null,
      checks: {
        httpSuccess: { status: "missing", detail: null },
        title: { status: "missing", value: null },
        metaDescription: { status: "missing", value: null, length: null },
        openGraph: { status: "missing" },
        mobileOverflow: { status: "missing" },
        consoleErrors: { status: "missing", errors: [], ignored: [] },
        pageErrors: { status: "missing", errors: [] },
        internalLinks: {
          status: "missing",
          checked: [],
          skipped: [],
          failures: [],
        },
      },
    };

    const page = await context.newPage();
    const consoleErrors = [];
    const consoleIgnored = [];
    const pageErrors = [];
    const requestFailures = [];

    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      const text = msg.text();
      const ignore = matchKnownTelemetryIgnore(text, "console");
      if (ignore) {
        consoleIgnored.push({ text, ignoreId: ignore.id, ignoreReason: ignore.reason });
        return;
      }
      consoleErrors.push({ text, type: msg.type() });
    });

    page.on("pageerror", (err) => {
      pageErrors.push({ message: err.message, stack: err.stack ?? null });
    });

    page.on("requestfailed", (req) => {
      const failure = req.failure();
      const text = `${req.url()} ${failure?.errorText ?? ""}`;
      const ignore = matchKnownTelemetryIgnore(text, "requestfailed");
      if (ignore) {
        consoleIgnored.push({
          text,
          ignoreId: ignore.id,
          ignoreReason: ignore.reason,
        });
        return;
      }
      requestFailures.push({ url: req.url(), error: failure?.errorText ?? "failed" });
    });

    let response;
    try {
      response = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
    } catch (err) {
      pageReport.checks.httpSuccess = {
        status: "fail",
        detail: err instanceof Error ? err.message : String(err),
      };
      pageReport.outcome = "fail";
      report.pages.push(pageReport);
      await page.close();
      continue;
    }

    pageReport.httpStatus = response?.status() ?? null;
    pageReport.checks.httpSuccess = {
      status: response && response.ok() ? "pass" : "fail",
      detail: response ? `HTTP ${response.status()}` : "no response",
    };

    const title = await page.title();
    pageReport.checks.title = {
      status: title?.trim() ? "pass" : "fail",
      value: title ?? "",
    };

    const description = await page
      .locator('meta[name="description"]')
      .first()
      .getAttribute("content")
      .catch(() => null);
    const descTrim = description?.trim() ?? "";
    pageReport.checks.metaDescription = {
      status: descTrim.length > 0 ? "pass" : "fail",
      value: descTrim,
      length: descTrim.length,
    };

    const og = await page.evaluate(() => {
      const out = {};
      for (const el of document.querySelectorAll('meta[property^="og:"]')) {
        const key = el.getAttribute("property");
        const content = el.getAttribute("content");
        if (key && content) out[key] = content;
      }
      const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href");
      if (canonical) out["canonical"] = canonical;
      return out;
    });
    pageReport.checks.openGraph = checkOpenGraph(og);

    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      const body = document.body;
      const scrollW = Math.max(doc.scrollWidth, body?.scrollWidth ?? 0);
      const clientW = doc.clientWidth;
      return { scrollWidth: scrollW, clientWidth: clientW, overflows: scrollW > clientW + 1 };
    });
    pageReport.checks.mobileOverflow = {
      status: overflow.overflows ? "fail" : "pass",
      scrollWidth: overflow.scrollWidth,
      clientWidth: overflow.clientWidth,
    };

    const shotName = `${slugForPath(pageReport.path)}-${MOBILE_WIDTH}.png`;
    const shotPath = path.join(SCREENSHOT_DIR, shotName);
    await page.screenshot({ path: shotPath, fullPage: true }).catch((err) => {
      report.missingChecks.push(
        `${pageReport.path}: mobile screenshot failed — ${err instanceof Error ? err.message : String(err)}`,
      );
    });
    pageReport.screenshot = path.relative(process.cwd(), shotPath);

    const hrefs = await page.evaluate(() =>
      [...document.querySelectorAll("a[href]")]
        .map((a) => a.getAttribute("href"))
        .filter(Boolean),
    );

    const checked = [];
    const skipped = [];
    const failures = [];

    for (const href of hrefs) {
      if (href.startsWith("mailto:") || href.startsWith("tel:") || href === "#") {
        skipped.push({ href, reason: "non-http link" });
        continue;
      }
      let absolute;
      try {
        absolute = new URL(href, url).toString();
      } catch {
        skipped.push({ href, reason: "unparseable href" });
        continue;
      }
      if (!isSamePublicSite(absolute, target.publicOrigin)) {
        skipped.push({ href, reason: "external origin" });
        continue;
      }
      const linkPath = normalizePathname(new URL(absolute).pathname);
      if (pathIsDisallowed(linkPath, target.disallowPrefixes)) {
        skipped.push({ href: linkPath, reason: "non-marketing route (not fetched)" });
        continue;
      }
      if (!pathIsMarketingSitemap(linkPath, target.sitemapPaths)) {
        skipped.push({ href: linkPath, reason: "same-origin but outside sitemap scope" });
        continue;
      }
      try {
        let status;
        const head = await request.head(absolute, {
          timeout: 30_000,
          failOnStatusCode: false,
          maxRedirects: 0,
        });
        status = head.status();
        if (status === 405 || status === 501) {
          const get = await request.get(absolute, {
            timeout: 30_000,
            failOnStatusCode: false,
          maxRedirects: 0,
          });
          status = get.status();
        }
        if (status >= 200 && status < 400) {
          checked.push({ href: linkPath, status });
        } else {
          failures.push({ href: linkPath, detail: `HTTP ${status}` });
        }
      } catch (err) {
        failures.push({
          href: linkPath,
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    }

    pageReport.checks.internalLinks = {
      status: failures.length ? "fail" : "pass",
      checked,
      skipped,
      failures,
    };

    const countedConsole = [...consoleErrors];
    for (const rf of requestFailures) {
      countedConsole.push({ text: `requestfailed: ${rf.url} — ${rf.error}`, type: "requestfailed" });
    }

    pageReport.checks.consoleErrors = {
      status: countedConsole.length ? "fail" : "pass",
      errors: countedConsole,
      ignored: consoleIgnored,
    };
    pageReport.checks.pageErrors = {
      status: pageErrors.length ? "fail" : "pass",
      errors: pageErrors,
    };

    const pageFailed =
      pageReport.checks.httpSuccess.status === "fail" ||
      pageReport.checks.title.status === "fail" ||
      pageReport.checks.metaDescription.status === "fail" ||
      pageReport.checks.openGraph.status === "fail" /* missing required OG only */ ||
      pageReport.checks.mobileOverflow.status === "fail" ||
      pageReport.checks.consoleErrors.status === "fail" ||
      pageReport.checks.pageErrors.status === "fail" ||
      pageReport.checks.internalLinks.status === "fail";

    pageReport.outcome = pageFailed ? "fail" : "pass";
    report.pages.push(pageReport);
    await page.close();
  }

  await request.dispose();
  await browser.close();

  report.summary.pagesAudited = report.pages.length;
  report.summary.pagesFailed = report.pages.filter((p) => p.outcome === "fail").length;
  report.summary.pagesPassed = report.summary.pagesAudited - report.summary.pagesFailed;

  const jsonPath = path.join(OUTPUT_DIR, "marketing-production-audit.json");
  const mdPath = path.join(OUTPUT_DIR, "marketing-production-audit.md");
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(mdPath, renderMarkdown(report));

  const hardFail = report.summary.pagesFailed > 0;

  console.log(`Wrote ${jsonPath} and ${mdPath}`);
  console.log(
    `Summary: ${report.summary.pagesPassed}/${report.summary.pagesAudited} pages passed`,
  );

  if (hardFail) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  const fallback = {
    auditId: "d69-marketing-production-readonly",
    generatedAt: new Date().toISOString(),
    fatalError: err instanceof Error ? err.message : String(err),
    missingChecks: ["Audit runner aborted before page loop completed"],
  };
  try {
    mkdirSync(OUTPUT_DIR, { recursive: true });
    writeFileSync(
      path.join(OUTPUT_DIR, "marketing-production-audit.json"),
      `${JSON.stringify(fallback, null, 2)}\n`,
    );
    writeFileSync(
      path.join(OUTPUT_DIR, "marketing-production-audit.md"),
      `# D69 marketing audit — fatal error\n\n${fallback.fatalError}\n`,
    );
  } catch {
    // best effort
  }
  console.error(err);
  process.exitCode = 1;
});