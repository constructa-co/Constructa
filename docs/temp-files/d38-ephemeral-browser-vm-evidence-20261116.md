# D38 CON-001 / CON-002 ephemeral browser — VM evidence (2026-11-16)

Base: `codex/d38-disposable-browser-ci-20261116` @ `048aa64` (+ follow-up guard/setup fixes on `cursor/d38-con-001-and-con-002-disposable-browser-fallback-0dba`).

## Docker

| Check | Result |
|-------|--------|
| `docker info` (after `docker.io` install + `dockerd`) | **PASS** — client/server 29.1.3, API on `/var/run/docker.sock` |

## Ephemeral shell guards

| Check | Exit |
|-------|------|
| `bash scripts/test-ephemeral-replay-guards.sh` | **0** (after production-link strip behaviour update) |

## Compiled Supabase target (disposable loopback build)

| Step | Result |
|------|--------|
| `npx next build` with `CONSTRUCTA_DEPLOY_CONTEXT=e2e-replay`, loopback URL, `CONSTRUCTA_NONPROD_SUPABASE_PROJECT_REF=ephemeralreplay00001` | Build completed |
| `node scripts/verify-build-supabase-target.mjs` (before fix) | **FAIL** — `projects in build=umqtzfsnyoofmgfbnrgv` |
| Same after `HOSTED_E2E_FIXTURE_PROJECT_REF` allowlist (e2e-replay only) | **PASS** — `projects in build=none` |
| `refs in .next` via `supabaseRefsInBuild` | `['umqtzfsnyoofmgfbnrgv']` (static E2E map only; runtime URL is loopback) |

## Local Supabase stack (`d38-ephemeral-browser.sh`)

| Step | Result |
|------|--------|
| First run with `supabase/.temp/project-ref` = production | Guard messages (expected); stale metadata now stripped in disposable setup |
| `SUPABASE_CLI_VERSION=2.75.0 bash scripts/ephemeral-replay/d38-ephemeral-browser.sh` | **exit 2** — `BLOCKER: local Supabase stack did not start after 5 attempts`; root cause: GoTrue `DBConnection.ConnectionError` during `Initialising schema` (~15 s pool timeout) |
| Default CLI pin was `2.39.3` (unpublished on npm) | Fixed to **2.75.0** (matches workflow) |
| Playwright CON-001 / CON-002 | **NOT_RUN** — no loopback API on `:54321`; no browser assertions or DB readback |

## Browser assertions / DB readback

Not executed — blocked on local stack start. No hosted credentials, production SQL, or publication used.

## Recommended unblock

Run `bash scripts/ephemeral-replay/d38-ephemeral-browser.sh` on **GitHub Actions** `d38-con-browser-replay.yml` (ubuntu-latest + Docker), or a VM where `supabase start` completes (CI has passed build on same harness per operator report).