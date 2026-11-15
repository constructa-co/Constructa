# D38 ephemeral browser replay — CI execution plan

## Goal

Run `e2e/d38-con-001-002-browser.qa.ts` against a **local** Supabase stack (migrations + GoTrue + PostgREST), with **no** hosted disposable credentials, no production targets, and no GitHub E2E secrets.

## Preconditions

| Requirement | CI (`ubuntu-latest`) | This cloud agent VM |
|-------------|----------------------|---------------------|
| Docker daemon | Available | **BLOCKER: `docker` not installed** |
| Node 24 + `npm ci` | Yes | Yes |
| Supabase CLI 2.39.3 | `supabase/setup-cli@v1` | via `npx supabase@2.39.3` |
| Playwright + Chrome | After `npm ci` | After `npm ci` |

## Workflow

**File:** `.github/workflows/d38-con-browser-replay.yml`

1. Checkout
2. `npm ci --engine-strict=false`
3. Install Supabase CLI (pinned 2.39.3)
4. `bash scripts/ephemeral-replay/d38-ephemeral-browser.sh`
   - `supabase start` (loopback API on port 54321)
   - `supabase db reset` (replay all `supabase/migrations/`)
   - Export keys from `supabase status -o env`
   - Guards: no production ref, loopback URL only, project ref `ephemeralreplay00001`
   - `seed-disposable-auth.mjs` → `d38-ephemeral@example.com` (synthetic)
   - `npm run e2e:d38-ephemeral-replay` (build + Playwright)

## SQL parity

Migration replay in CI uses the same migration set as hosted smoke. PR **#170** `save_phase1_brief` block in `scripts/verify-phase1-smoke.sql` remains on `main` (merged); no change required for D38 browser path.

## Local / operator entry

```bash
npm ci --engine-strict=false
bash scripts/ephemeral-replay/d38-ephemeral-browser.sh
```

Optional: `E2E_D38_AUTH=signup` to exercise sign-up instead of seeded auth.

## Honest status (this agent run)

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | Run in deliverable commit |
| `npm test` (vitest) | Run in deliverable commit |
| Ephemeral orchestrator (`d38-ephemeral-browser.sh`) | **NOT_RUN** — Docker unavailable |
| Playwright ephemeral config without stack | **GREEN** (fail-closed config error) |
| Hosted `e2e:d38-con-brief-persistence` | **NOT_RUN** (no hosted QA secrets by policy) |
| CI workflow file | Present; executes on PR touching listed paths or `workflow_dispatch` |