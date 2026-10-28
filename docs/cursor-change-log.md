# Cursor change log

## 2026-10-28 — CHECKPOINT1915 brand readability (Composer integration)

| File | Change | Intent |
|------|--------|--------|
| `core-editing-palette.ts` + tests | Sage focus/action tokens | A001 bounded brand actions |
| `profile-form.tsx` + brand test | Palette wiring; A031 preserved | Profile/import primary accents |
| `import-client.tsx` + test | Matching sage accents | Import flow consistency |
| `a111-readability-*` + `build-brief-price.mjs` + playwright config | Offline computed-style harness | ROOT 9/9 contrast proof; no product style edits |

## 2026-10-28 — CHECKPOINT1905 A069 final source (Claude 1cc9d39, Composer integration)

| File | Change | Intent |
|------|--------|--------|
| `supabase/migrations/20261028183000_new_job_closing_prefill.sql` | Additive CREATE OR REPLACE + UTF-16 ELSIF | New-job closing seed from owner md_message; SOURCE ONLY |
| `src/lib/new-job-closing.test.ts` | 19 static contract/reference cases | Pin migration + editor boundaries without DB execution |
| `src/lib/blank-project.ts` | Doc comment | Names DB-side closing exception; payload unchanged |

## 2026-10-28 — CHECKPOINT1900 profile CI fixture (Composer 2.5)

| File | Change | Intent |
|------|--------|--------|
| `profile-setup-navigation.test.tsx` | 3 literal title/expect strings | Match approved presentation copy (`c264f28`); CI only, no product edits |
| Delivery docs + compact register timestamp | Log CI green; A069 deferred | Honest scope boundary |

## 2026-10-28 — CHECKPOINT1800 A031 literal discovery (Claude 72122a6)

| File | Change | Intent |
|------|--------|--------|
| `src/lib/trade-literal-match.ts` | New whole-label matcher | Literal business_type relevance without synonyms/AI |
| `src/app/dashboard/settings/profile/profile-form.tsx` | Discovery UI + custom label toggles | Visible reorder, no auto-select, deliberate remove/restore |
| `*.test.ts(x)` | 29 cases | Matcher + real ProfileForm harness |

## 2026-10-28 — CHECKPOINT1710 SW privacy (Claude 9be3182, Cursor integration)

| File | Change | Intent |
|------|--------|--------|
| `public/sw.js` | Network-only dynamic pages; v2 precache; v1 delete-only activate | Stop caching/replaying private HTML |
| `src/app/offline/page.tsx` | Remove false “recently visited” promise | Honest offline UX |
| `src/lib/service-worker.test.ts` | 11 VM tests loading real worker | Privacy boundaries without browser deploy |

## 2026-10-28 — CHECKPOINT1625 Brief path, CI fixtures, manifest checker (Composer integration)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/app/dashboard/projects/brief/*` + `assistant-actions.ts` | Claude a7038f0 pin | Brief conversation on shared job-assistant request path; off by default | A055 Brief wiring without activation |
| `src/components/brief-conversation-panel.tsx`, `src/lib/brief-conversation.ts`, `src/lib/reviewed-conversation.ts`, `src/lib/server/brief-request.ts` | new/refactor | Shared reviewed lifecycle + server handler | Owner lock, fingerprint, no writes when generator null |
| `src/lib/planning-conversation.ts`, `src/lib/job-assistant-client.ts`, `src/lib/server/job-assistant-transport.ts` | adapted | Planning wrapper + `brief:false` availability | Preserve Estimate/Programme; extend transport |
| `src/app/dashboard/projects/brief/page.test.ts`, `brief-edit-lock.test.tsx` | Composer 43a3d56 | `dashboardRouteShellBody` for page editor | Fix twelve baseline CI failures after shell wrap |
| `scripts/recovery-manifest-check.mjs`, `.test.mjs` | Composer 20bb160 | Refuse same repo+ref with different SHAs before overwrite | A079 checker honesty; not full recovery |

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
