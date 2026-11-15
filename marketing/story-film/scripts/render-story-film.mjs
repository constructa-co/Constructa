#!/usr/bin/env node
/**
 * Cloud render: 1080p + 720p MP4 and poster from marketing/story-film/preview.
 * Run: node marketing/story-film/scripts/render-story-film.mjs
 */
import { chromium } from "playwright";
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const PREVIEW = join(ROOT, "marketing", "story-film", "preview", "index.html");
const OUT_DIR = join(ROOT, "public", "marketing", "story-film");
const TMP = join(ROOT, "marketing", "story-film", ".render-tmp");
const ARTIFACTS = join(ROOT, "marketing", "story-film", "artifacts");
const DURATION_MS = 38_000;
const MAX_BYTES = 6 * 1024 * 1024;

const mb = (n) => `${(n / (1024 * 1024)).toFixed(2)} MB`;

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: "utf8", stdio: "pipe" });
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed:\n${r.stderr || r.stdout}`);
  }
  return r.stdout;
}

function shrinkToBudget(inMp4, outMp4, height) {
  let crf = height >= 1080 ? 30 : 32;
  for (let attempt = 0; attempt < 6; attempt++) {
    run("ffmpeg", [
      "-y",
      "-i",
      inMp4,
      "-an",
      "-vf",
      `scale=-2:${height}`,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-preset",
      "slow",
      "-crf",
      String(crf),
      "-movflags",
      "+faststart",
      outMp4,
    ]);
    const size = statSync(outMp4).size;
    if (size <= MAX_BYTES) return size;
    crf += 2;
  }
  const size = statSync(outMp4).size;
  if (size > MAX_BYTES) {
    throw new Error(`Output ${outMp4} is ${mb(size)}; budget is ${mb(MAX_BYTES)}`);
  }
  return size;
}

async function main() {
  mkdirSync(TMP, { recursive: true });
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(ARTIFACTS, { recursive: true });
  rmSync(join(TMP, "constructa-story-raw-1080p.mp4"), { force: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: TMP, size: { width: 1920, height: 1080 } },
  });

  const page = await context.newPage();
  await page.goto(`file://${PREVIEW}`);
  await page.addStyleTag({
    content: ".film-scene { animation-iteration-count: 1 !important; }",
  });
  const video = page.video();
  await page.waitForTimeout(DURATION_MS + 400);
  await page.close();
  await context.close();
  await browser.close();

  const rawWebm = await video.path();
  const raw1080 = join(TMP, "constructa-story-raw-1080p.mp4");
  const out1080 = join(OUT_DIR, "constructa-story-1080p.mp4");
  const out720 = join(OUT_DIR, "constructa-story-720p.mp4");
  const posterJpg = join(OUT_DIR, "constructa-story-poster.jpg");
  const poster = join(OUT_DIR, "constructa-story-poster.webp");

  run("ffmpeg", [
    "-y",
    "-i",
    rawWebm,
    "-an",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-preset",
    "medium",
    "-crf",
    "26",
    "-t",
    "38",
    raw1080,
  ]);

  const size1080 = shrinkToBudget(raw1080, out1080, 1080);
  const size720 = shrinkToBudget(out1080, out720, 720);

  run("ffmpeg", ["-y", "-ss", "36.5", "-i", out1080, "-vframes", "1", "-q:v", "82", posterJpg]);
  run("ffmpeg", ["-y", "-i", posterJpg, "-vf", "scale=1280:-2", poster]);

  const manifest = {
    renderedAt: new Date().toISOString(),
    environment: "synthetic-cloud",
    durationSeconds: 38,
    files: {
      "1080p": { path: "public/marketing/story-film/constructa-story-1080p.mp4", bytes: size1080 },
      "720p": { path: "public/marketing/story-film/constructa-story-720p.mp4", bytes: size720 },
      poster: { path: "public/marketing/story-film/constructa-story-poster.webp" },
    },
    underSixMb: size1080 <= MAX_BYTES && size720 <= MAX_BYTES,
  };
  writeFileSync(join(ARTIFACTS, "render-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});