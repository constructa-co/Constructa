#!/usr/bin/env node
/**
 * Matched mobile Lighthouse LCP: baseline (ae6a53d) vs candidate home on real Next output.
 * Synthetic guarded target env (e2e + disposable Supabase ref) without changing settings.
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const ARTIFACTS = join(ROOT, "marketing", "story-film", "artifacts");
const BASE_SHA = "ae6a53df0c639d127341d1ed31acd1af0d25aecf";
const WORKTREE = "/tmp/constructa-story-baseline-ae6a53d";
const NONPROD_REF = "umqtzfsnyoofmgfbnrgv";
const SIGNATURE = "not-a-real-signature-must-never-be-printed";

function key(ref, role) {
  const part = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "HS256", typ: "JWT" })}.${part({ iss: "supabase", ref, role })}.${SIGNATURE}`;
}

const buildEnv = {
  ...process.env,
  NEXT_TELEMETRY_DISABLED: "1",
  NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE: "cohort",
  CONSTRUCTA_DEPLOY_CONTEXT: "e2e",
  CONSTRUCTA_NONPROD_SUPABASE_PROJECT_REF: NONPROD_REF,
  NEXT_PUBLIC_SUPABASE_URL: `https://${NONPROD_REF}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: key(NONPROD_REF, "anon"),
  SUPABASE_SERVICE_ROLE_KEY: key(NONPROD_REF, "service_role"),
};

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", stdio: "pipe", env: buildEnv, ...opts });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed:\n${r.stderr || r.stdout}`);
  return r.stdout;
}

function ensureBaselineWorktree() {
  mkdirSync(join(ROOT, "marketing", "story-film", ".render-tmp"), { recursive: true });
  if (spawnSync("git", ["worktree", "list"], { encoding: "utf8" }).stdout.includes(WORKTREE)) return;
  run("git", ["worktree", "add", "--detach", WORKTREE, BASE_SHA]);
}

function ensureDeps(cwd) {
  if (spawnSync("test", ["-d", join(cwd, "node_modules", "next")], { stdio: "ignore" }).status === 0) return;
  run("npm", ["ci"], { cwd, timeout: 600000, env: { ...buildEnv, npm_config_engine_strict: "false" } });
}

function build(cwd) {
  ensureDeps(cwd);
  run("npm", ["run", "build"], { cwd, timeout: 600000 });
}

function startServer(cwd, port) {
  const child = spawn("npm", ["run", "start", "--", "-p", String(port)], {
    cwd,
    env: { ...buildEnv, PORT: String(port) },
    stdio: "ignore",
    detached: true,
  });
  child.unref();
  return child;
}

async function waitForReady(port) {
  for (let i = 0; i < 90; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/`);
      if (r.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Server on :${port} did not become ready`);
}

function lighthouseLcp(url, label) {
  const out = join(ARTIFACTS, `lighthouse-${label}.json`);
  run("npx", [
    "lighthouse",
    url,
    "--only-categories=performance",
    "--form-factor=mobile",
    "--screenEmulation.mobile",
    "--quiet",
    "--chrome-flags=--headless --no-sandbox",
    "--output=json",
    `--output-path=${out}`,
  ]);
  const report = JSON.parse(readFileSync(out, "utf8"));
  const lcp = report.audits?.["largest-contentful-paint"]?.numericValue ?? null;
  return { lcpMs: lcp, reportPath: out.replace(ROOT + "/", "") };
}

function stopPort(port) {
  spawnSync("fuser", ["-k", `${port}/tcp`], { stdio: "ignore" });
}

async function main() {
  mkdirSync(ARTIFACTS, { recursive: true });
  ensureBaselineWorktree();
  const basePort = 3010;
  const candPort = 3011;

  build(WORKTREE);
  build(ROOT);

  startServer(WORKTREE, basePort);
  startServer(ROOT, candPort);
  await waitForReady(basePort);
  await waitForReady(candPort);

  try {
    const baseline = lighthouseLcp(`http://127.0.0.1:${basePort}/`, "baseline");
    const candidate = lighthouseLcp(`http://127.0.0.1:${candPort}/`, "candidate");
    const delta = candidate.lcpMs - baseline.lcpMs;
    const homeHtml = await fetch(`http://127.0.0.1:${candPort}/`).then((r) => r.text());
    const applyVisible = homeHtml.includes('href="/apply"') && homeHtml.includes("Apply to the founding cohort");

    const result = {
      measuredAt: new Date().toISOString(),
      environment: "synthetic-guarded-e2e-next-start",
      deployContext: "e2e",
      nonprodRef: NONPROD_REF,
      baselineSha: BASE_SHA,
      candidateSha: run("git", ["rev-parse", "HEAD"]).trim(),
      mobileLighthouse: { baseline, candidate, deltaMs: delta, passDeltaUnder300ms: delta <= 300 },
      applyCtaVisibleOnCandidate: applyVisible,
    };
    writeFileSync(join(ARTIFACTS, "lighthouse-lcp-comparison.json"), `${JSON.stringify(result, null, 2)}\n`);
    console.log(JSON.stringify(result, null, 2));
    if (!result.mobileLighthouse.passDeltaUnder300ms) process.exitCode = 1;

    const playback = spawnSync(
      process.execPath,
      [join(ROOT, "marketing/story-film/scripts/verify-story-film-playback.mjs")],
      { stdio: "inherit", env: { ...process.env, STORY_FILM_BASE_URL: `http://127.0.0.1:${candPort}` } },
    );
    if (playback.status !== 0) process.exitCode = 1;
  } finally {
    stopPort(basePort);
    stopPort(candPort);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});