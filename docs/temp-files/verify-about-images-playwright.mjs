#!/usr/bin/env node
/**
 * Read-only decode check for About hero + founder images on a given origin.
 * Usage: node docs/temp-files/verify-about-images-playwright.mjs https://constructa-nu.vercel.app
 */
import { chromium } from "playwright";

const origin = process.argv[2] ?? "https://constructa-nu.vercel.app";

const panels = [
  { name: "hero", alt: "Three people in hard hats gathered around a laptop" },
  { name: "founder", alt: "AI-generated illustration of a man standing behind a desk at sunset" },
];

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${origin.replace(/\/$/, "")}/about`, { waitUntil: "networkidle" });
const results = [];
for (const panel of panels) {
  const img = page.locator(`img[alt="${panel.alt}"]`).first();
  await img.scrollIntoViewIfNeeded().catch(() => {});
  await img.evaluate((node) => new Promise((resolve) => {
    const el = node;
    if (el.complete && el.naturalWidth > 0) {
      resolve();
      return;
    }
    el.addEventListener("load", () => resolve(), { once: true });
    el.addEventListener("error", () => resolve(), { once: true });
    setTimeout(resolve, 3000);
  })).catch(() => {});
  const visible = await img.isVisible().catch(() => false);
  const box = visible ? await img.boundingBox() : null;
  const decoded = await img.evaluate((node) => {
    const el = node;
    return { naturalWidth: el.naturalWidth, naturalHeight: el.naturalHeight, currentSrc: el.currentSrc };
  }).catch(() => ({ naturalWidth: 0, naturalHeight: 0, currentSrc: "" }));
  results.push({ panel: panel.name, visible, box, ...decoded });
}
await page.screenshot({ path: "/opt/cursor/artifacts/about-decode-full-page.jpg", type: "jpeg", quality: 90, fullPage: true });
await browser.close();
console.log(JSON.stringify({ origin, results }, null, 2));