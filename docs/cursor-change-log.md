# Cursor change log

## 2026-10-28 — CHECKPOINT1605 legacy hosted-write hold (Composer 2.5)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `e2e/support/legacy-hosted-phase1-guard.ts` | new | `isLegacyHostedPhase1WriteHeld() === true`; `readLegacyHostedPhase1Env()` throws `E2EConfigurationError` with explicit NOT_RUN before env/client/network | Fail-closed entry for default Phase 1 harness when Ready/manual runs could still write despite platform consent hold |
| `e2e/support/legacy-hosted-phase1-guard.test.ts` | new | Four vitest cases (held, no fetch, prerequisites, config import blocked) | Prove refusal happens before setup callbacks; no fake RED from missing module |
| `playwright.config.ts` | ~1–8 | Import `readLegacyHostedPhase1Env` instead of `readE2EEnv` at config load | Block webServer/browser start before disposable env is read |
| `e2e/support/global-setup.ts` | setup entry | Call `readLegacyHostedPhase1Env()` before auth settings fetch | Same hold at global setup boundary |

## 2026-10-27 — A059 weekend pattern → proposal refresh (Composer a059)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/app/dashboard/projects/schedule/simple-programme-client.tsx` | ~392–395 | Call `router.refresh()` after `router.push` on **Next: Proposal** | Re-fetch the proposal page server props so `programme_working_pattern` saved in Programme is not stale in Review & Send |
| `src/app/dashboard/projects/schedule/simple-programme-workspace.test.tsx` | hoisted router mock, new test | Assert push + refresh on **Next: Proposal** | Lock the navigation seam after saved weekend working days |
| `src/app/dashboard/projects/proposal/review-send-client.test.ts` | new test | All-week pattern shows Sunday 15 Nov finish in programme section | Prove production Review & Send uses saved pattern, not default Mon–Fri |
