#!/usr/bin/env node
/**
 * D79 read-only Lighthouse performance + accessibility (CI only).
 * Single cold navigation per URL; no clicks, form posts, or signup.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";
import { chromium } from "@playwright/test";
import { loadMarketingAuditTarget, toAbsoluteMarketingUrl } from "./load-audit-target.mjs";
import { EXTRA_BLOCKED_PATH_PREFIXES, classifyRequest } from "./audit-harness.mjs";

const OUTPUT_DIR = path.resolve("readonlyaudit");
// Lighthouse scores are measured, not an invented acceptance threshold.
const METRICS = ["first-contentful-paint", "largest-contentful-paint", "total-blocking-time", "cumulative-layout-shift", "speed-index"];

function blockedUrlPatterns(publicOrigin, disallowPrefixes) {
  const host = new URL(publicOrigin).hostname;
  const paths = [
    ...disallowPrefixes,
    ...EXTRA_BLOCKED_PATH_PREFIXES,
    "/api",
  ];
  return [
    ...paths.map((p) => `*://${host}${p}*`),
    "*://*.supabase.co/*",
    "*://formspree.io/*",
    "*://*.convertkit.com/*",
  ];
}

function lighthouseOptions(chrome, publicOrigin, disallowPrefixes) {
  return {
    logLevel: "error",
    output: "json",
    onlyCategories: ["performance", "accessibility"],
    port: chrome.port,
    formFactor: "mobile",
    screenEmulation: {
      mobile: true,
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      disabled: false,
    },
    blockedUrlPatterns: blockedUrlPatterns(publicOrigin, disallowPrefixes),
    extraHeaders: {
      "User-Agent":
        "ConstructaMarketingReadonlyAudit/1.0 (+https://www.constructa.co; read-only CI)",
    },
  };
}

function desktopLighthouseOptions(chrome, publicOrigin, disallowPrefixes) {
  return {
    ...lighthouseOptions(chrome, publicOrigin, disallowPrefixes),
    formFactor: "desktop",
    screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false },
  };
}

function renderMarkdown(report) {
  const lines = [
    "# D79 production marketing Lighthouse (read-only)",
    "",
    `Generated: ${report.generatedAt}`,
    `Public origin: ${report.publicOrigin}`,
    "Scores are a current-production lab baseline; axe findings and candidate CI are assessed separately.",
    "",
    "## Summary",
    "",
    "| Path | Mode | Performance | Accessibility | Pass |",
    "| --- | --- | --- | --- | --- |",
  ];
  for (const row of report.runs) {
    lines.push(
      `| ${row.path} | ${row.mode} | ${row.performanceScore?.toFixed(2) ?? "n/a"} | ${row.accessibilityScore?.toFixed(2) ?? "n/a"} | ${row.pass ? "yes" : "no"} |`,
    );
  }
  lines.push("");
  lines.push("## Limitations");
  lines.push("");
  for (const note of report.limitations) {
    lines.push(`- ${note}`);
  }
  lines.push("");
  return lines.join("\n");
}

async function runOne(url, options) {
  const result = await lighthouse(url, options);
  const lhr = result?.lhr;
  if (!lhr?.categories) {
    throw new Error("Lighthouse returned no categories");
  }
  const performanceScore = lhr.categories.performance?.score ?? null;
  const accessibilityScore = lhr.categories.accessibility?.score ?? null;
  return {
    performanceScore,
    accessibilityScore,
    pass: !lhr.runtimeError && performanceScore != null && accessibilityScore != null,
    metrics: Object.fromEntries(METRICS.map((id) => [id, { value: lhr.audits[id]?.numericValue ?? null, display: lhr.audits[id]?.displayValue ?? null }])),
    findings: Object.values(lhr.audits).filter((a) => a.score != null && a.score < 1 && a.details?.type === "opportunity").map((a) => ({ id: a.id, title: a.title, savingsMs: a.details.overallSavingsMs ?? null, display: a.displayValue ?? null, items: (a.details.items ?? []).map((item) => ({ url: item.url ? new URL(item.url).pathname : null, wastedBytes: item.wastedBytes ?? null, totalBytes: item.totalBytes ?? null })) })),
    fetchFailure: lhr.runtimeError?.message ?? null,
  };
}

async function main() {
  const target = loadMarketingAuditTarget();
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const report = {
    auditId: "d79-marketing-production-lighthouse",
    generatedAt: new Date().toISOString(),
    publicOrigin: target.publicOrigin,
    publicOriginSource: target.publicOriginSource,
    gitRef: process.env.GITHUB_SHA ?? process.env.GIT_COMMIT ?? null,
    scoreGate: null,
    runs: [],
    limitations: [
      "Each URL is loaded once per mode (mobile + desktop); no scripted navigation or form interaction.",
      "Performance/accessibility scores and opportunity diagnostics are informational current-production baselines; runner/navigation failure is not a pass.",
      "GET/HEAD interception may affect cache/timing; these are restricted CI lab observations, not real-user latency.",
      "Scores reflect live production at run time, not the PR diff until deployed.",
    ],
    summary: { runs: 0, failed: 0 },
  };

  const chrome = await chromeLauncher.launch({
    chromePath: chromium.executablePath(),
    chromeFlags: ["--headless", "--no-sandbox", "--disable-gpu"],
  });

  // Install method, origin and navigation guards BEFORE Lighthouse opens any page.
  // A fresh Chrome profile has no existing service worker registration.
  const guardedBrowser = await chromium.connectOverCDP(`http://127.0.0.1:${chrome.port}`);
  const context = guardedBrowser.contexts()[0];
  if (!context) throw new Error("Missing Lighthouse browser context");
  await context.addInitScript(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register = async () => { throw new Error("Service workers disabled for read-only audit"); };
    }
  });
  await context.route("**/*", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const decision = classifyRequest(req.url(), req.method(), target.disallowPrefixes);
    const unsafeNavigation = req.isNavigationRequest() && (url.origin !== target.publicOrigin || !target.sitemapPaths.includes(url.pathname));
    if (!decision.allowed || unsafeNavigation || req.resourceType() === "serviceworker") return route.abort("blockedbyclient");
    return route.continue();
  });
  try {
    for (const pathname of target.sitemapPaths) {
      const url = toAbsoluteMarketingUrl(pathname, target.publicOrigin);
      const decision = classifyRequest(url, "GET", target.disallowPrefixes);
      if (!decision.allowed) {
        report.runs.push({
          path: pathname,
          mode: "skipped",
          pass: false,
          detail: decision.reason,
        });
        continue;
      }

      for (const [mode, options] of [
        ["mobile", lighthouseOptions(chrome, target.publicOrigin, target.disallowPrefixes)],
        ["desktop", desktopLighthouseOptions(chrome, target.publicOrigin, target.disallowPrefixes)],
      ]) {
        try {
          const scores = await runOne(url, options);
          report.runs.push({
            path: pathname,
            mode,
            url,
            ...scores,
          });
          if (!scores.pass) report.summary.failed += 1;
        } catch (err) {
          report.runs.push({
            path: pathname,
            mode,
            url,
            pass: false,
            performanceScore: null,
            accessibilityScore: null,
            fetchFailure: err instanceof Error ? err.message : String(err),
          });
          report.summary.failed += 1;
        }
        report.summary.runs += 1;
      }
    }
  } finally {
    await guardedBrowser.close();
    await chrome.kill();
  }

  const jsonPath = path.join(OUTPUT_DIR, "marketing-production-lighthouse.json");
  const mdPath = path.join(OUTPUT_DIR, "marketing-production-lighthouse.md");
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(mdPath, renderMarkdown(report));

  console.log(`Wrote ${jsonPath} and ${mdPath}`);
  console.log(
    `Summary: ${report.summary.runs - report.summary.failed}/${report.summary.runs} run(s) produced valid Lighthouse measurements`,
  );

  if (report.summary.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});