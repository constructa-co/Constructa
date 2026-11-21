#!/usr/bin/env node
/**
 * D79 read-only production marketing accessibility audit (CI only).
 * axe-core against verified production origin; no form submit or writes.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";
import {
  loadMarketingAuditTarget,
  normalizePathname,
  toAbsoluteMarketingUrl,
} from "./load-audit-target.mjs";
import { createGuardedBrowserContext } from "./audit-harness.mjs";

const OUTPUT_DIR = path.resolve("readonlyaudit");
const FAIL_IMPACTS = new Set(["critical", "serious"]);

function renderMarkdown(report) {
  const lines = [
    "# D79 production marketing accessibility audit (read-only)",
    "",
    `Generated: ${report.generatedAt}`,
    `Public origin: ${report.publicOrigin}`,
    `Git ref: ${report.gitRef ?? "unknown"}`,
    "",
    "## Summary",
    "",
    `| Metric | Value |`,
    `| --- | --- |`,
    `| Pages scanned | ${report.summary.pagesScanned} |`,
    `| Pages with serious/critical axe violations | ${report.summary.pagesFailed} |`,
    `| Total violating nodes (serious/critical) | ${report.summary.violatingNodes} |`,
    "",
    "## Pages",
    "",
  ];

  for (const page of report.pages) {
    lines.push(`### ${page.path}`);
    lines.push("");
    lines.push(`- URL: ${page.url}`);
    lines.push(`- Outcome: ${page.outcome}`);
    lines.push(`- Violations (serious/critical): ${page.violations.length}`);
    for (const v of page.violations) {
      lines.push(
        `  - **${v.id}** (${v.impact}): ${v.help} — ${v.nodes.length} node(s)`,
      );
      for (const node of v.nodes.slice(0, 3)) {
        lines.push(`    - \`${node.target.join(" > ")}\``);
      }
      if (v.nodes.length > 3) {
        lines.push(`    - …and ${v.nodes.length - 3} more`);
      }
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
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const report = {
    auditId: "d79-marketing-production-a11y",
    generatedAt: new Date().toISOString(),
    publicOrigin: target.publicOrigin,
    publicOriginSource: target.publicOriginSource,
    gitRef: process.env.GITHUB_SHA ?? process.env.GIT_COMMIT ?? null,
    pages: [],
    interceptedRequests: [],
    limitations: [
      "Loads each MARKETING_SITEMAP_PATHS URL once; does not click buttons, submit forms, or follow /login.",
      "Findings describe deployed production at audit time; a green run after merge does not retroactively fix old prod.",
      "Moderate/minor axe issues are reported but do not fail the job unless impact is serious or critical.",
    ],
    summary: {
      pagesScanned: 0,
      pagesFailed: 0,
      violatingNodes: 0,
    },
  };

  const browser = await chromium.launch({ headless: true });
  const { context, setActivePagePath } = await createGuardedBrowserContext(
    browser,
    target,
    report,
  );

  for (const pathname of target.sitemapPaths) {
    const url = toAbsoluteMarketingUrl(pathname, target.publicOrigin);
    setActivePagePath(pathname);
    const page = await context.newPage();
    const pageReport = {
      path: normalizePathname(pathname),
      url,
      outcome: "pass",
      violations: [],
    };

    try {
      await page.goto(url, { waitUntil: "load", timeout: 60_000 });
      const axe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      const blocking = axe.violations.filter((v) =>
        FAIL_IMPACTS.has(v.impact ?? ""),
      );
      pageReport.violations = blocking.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        description: v.description,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          html: n.html?.slice(0, 200),
        })),
      }));
      if (blocking.length) {
        pageReport.outcome = "fail";
      }
      report.summary.violatingNodes += blocking.reduce(
        (sum, v) => sum + v.nodes.length,
        0,
      );
    } catch (err) {
      pageReport.outcome = "fail";
      pageReport.violations.push({
        id: "audit-runner-error",
        impact: "critical",
        help: "axe scan failed",
        description: err instanceof Error ? err.message : String(err),
        nodes: [{ target: ["page"], html: "" }],
      });
    }

    report.pages.push(pageReport);
    await page.close();
  }

  await context.close();
  await browser.close();

  report.summary.pagesScanned = report.pages.length;
  report.summary.pagesFailed = report.pages.filter(
    (p) => p.outcome === "fail",
  ).length;

  const jsonPath = path.join(OUTPUT_DIR, "marketing-production-a11y.json");
  const mdPath = path.join(OUTPUT_DIR, "marketing-production-a11y.md");
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(mdPath, renderMarkdown(report));

  console.log(`Wrote ${jsonPath} and ${mdPath}`);
  console.log(
    `Summary: ${report.summary.pagesScanned - report.summary.pagesFailed}/${report.summary.pagesScanned} pages pass serious/critical gate`,
  );

  if (report.summary.pagesFailed > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});