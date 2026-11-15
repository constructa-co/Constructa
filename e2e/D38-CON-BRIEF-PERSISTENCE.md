# D38 CON-001 / CON-002 browser reproduction

Tracks P0 review items **CON-001** (new project creation) and **CON-002** (brief save persistence) with a **hosted** Playwright run against the approved disposable Supabase project only.

## What runs

| Layer | File | Purpose |
| --- | --- | --- |
| SQL replay (CON-002 RPC) | `scripts/verify-phase1-smoke.sql` | Same `save_phase1_brief` arguments and read-back assertions as draft PR #170; all prior smoke assertions unchanged |
| Browser (CON-001 + CON-002) | `e2e/d38-con-001-002-browser.qa.ts` | Seeded QA sign-in → New project → Brief save → reload UI check → service-role row read |

## Prerequisites (fail closed)

Same disposable guard as `e2e/support/env.ts`, plus labelled QA credentials:

| Variable | Purpose |
| --- | --- |
| `E2E_SUPABASE_PROJECT_REF` | Approved disposable reference (`constructa-e2e-pr79` / `umqtzfsnyoofmgfbnrgv`) |
| `NEXT_PUBLIC_SUPABASE_URL` / keys | Disposable project keys only |
| `SUPABASE_SERVICE_ROLE_KEY` | Read-back only in the test harness |
| `E2E_SYNTHETIC_QA_EMAIL` | `*e2e-qa*@example.com` labelled mailbox |
| `E2E_SYNTHETIC_PASSWORD` | Password for that account |

Optional: `E2E_BASE_URL`, `E2E_STUB_URL`, `E2E_SKIP_BUILD`, `E2E_EVIDENCE`.

## Command (operator — not run automatically in cloud agents without credentials)

```bash
npx playwright test --config=playwright.d38-con-brief-persistence.config.ts
```

With Keychain-backed env:

```bash
E2E_SUPABASE_PROJECT_REF=<disposable ref> \
E2E_SYNTHETIC_QA_EMAIL=<e2e-qa-labelled@example.com> \
E2E_SYNTHETIC_PASSWORD=<from protected store> \
scripts/e2e-with-keychain.sh npx playwright test --config=playwright.d38-con-brief-persistence.config.ts
```

## Honest limits

- **No production**, no live settings changes, no sign-up in this variant.
- Browser green/red depends on disposable schema/migrations matching `main` at the feature base and a QA account that can reach `/dashboard/projects/new`.
- SQL replay green/red depends on CI/local Postgres replay (`scripts/ci-replay-in-container.sh smoke`), not on this browser run.