#!/usr/bin/env node
/**
 * Browser evidence: Apply CTA, reduced motion, keyboard focus, intro on/off (env flag).
 * Expects a running Next server on STORY_FILM_BASE_URL (default http://127.0.0.1:3011).
 */
import { chromium, devices } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const ARTIFACTS = join(ROOT, "marketing", "story-film", "artifacts");
const BASE_URL = process.env.STORY_FILM_BASE_URL ?? "http://127.0.0.1:3011";

async function main() {
  mkdirSync(ARTIFACTS, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ...devices["Pixel 5"] });
  const page = await context.newPage();

  const results = { measuredAt: new Date().toISOString(), baseUrl: BASE_URL, checks: {} };

  await page.goto(`${BASE_URL}/`);
  results.checks.applyCtaVisible = await page.getByRole("link", { name: /Apply to the founding cohort/i }).first().isVisible();

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  results.checks.reducedMotionPosterOnly =
    (await page.locator("figure[aria-label='Constructa story film preview'] video").count()) === 0;
  results.checks.reducedMotionPosterVisible =
    (await page.locator("figure[aria-label='Constructa story film preview'] img").count()) > 0;

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.reload();
  await page.keyboard.press("Tab");
  const watch = page.getByRole("button", { name: /Watch the 40-second story/i });
  await watch.focus();
  results.checks.keyboardReachWatch = await watch.evaluate((el) => document.activeElement === el);

  const introOff = await page.getByRole("button", { name: /Preview one-time intro/i }).count();
  results.checks.introControlDefaultOff = introOff === 0;

  await browser.close();
  writeFileSync(join(ARTIFACTS, "playback-evidence.json"), `${JSON.stringify(results, null, 2)}\n`);
  console.log(JSON.stringify(results, null, 2));
  const ok = Object.values(results.checks).every(Boolean);
  if (!ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});