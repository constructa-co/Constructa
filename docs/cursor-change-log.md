# Cursor change log

## 2026-11-09 — RC PR hosted-write gate + apex routing (cursor/rc-routing-20261109)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `.github/workflows/e2e.yml` | 33, 52 | Add `cursor/rc-integration-20261108` to hosted-write NOT_RUN list and `phase1` exclusion | PR #108 must not auto-run disposable Supabase hosted journey on the integration head |
| `src/lib/deployment/review-branch-ci.test.ts` | 18–24 | Extend `it.each` heads for RC branch + suffix control | Keeps workflow boolean expressions pinned in Vitest |
| `vercel.json` | — | No edit (already `source: "/"` at base f690204) | Apex-only rewrite preserved vs main `/:path*`; login/auth/app paths on constructa.co stay reachable |

## 2026-11-08 — RC integration import-fixture e2e (cursor/rc-integration-20261108)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `e2e/import-fixture/app/case-library/actions.ts` | 197–205 | `editElsewhere` uses `toWireContent(contentFromInput(...))` | Fixture RPC matched real wire; conflict save bumps revision so UI shows “changed somewhere else” |
| `e2e/import-fixture/case-library.fixture.ts` | 39–48, 227–265 | `showSendBlock` / `showPrepare`; publish error text; review-stage navigation | Send blockers render under Review document; past-job ticks stay on Prepare proposal |
| `e2e/import-fixture/case-study-save.fixture.ts` | 43 | Save button regex → “Save all past work” | Match current settings copy |
| `e2e/import-fixture/import.fixture.ts` | 49 | H1 → “Your company, brought into focus.” | Match `CompanyImportFrame` heading |
| `e2e/import-fixture/interview.fixture.ts` | 77, 145 | Failed-save alert → interview save error copy | Match `INTERVIEW_SAVE_ERROR` |
| `src/lib/cohort-ai/case-study-enhance-enabled.ts` | 8–10 | `true` when import-fixture env (`NEXT_PUBLIC_*`) | Fixture browser can exercise enhance UI without shipping flag on |
| `playwright.import-fixture.config.ts` | 54 | `NEXT_PUBLIC_CONSTRUCTA_IMPORT_FIXTURE=1` | Client bundle sees fixture enhance gate |
| `case-studies-client.tsx` / `case-study-editor.tsx` / `case-study-photo-slots.tsx` | text colours | Higher-contrast slate/purple on dark editor | Pass axe serious `color-contrast` in fixture checkpoints |
| `e2e/import-fixture/import.fixture.ts` | 108–109 | Save-failure alert copy | Match import client save-error wrapper |

## 2026-11-07 — A079 `gitRefName` string-only validation (Cursor agent)

| Paths | Lines | Change | Intent |
|-------|-------|--------|--------|
| `scripts/recovery-manifest-check.mjs` | 60–65 | Export `gitRefName`; reject non-strings, empty and whitespace-only; remove single-element array coercion | A079 checker: ref identities must be real strings, not coerced |
| `scripts/recovery-manifest-check.test.mjs` | 280–305 | Replace coercion test with array/blank-string refusal cases | Keep offline manifest tests aligned with validator |
| `src/lib/recovery/git-ref-name.test.ts` | (new) | Vitest table: 4 accepted + 11 rejected `gitRefName` inputs | Focused coverage for runner A079 fix |

## 2026-11-07 — A085 pending-edits test harness (Cursor)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `template-item-editor-add-outcomes.test.tsx` | hook hoisted ~6–35, `renderEditor` ~82–88, `beforeEach` ~103–110, new test ~220–240 | `useRef` mock with stable refs across re-renders; quantity-only edit while Add pending | Unblock A085 checker; prove single-field unsent quantity survives deferred Add success |
| `template-item-editor-kit-filter.test.tsx` | hook + `renderEditor` + `beforeEach` | Same `useRef` mock pattern | Kit filter tests call `TemplateItemEditor`, which now uses refs for pending-edit guards |
| `template-item-editor-primary.test.tsx` | hook + `renderMarkup` + `beforeEach` | Same `useRef` mock pattern | Primary palette tests render the editor without invalid hook errors |

No production change: `template-item-editor.tsx` A085 refs (b216bad) already correct.

## 2026-11-07 — A089 Git-check fixture timeout (Cursor)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `e2e/import-fixture/guard.test.ts` | 11–55, 71, 124 | `runGit` helper with `-c core.fsmonitor=false`, `-c core.untrackedCache=false`, centralized `SIGKILL` + 4000ms budget | Stop inherited fsmonitor/untracked-cache from blocking `git ls-files` for minutes; keep bounded async Git checks (A089) |

## 2026-11-07 — A001 palette verify (cursor/a001-verify-20261107)

| Paths | Lines (approx) | Change | Intent |
|-------|----------------|--------|--------|
| `src/lib/a001-palette-audit.ts` | 1–34 | Shared forbidden-primary regex + line scanner | Evidence helper for A001 token audit |
| `src/lib/a001-palette-audit.test.ts` | 1–67 | Dashboard/component scan + filter/create-kit focus checks | Regression guard for legacy blue primaries |
| `dashboard-client.tsx` | 27, 403–438 | `coreFocusRing` on pipeline search/type/status filters | Emerald focus matches charcoal/sage palette |
| `library/templates/create-kit-form.tsx` | 6–7, 53 | Name field `coreFocusRing` | Matches Initialize Kit primary token seam |
| `library/rate-override-client.tsx` | 9, 113 | Save rate uses `corePrimaryButton` | Library action primary off blue |
| `library/templates/[id]/template-item-editor.tsx` | 19, 128 | Add to Kit primary | Kit editor sage CTA |
| `projects/p-and-l/client-pl-dashboard.tsx` | 27, 589 | Log Cost opener | Commercial P&L primary alignment |
| `live/live-client.tsx` | import, 164 | New Project link | Live hub CTA |
| `materials/materials-client.tsx` | import, 140–355 | Basket + log costs primaries | Materials hub CTAs |
| `mobile/mobile-hub-client.tsx` | import, 307–355 | FAB + quick log + field focus | Mobile sage primaries/focus |
| `reporting/reporting-client.tsx` | import, 632–1158 | Four export/save primaries | Reporting actions |

Base branch: `origin/cq/cq-0105-a001-initialize-kit-primary` (includes `5d73ebc`).

## 2026-11-07 — A001 verify follow-up (cursor/a001-verify-20261107)

| Paths | Lines (approx.) | Change | Intent |
|-------|----------------|--------|--------|
| `contract-admin/components/SupervisorInvite.tsx` | 17, 85–95 | Name/email inputs use `coreFocusRing` | Contract-admin focus off blue rings |
| `dashboard-period-metrics.test.tsx` | 89–97 | List-first search assertion + board toggle | Replicate `09c446a` Vitest fix |
| `e2e/local-phase1/a111-readability.spec.ts` | 53 | `const fg` | ESLint prefer-const |
| `dashboard-route-shell.test.tsx`, `dashboard-route-shell-page.test.tsx` | tests | JSX composition (`.test.ts` → `.tsx`) | ESLint react/no-children-prop + tsc |

## 2026-11-07 — A109 founding cohort Apply CTA (Cursor agent)

| Paths | Change | Intent |
|-------|--------|--------|
| `src/components/marketing/phase-one.tsx` (L15–27 header, L48–56 links, L117–125 hero, L139+, pricing/features/footer) | Green **Apply to the founding cohort** CTA beside **Sign in**; hero/pricing/features/invitation point to `/apply` | A109: one clear apply entry separate from sign-in |
| `src/components/marketing/phase-one.module.css` (L22–26, L106 mobile) | `.headerActions`, `.applyCta` charcoal/sage tokens | Match phase-one marketing palette |
| `src/lib/founding-cohort/application-schema.ts`, `submission-adapter.ts` | Shared Zod validation + TODO no-op adapter (log only outside tests) | Validate without DB/email/third-party until Rob chooses destination |
| `src/app/apply/page.tsx`, `actions.ts`, `src/components/marketing/founding-cohort-apply-*` | `/apply` form: name, company, email, trade, team size, note; client + server validation | First application slice |
| `src/lib/public-measurement.ts` | Add `/apply` to public routes | Fail-closed measurement contract |
| `*.test.ts(x)` under `founding-cohort/`, `apply/`, `phase-one.test.tsx`, `public-measurement.test.ts` | Vitest coverage for schema, adapter, action, route, header CTA | Regression guard |

## 2026-11-07 — A023 platform terms checkbox (cursor/a023-terms-checkbox-20261107)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/app/terms-of-service/page.tsx` | 1–95 | PLACEHOLDER sections + Rob sign-off banner; revision label | Legal page for checkbox link until counsel-approved copy lands |
| `src/app/terms-of-service/page.test.tsx` | 1–14 | Vitest static render | Pins placeholder + revision surfacing |
| `src/lib/platform-terms.ts` | 28–33 | Auth metadata key constants | Stable sign-up payload field names |
| `src/lib/platform-terms-signup-evidence.ts` | 1–24 | Server-built revision + timestamp object | Record consent in `signUp` user metadata before DB table exists |
| `src/lib/platform-terms-signup-evidence.test.ts` | 1–17 | Vitest | Payload shape |
| `src/lib/platform-terms-consent-storage.ts` | 1–18 | Missing-table code adapter | Tolerate drafted migration not applied (`PGRST205` / `42P01`) |
| `src/lib/platform-terms-consent-storage.test.ts` | 1–16 | Vitest | Adapter codes |
| `src/lib/platform-terms-acceptance.ts` | 6, 42, 120–127 | `storage-not-installed` on missing table | Honest pre-migration behaviour |
| `src/lib/platform-terms.test.ts` | 183–195 | Case for `storage-not-installed` | Regression |
| `src/lib/platform-signup-action.ts` | 9, 119–132, 169–174 | Metadata on `signUp`; tolerate not-installed | Version + server timestamp in sign-up payload; account still succeeds |
| `src/lib/platform-signup-action.test.ts` | 36–40, 67–74, 156–160, 190–202 | Timer + metadata + not-installed test | Sequencing and payload |
| `src/lib/platform-terms-completion-action.ts` | 32–35 | Map not-installed → `not-stored` | Completion page stays honest when table absent |
| `supabase/migrations/20261024122500_platform_terms_acceptance.sql` | 2 | DRAFT ONLY header comment | Reminder: not applied until Rob approves |

## 2026-11-08 — RC integration CI (cursor/rc-integration-20261108)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/lib/supabase/lazy-browser-client.ts` | (new) | `tryCreateBrowserClient()` when public env unset | Let `next build` prerender `/login` during import-fixture job (blank Supabase env) |
| `src/app/login/page.tsx` | 4, 75–79 | Defer browser client to sign-in handler | Avoid `@supabase/ssr` throw at render time in CI |
| `e2e/import-fixture/profile.fixture.ts` | 70 | Assert `#profile-save-status` not ambiguous toast text | Playwright strict-mode match after save-status UX |
| `e2e/import-fixture/app/case-library/actions.ts` | 196–204 | `editElsewhere` uses `toWireContent` | In-app drafts carry `photos`; legacy RPC rejects extra keys so conflict simulation never landed |

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
