## D81 — CON-012 profile isolation (ephemeral replay) — 21 November 2026

| File | Lines (approx.) | Change | Intent |
| --- | --- | --- | --- |
| `e2e/d81-profile-isolation.qa.ts` | (new) | Two-account browser journey + RLS JWT probe | Replace mock-only CON-012 qualification on loopback |
| `scripts/ephemeral-replay/seed-d81-profile-isolation.mjs` | (new) | Guarded alpha/beta auth seed | Disposable identities only when `E2E_D81_PROFILE_ISOLATION=1` |
| `e2e/support/backend.ts` | helpers | Profile read + client isolation probe | Prove persistence without logging tokens |
| `playwright.d38-ephemeral-replay.config.ts` | `testMatch` | Include D81 | Preserve D38/D78 specs |
| `.github/workflows/d38-con-browser-replay.yml` | paths/env | Wire D81 into existing job | Single disposable CI lane |

Checks: not run locally. R1 owns CI, review, and draft PR.