#!/usr/bin/env node
/**
 * Original restrained 38s score for the Constructa story film (synthesised in ffmpeg).
 * No third-party samples — sine pads and soft scene accents only.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const TMP = join(ROOT, "marketing", "story-film", ".render-tmp");
const OUT = join(TMP, "constructa-story-audio.m4a");
const DURATION = 38;

/** Scene accent starts (seconds) aligned to storyboard. */
const ACCENTS = [5, 9, 13, 17, 22, 27, 33];

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: "utf8", stdio: "pipe" });
  if (r.status !== 0) throw new Error(`${cmd} failed:\n${r.stderr || r.stdout}`);
}

export function composeStoryFilmAudio(outPath = OUT) {
  mkdirSync(TMP, { recursive: true });

  const inputs = [
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=98:duration=${DURATION}`,
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=147:duration=${DURATION}`,
  ];
  for (const _ of ACCENTS) {
    inputs.push("-f", "lavfi", "-i", "sine=frequency=294:duration=0.28");
  }

  const accentChains = ACCENTS.map((t, i) => {
    const idx = i + 2;
    return `[${idx}:a]adelay=${Math.round(t * 1000)}|${Math.round(t * 1000)},volume=0.055,afade=t=in:st=0:d=0.05,afade=t=out:st=0.2:d=0.06[a${i}]`;
  });

  const mixInputs = "[pad][fifth]" + ACCENTS.map((_, i) => `[a${i}]`).join("");
  const filter = [
    `[0:a]volume=0.042,afade=t=in:st=0:d=2.5,afade=t=out:st=35.5:d=2.5[pad]`,
    `[1:a]volume=0.028,afade=t=in:st=0:d=2.5,afade=t=out:st=35.5:d=2.5[fifth]`,
    ...accentChains,
    `${mixInputs}amix=inputs=${2 + ACCENTS.length}:duration=first:dropout_transition=0,volume=1.6,alimiter=limit=0.88[aud]`,
  ].join(";");

  const args = ["-y", ...inputs, "-filter_complex", filter, "-map", "[aud]", "-t", String(DURATION), "-c:a", "aac", "-b:a", "96k", "-ar", "48000", "-ac", "2", outPath];
  run("ffmpeg", args);
  return outPath;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    console.log(composeStoryFilmAudio());
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}