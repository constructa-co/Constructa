# D38 CON-001 / CON-002 evidence (2026-11-15)

## Scope

- **Base:** `6800746d4f10fc3b1036d954bad91601dbcffe75`
- **Branch:** `cursor/constructa-d38-con-001-002-browser-reproduction-bd36`
- **CON-001:** New project creation must reach Brief without `BLANK_PROJECT_CREATE_ERROR`.
- **CON-002:** Brief save must persist through `save_phase1_brief` and survive reload.

## Source delivered

1. PR #170 disposable SQL block appended to `scripts/verify-phase1-smoke.sql` (prior assertions preserved).
2. Hosted Playwright harness: `playwright.d38-con-brief-persistence.config.ts` + `e2e/d38-con-001-002-browser.qa.ts`.
3. Read-back helper `savedProjectBrief` in `e2e/support/backend.ts`.

## Run results (this environment)

| Check | Result | Notes |
| --- | --- | --- |
| `./node_modules/.bin/tsc --noEmit` | **GREEN** | Node 22 VM; `npm install --engine-strict=false` |
| `vitest run` | **GREEN** | 6731 passed, 4 skipped |
| Playwright hosted reproduction | **NOT_RUN** | No `E2E_SUPABASE_PROJECT_REF`, disposable keys, or seeded QA credentials in the cloud agent VM |
| `scripts/ci-replay-in-container.sh smoke` | **NOT_RUN** | Requires Docker + linked replay Postgres (CI operator path) |

## Operator path to turn browser evidence green or red

See `e2e/D38-CON-BRIEF-PERSISTENCE.md`. A failing run with HTTP 4xx/5xx on `create_phase1_project_graph` or `save_phase1_brief` reproduces CON-001/002; a passing run with reload + DB read-back is evidence against the reported snags.