# Cursor change log

## 2026-10-31 — A079 Phase 1C same-author correction (checker FAIL on 4a3593a)

| Paths | Change | Intent |
|-------|--------|--------|
| `docs/recovery/phase1c-source-coverage-20261031.json` | d86 ancestry evidence; remove false parallel-history and .tmp-test-run claims; whole tree vs 11 blob scope; exhaustive manager QA apply-once list; timestamp provenance | Address independent checker blocking findings without changing SOURCE pin 7900 |
| `docs/recovery/phase1c-source-coverage-verification-20261031.json` | Add merge-base check; EPERM suite UNVERIFIED; provenance; no test rerun | Preserve original 22 pass / 4 fail record honestly |
| `docs/recovery/phase1c-source-coverage-handoff-20261031.md` | Correction banner; pin vs branch HEAD; scope clarifications | Operator-readable match to JSON |
| `docs/recovery/a079-recovery-runbook.md` §1.2–1.3 | Verify d86 parent b5; distinguish backup branch, cq inventory branch, and fixed 7900 pin | Close runbook gap vs false parallel-history wording |

## 2026-10-31 — A079 Phase 1C SOURCE inventory at 7900 (Cursor cq-0710-a079-current-coverage)

| Paths | Change | Intent |
|-------|--------|--------|
| `docs/recovery/phase1a-source-coverage-20261029.json`, `phase1a-source-coverage-handoff-20261029.md` | Copied byte-identical from git `60970ff` | Preserve accepted Phase 1A evidence without rebinding current pin |
| `docs/recovery/phase1c-source-coverage-20261031.json` | New machine-readable inventory | Pin 7900/b275, 117 migrations, ROB0425 blobs, QA apply-once qualifications, held categories |
| `docs/recovery/phase1c-source-coverage-handoff-20261031.md` | New concise handoff | Operator boundaries; export run 41000587127 failure noted |
| `docs/recovery/phase1c-source-coverage-verification-20261031.json` | Local read-only check record | Migration count/digest match JSON; checker unit test EPERM boundary recorded |
| `docs/recovery/a079-recovery-runbook.md` §1.1–1.3, §3 | Historical vs Phase 1A vs Phase 1C pins; DO_NOT_EXECUTE on dump example | Close runbook gap vs d86-only phase1a; keep unsafe argv example explicitly non-runnable |

## 2026-10-29 — ROB1548 kit Remove + QA metadata (Cursor integration)

| Paths | Change | Intent |
|-------|--------|--------|
| `[id]/page.tsx`, `template-kit-item-remove.tsx`, 2 tests | Remove outcomes + load stub | Pin **eb5df31** exact |
| Register | A085/A059/A069 metadata; QA apply-once facts | No SQL reapply |

## 2026-10-29 — ROB1442 kit create/load + A040 record (Cursor integration)

| Paths | Change | Intent |
|-------|--------|--------|
| `templates/page.tsx`, `create-kit-form.tsx`, create test | Kit create outcomes | Pin **2ee99c8** |
| `templates/[id]/page.tsx`, load test | Kit load outcomes | Pin **0881ca84** |
| Compact register | A040 **Complete** per rob1433 | Same backup as functional source |

## 2026-10-29 — ROB1255 A085 kit Add + CSV (Cursor integration)

| Paths | Change | Intent |
|-------|--------|--------|
| `template-item-editor` + add-outcomes test | Add failure/uncertainty handling | Pin **04c5518** |
| `actions` + `csv-importer` + 2 CSV test modules | Fail-closed category/item/transport | Pin **58eb21a9** NET 97..58eb |
| `handoff.md` | EOF append only | Preserve **97ad673** prefix exact |

## 2026-10-29 — ROB1205 A085 functional kit + rates (Cursor integration)

| Paths | Change | Intent |
|-------|--------|--------|
| `template-item-editor` + kit filter test | Wired filter on description/category | Pin **4fbe579** |
| `actions` + `rate-override-client` + 2 test modules | Honest delete error; Save/Reset finally/catch | Pin **5aa0fb6** |
| `handoff.md` | ROB1205 addendum after decision sheet | Preserve prefix + old suffix SHA |

## 2026-10-29 — ROB1025 A059 v2 working pattern (Cursor integration)

| Paths | Change | Intent |
|-------|--------|--------|
| 16 NET from **f23e4902** on **b5f5138** | Night/timezone/capacity v2 SOURCE | Last independent NO_P1 pin; NOT fdda/ba65 |
| `20261029103000_project_working_pattern_v2.sql` | Canonical migration SOURCE | **NOT APPLIED** |

## 2026-10-29 — ROB0635 combined Phase 1A (Cursor integration)

| Paths | Change | Intent |
|-------|--------|--------|
| 16 Claude + 2 cloud test paths | OFF-readiness + manual create + A069 mock projection | Pins **7605abf**, **c159223**, **97c893** on **341a24d** |
| `new-job-closing.test.ts` | `select()` + `unknown` cast in test helper only | ROOT `fakeSupabase` tsc alignment (not in 97c893 pin) |
| Register/docs | Metadata **A040/A055/A059/A063/A069** Partial | Statuses unchanged **76C 22P 19N 1B** |

## 2026-10-28 — ROB0225 A055 reservation conclude (Cursor integration)

| File | Change | Intent |
|------|--------|--------|
| `job-assistant-generation.ts` | `confirmedReservations` + atomic conclude | Pin **ba0d92c** finding repair |
| `job-assistant-request.test.ts` | 7-case ownership block + A063 expectation fixes | Material ROOT selection |

## 2026-10-28 — ROB0045 A069 blank guard (Cursor integration)

| File | Change | Intent |
|------|--------|--------|
| `20261028183000_new_job_closing_prefill.sql` | U& 25-char ECMA trim class | Pin **a394caee**; NOT APPLIED |
| `new-job-closing.test.ts` | **53** SOURCE parity cases | Actual SQL literal decode |

## 2026-10-28 — ROB0015 Phase 1A (Cursor integration)

| Paths | Change | Intent |
|-------|--------|--------|
| 4 dashboard A115 + 8 server A055/A063 | Reviewed deltas **31fbf** + **559d2186** | Conditional **A114/A115 Complete**; OFF seam Partial |

## 2026-10-28 — ROB2325 A055 OFF-seam server (Cursor integration)

| File | Change | Intent |
|------|--------|--------|
| `job-assistant-generation.ts`, `job-assistant-transport.ts`, `pricing-request.ts`, `planning-request.ts`, `brief-request.ts` | OFF-seam shared generation/transport; NULL defaults | Pin **fe241a0** production |
| `job-assistant-request.test.ts`, `brief-request.test.ts` | **62** cases incl. bb P2 privacy hunks | Pin **bb8d1f** |

## 2026-10-28 — ROB2310 A115 approved Won policy (Cursor integration)

| File | Change | Intent |
|------|--------|--------|
| `project-board.tsx` | Operational Active vs explicit Mark as Won; `hasRecordedWin` | Pin **89c3ee07** approved policy + P2 |
| `project-board-feedback.test.tsx` | **18** controlled handler cases | Source-fenced module only |

## 2026-10-28 — ROB2215 A001 guided library + commercial primaries (Cursor integration)

| File | Lines / scope | Intent |
|------|----------------|--------|
| `library/guided-capture.tsx`, `library-panel.tsx`, `a001-guided-library-brand-actions.test.ts` | Primary/focus palette guards | Pin **eb764cd5** (Rob21:03 guided build) |
| `billing/client-billing.tsx`, `variations/client-variations.tsx`, `final-account/final-account-client.tsx`, `a001-commercial-primary-controls.test.tsx` | Primary control presentation | Pin **6b743e61** commercial build |

## 2026-10-28 — CHECKPOINT2050 A001 final (Composer 95f95c + Claude 6e6df2, Cursor integration)

| File | Change | Intent |
|------|--------|--------|
| Four settings TSX + `a001-four-settings-brand-actions.test.ts` | Sage palette on primary/focus | Composer cloud 95f95c bounded slice |
| Four workflow TSX + `a001-workflow-brand-controls.test.tsx` | Nav/error/drawings/archive brand controls | Claude 6e6df2 bounded slice |

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
