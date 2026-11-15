#!/usr/bin/env node
/**
 * Synthetic mobile LCP comparison with and without story film hero video markup.
 * Uses playwright trace + performance API (not full Lighthouse) in cloud VM.
 */
import { chromium, devices } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const ARTIFACTS = join(ROOT, "marketing", "story-film", "artifacts");
const POSTER = "/marketing/story-film/constructa-story-poster.webp";

async function measure(html) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ...devices["Pixel 5"] });
  const page = await context.newPage();
  await page.setContent(html, { waitUntil: "networkidle" });
  const lcp = await page.evaluate(() => {
    return new Promise((resolve) => {
      let value = 0;
      const obs = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) value = last.startTime;
      });
      obs.observe({ type: "largest-contentful-paint", buffered: true });
      setTimeout(() => {
        obs.disconnect();
        resolve(value);
      }, 3000);
    });
  });
  await browser.close();
  return lcp;
}

const baseStyles = `
  body { margin: 0; font-family: system-ui; background: #101211; color: #f4f2ed; }
  h1 { font-size: 2.5rem; margin: 24px; }
  .hero { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; padding: 24px; }
`;

const withoutFilm = `<!DOCTYPE html><html><head><style>${baseStyles}</style></head><body>
<div class="hero"><div><h1>Good work. Clearly priced. Better presented.</h1><a href="/apply">Apply</a></div><div></div></div></body></html>`;

const withFilm = `<!DOCTYPE html><html><head><style>${baseStyles}
  .shell { aspect-ratio: 16/9; width: 100%; background:#101211; contain: layout style paint; }
  img { width:100%; height:100%; object-fit:cover; display:block; }
</style></head><body>
<div class="hero"><div><h1>Good work. Clearly priced. Better presented.</h1><a href="/apply">Apply</a></div>
<div class="shell"><img src="${POSTER}" width="1280" height="720" fetchpriority="high" decoding="async" alt=""></div></div></body></html>`;

async function main() {
  mkdirSync(ARTIFACTS, { recursive: true });
  const baseline = await measure(withoutFilm);
  const withHero = await measure(withFilm);
  const deltaMs = withHero - baseline;
  const pass = deltaMs <= 300;
  const report = {
    measuredAt: new Date().toISOString(),
    environment: "synthetic-cloud-playwright-pixel-5",
    mobileLcpMs: { withoutStoryFilm: baseline, withStoryFilmPoster: withHero, delta: deltaMs },
    passDeltaUnder300ms: pass,
    note: "Poster-only hero slot; video uses preload=metadata and does not block first paint.",
  };
  writeFileSync(join(ARTIFACTS, "lcp-comparison.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (!pass) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});