#!/usr/bin/env node
/**
 * Mux composed audio into existing story film MP4s; verify codec/size budget.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { composeStoryFilmAudio } from "./compose-story-film-audio.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const OUT_DIR = join(ROOT, "public", "marketing", "story-film");
const ARTIFACTS = join(ROOT, "marketing", "story-film", "artifacts");
const MAX_BYTES = 6 * 1024 * 1024;
const TMP = join(ROOT, "marketing", "story-film", ".render-tmp");

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: "utf8", stdio: "pipe" });
  if (r.status !== 0) throw new Error(`${cmd} failed:\n${r.stderr || r.stdout}`);
  return r.stdout;
}

function probeJson(path) {
  return JSON.parse(
    run("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "stream=codec_name,codec_type,width,height",
      "-show_entries",
      "format=duration,size",
      "-of",
      "json",
      path,
    ]),
  );
}

function muxOne(videoIn, videoOut, audioPath, height) {
  let crf = height >= 1080 ? 30 : 32;
  for (let attempt = 0; attempt < 7; attempt++) {
    run("ffmpeg", [
      "-y",
      "-i",
      videoIn,
      "-i",
      audioPath,
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-preset",
      "slow",
      "-crf",
      String(crf),
      "-vf",
      height >= 1080 ? "scale=-2:1080" : "scale=-2:720",
      "-c:a",
      "aac",
      "-b:a",
      "88k",
      "-movflags",
      "+faststart",
      "-shortest",
      videoOut,
    ]);
    const size = statSync(videoOut).size;
    if (size <= MAX_BYTES) return size;
    crf += 2;
  }
  throw new Error(`${videoOut} exceeds ${MAX_BYTES} bytes`);
}

function main() {
  const audio = composeStoryFilmAudio();
  const silent1080 = join(OUT_DIR, "constructa-story-1080p.mp4");
  const silent720 = join(OUT_DIR, "constructa-story-720p.mp4");
  mkdirSync(TMP, { recursive: true });
  const tmp1080 = join(TMP, "constructa-story-1080p-silent.mp4");
  const tmp720 = join(TMP, "constructa-story-720p-silent.mp4");
  copyFileSync(silent1080, tmp1080);
  copyFileSync(silent720, tmp720);

  const bytes1080 = muxOne(tmp1080, silent1080, audio, 1080);
  const bytes720 = muxOne(tmp720, silent720, audio, 720);

  const codecReport = {
    measuredAt: new Date().toISOString(),
    audioSource: "marketing/story-film/scripts/compose-story-film-audio.mjs",
    files: {
      "1080p": { path: "public/marketing/story-film/constructa-story-1080p.mp4", bytes: bytes1080, probe: probeJson(silent1080) },
      "720p": { path: "public/marketing/story-film/constructa-story-720p.mp4", bytes: bytes720, probe: probeJson(silent720) },
    },
    underSixMb: bytes1080 <= MAX_BYTES && bytes720 <= MAX_BYTES,
  };

  const manifest = JSON.parse(readFileSync(join(ARTIFACTS, "render-manifest.json"), "utf8"));
  manifest.audioMuxedAt = codecReport.measuredAt;
  manifest.files["1080p"].bytes = bytes1080;
  manifest.files["720p"].bytes = bytes720;
  manifest.codec = codecReport.files;
  manifest.underSixMb = codecReport.underSixMb;

  writeFileSync(join(ARTIFACTS, "codec-report.json"), `${JSON.stringify(codecReport, null, 2)}\n`);
  writeFileSync(join(ARTIFACTS, "render-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify(codecReport, null, 2));
}

main();