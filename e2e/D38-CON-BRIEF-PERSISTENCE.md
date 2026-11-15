# D38 CON-001 / CON-002 browser reproduction

Tracks P0 **CON-001** (new project creation) and **CON-002** (brief save persistence).

## Ephemeral replay (preferred — no hosted QA secrets)

Requires **Docker** + Supabase CLI on loopback `http://127.0.0.1:54321`.

```bash
npm ci --engine-strict=false
bash scripts/ephemeral-replay/d38-ephemeral-browser.sh
```

- Migrations: `supabase db reset` (committed `supabase/migrations/`)
- Auth: seeded disposable user (`E2E_D38_AUTH=seed`, default) or browser sign-up (`E2E_D38_AUTH=signup`)
- Playwright config: `playwright.d38-ephemeral-replay.config.ts`
- npm: `npm run e2e:d38-ephemeral-replay`

## Hosted disposable (legacy)

Labelled QA credentials against the approved hosted disposable project only.

- Playwright config: `playwright.d38-con-brief-persistence.config.ts`
- npm: `npm run e2e:d38-con-brief-persistence`
- See `e2e/support/no-publish-guard.ts` for `E2E_SYNTHETIC_QA_EMAIL` / `E2E_SYNTHETIC_PASSWORD`

## SQL replay (CON-002)

`scripts/verify-phase1-smoke.sql` includes PR #170 `save_phase1_brief` assertions. CI: `.github/workflows/migration-replay.yml` and `.github/workflows/d38-con-browser-replay.yml`.

## Limits

- No production, no manual deploy, no protected hosted credentials on the ephemeral path.
- Cloud agents without Docker: **NOT_RUN** for full browser; see `docs/temp-files/d38-ephemeral-ci-execution-plan.md`.