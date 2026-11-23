# Cursor change log

## 2026-11-23 — D101 PR #224 normal main integration (`codex/d59-con068-exact-main`)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| Costing + journey fixtures | merge | Main + D36 markup; on_net journey oracle | CON-068 Included persistence unchanged |

**Checks:** Cloud typecheck on merge head; hosted CI after push.

## 2026-11-20 — D68 approved schema sequence (CI fixture replay)

| File | Lines (approx.) | Change | Intent |
| --- | --- | --- | --- |
| `scripts/verify-migration-replay.sh` | baseline loop + D68 tail | Exclude six manifest filenames from sorted baseline; append fixtures in `manifest.tsv` order with SHA-256 and repo hash equality; per-PR `psql` stage checks and `d68-apply-receipt` lines | Ordered #176→#185→#222→#223→#224 proof without pre-applying planner from checkout |
| `scripts/ci-replay-in-container.sh` | `prepare` | Copy `scripts/fixtures/d68-schema-sequence` when `manifest.tsv` present; validate fixture SQL exist | Container replay sees fixtures; no production migration copy |
| `scripts/fixtures/d68-schema-sequence/manifest.tsv` | new | Tab-separated PR order + SHA-256 + source heads | Parse without Python/jq in container |
| `scripts/test-replay-bootstrap.sh` | D68 branches | Optional fifth `docker cp`, workspace file count, expected replay path order, receipt grep guards | Preserve standard bootstrap when manifest absent |
| `docs/delivery/2026-11-20/d68-schema-sequence.md` | new | Apply order, preview steps, non-destructive rollback SQL per PR | Operator apply-ready text (not executed) |

**Checks:** NOT RUN (CI-only lane). **Workflow path** `scripts/fixtures/d68-schema-sequence/**` not added — R1 may extend `migration-replay.yml` triggers or pair with script commits.

## 2026-11-20 — D68 PR #185 merge onto `main` `53167bc` (D68 source-only)

| File | Lines (approx.) | Change | Intent |
| --- | --- | --- | --- |
| `src/lib/proposal-site-photos.ts` | full module | Combined D51 `sitePhotoOrigin` / `sitePhotosForJob` with CON-026 `sitePhotosAfterUpload` | Resolve add/add merge; keep main filtering + #185 cover prepend |
| `src/lib/proposal-site-photos.test.ts` | full file | D51 origin/snapshot tests + CON-026 prepend/append cases | Single regression file for both behaviours |
| `src/app/dashboard/projects/proposal/review-send-client.tsx` | imports ~39–41 | Single import from `proposal-site-photos` | Post-merge hygiene |
| `docs/delivery/2026-11-16/changelog.md` | header | Kept D49 #185 delivery rows + `CON-073` from main | Preserve both delivery logs |
| `docs/delivery/2026-11-20/d68-185-prep.md` | new | Preview-test steps + non-destructive rollback SQL (text) | Handoff for draft #185 CI; owner applies only |

**Checks:** NOT RUN (D68 CI-only lane). Root (R1) owns merge commit, fast-forward draft #185, and CI grade.

## 2026-11-16 — D49 PR #185 blocker fixes (cursor/d49-settings-con-018-025-026-ade5)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/lib/company-vat-settings.ts` | vat + select | Gate off → legacy 20%; gate on + `vat_registered` null → legacy; `profilePublicationSelectColumns` omits VAT cols until gate on | Safe pre-migration; preserve existing contractors |
| `supabase/migrations/20261116103000_con018_profile_vat_settings.sql` | defaults | `vat_registered` nullable default NULL | No implied unregistered until user sets |
| `src/app/dashboard/projects/proposal/page.tsx` | profile fetch | Shared `profilePublicationSelectColumns()` + typed cast | Preview/publish parity with `actions.ts` |
| `src/app/dashboard/projects/proposal/actions.ts` | publish | Import shared column list | Same profile shape as proposal page |
| `src/lib/proposal-site-photos.ts` | (new) | Prepend cover upload, append scope upload | CON-026 cover targets first site photo |
| `src/app/dashboard/projects/proposal/review-send-client.tsx` | upload | `sitePhotosAfterUpload(..., "cover" \| "scope")` | Cover slot = index 0 |
| `src/app/dashboard/settings/profile/profile-form.tsx` | VAT toggle | `null` treated as registered in UI only | Matches legacy 20% until explicit opt-out |
| `src/lib/company-vat-settings.test.ts`, `proposal-review.test.ts`, `proposal-site-photos.test.ts` | tests | VAT legacy/null/gate; preview/publish 5%; prepend cover | Claude block regressions |

## 2026-11-16 — D49 CON-018 / CON-025 / CON-026 settings (cursor/d49-settings-con-018-025-026-ade5)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/lib/company-vat-settings.ts` | (new) | Gate, normalise VAT number, `vatFromCompanyAndProject` | CON-018 company VAT rate/registration/reverse-charge defaults |
| `supabase/migrations/20261116103000_con018_profile_vat_settings.sql` | (new) | `profiles` VAT columns | **OWNER/MIGRATION GATE — not applied** |
| `src/lib/profile-update.ts` | vat_number + gated fields | Normalise VAT number; persist gated columns when `CONSTRUCTA_PROFILE_VAT_SETTINGS=1` | Safe pre-migration saves |
| `src/app/dashboard/settings/profile/profile-form.tsx` | company basics | VAT on proposals fieldset when gate on | CON-018 UI |
| `src/app/dashboard/settings/profile/page.tsx` | pass gate | `vatSettingsEnabled` prop | Deploy-time switch |
| `src/lib/proposal-review.ts` | `vatFor` | Thread profile into company VAT helper | Proposal preview/publish parity |
| `src/app/dashboard/projects/proposal/actions.ts` | publish | `vatFor(project, profile)` | Publish uses company VAT when enabled |
| `src/lib/company-interview/storage-ready.ts` | (new) | Missing-table PostgREST codes | CON-025 |
| `src/lib/company-interview/service.ts` | readAnswers/loadInterview | Treat missing interview storage as empty state | CON-025 no whole-page failure |
| `src/app/dashboard/settings/profile/interview/page.tsx` | load try/catch | Fail closed to client load error UI | CON-025 |
| `src/app/dashboard/projects/proposal/review-send-client.tsx` | cover section | Cover upload via `proposal-photos` path; site choice not blocked | CON-026 |
| `src/app/dashboard/projects/proposal/a074-cover-photo-choice.test.tsx` | CON-026 case | Cover upload control regression | |
| `src/lib/company-vat-settings.test.ts`, `storage-ready.test.ts`, `service.test.ts`, `proposal-review.test.ts` | tests | Focused regressions | |

**Rollout gates (no live activation):**
- CON-018: `CONSTRUCTA_PROFILE_VAT_SETTINGS=1` **and** migration `20261116103000_con018_profile_vat_settings.sql` applied by **Rob**.
- CON-026 cover persistence unchanged: `CONSTRUCTA_PROPOSAL_COVER_PHOTO=1` **and** migration `20261114201500_a074_proposal_cover_photo.sql`.

## 2026-11-20 — PR #176 main integration merge conflict resolution (`codex/approved-176-integration-20261120`)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/lib/financial.ts` | 36–99, 172–228 | D36 `on_net` / `compound` + main CON-016 inline comments | Single canonical contract sum |
| `src/lib/simple-estimate.ts` | 15–19 | Both `evaluateDiscountSubmitGate` and `MarkupMethod` imports | Main discount gates + D36 summary |
| `src/lib/proposal-publication.ts` | imports, fee items, case studies, site photos | `MARKUP_METHOD_NOTE`, `contractValueVatBasis`, main comments + D36 `calculation_note` | Publication snapshot parity |
| `src/lib/case-library/proposal-wiring.test.ts` | 28–50 | Both main programme hash pin and D36 `calculation_note` pin | Preserve main wiring + D36 additive field |
| `src/app/dashboard/projects/costs/estimate-client.tsx` | 1688–1696 | Markup note + main zero-adjustment guard | UI merge |
| `src/app/dashboard/projects/costs/advanced-estimate.tsx` | 36–41 | Combined D36 + main imports | Advanced workspace |
| `src/app/dashboard/projects/costs/boq-excel-export.ts` | 6–9 | Canonical sum + section grouping imports | BoQ export |
| `src/lib/estimate-line-type.ts`, `proposal-site-photos.ts`, `proposal-site-photos.test.ts` | conflict tail | Marker cleanup only | Trivial UU |
| `docs/delivery/2026-11-16/changelog.md` | whole | Merged delivery sections (no duplicate CON-073) | Both D36 and main notes |
| `docs/delivery/2026-11-20/approved-176-integration.md` | rollback § | Safer rollback semantics | No blind column drop / old app |

**Checks:** NOT RUN (source-only lane; R1 owns git commit, CI, Sonnet, preview).

## 2026-11-21 — D81 CON-012 profile isolation (ephemeral replay, draft unverified in CI)

| File | Lines (approx.) | Change | Intent |
| --- | --- | --- | --- |
| `e2e/d81-profile-isolation.qa.ts` | (new) | Two seeded accounts: onboarding + profile phone save/reload; cross-account DB read; JWT RLS probe | Real browser/DB proof for profile prefill/save isolation on loopback only |
| `scripts/ephemeral-replay/seed-d81-profile-isolation.mjs` | (new) | Seed alpha/beta synthetic auth when `E2E_D81_PROFILE_ISOLATION=1` | Disposable identities after guarded `db reset` |
| `e2e/support/ephemeral-replay-env.ts` | ~15–20 | `D81_PROFILE_*` email/password constants | Labelled replay identities |
| `e2e/support/backend.ts` | ~56–130 | `savedProfileFields`, `syntheticUserIdByEmail`, `clientProfileIsolationProbe` | Read-only verification without widening admin usage |
| `playwright.d38-ephemeral-replay.config.ts` | `testMatch` | Include D81 spec | Same harness as D38/D78 |
| `scripts/ephemeral-replay/d38-ephemeral-browser.sh` | seed block | Conditional D81 seed | No seed without env flag |
| `.github/workflows/d38-con-browser-replay.yml` | `paths`, `env` | Trigger on D81; set `E2E_D81_PROFILE_ISOLATION` | CI orchestration |
| `e2e/D81-PROFILE-ISOLATION.md` | (new) | Scope/limitations note | R1 handoff |

**Checks:** NOT RUN locally (CI-only). Does not claim P0 closed or hosted QA.

## 2026-11-21 — D78 founding-user browser journey on the disposable replay stack (draft, unverified in CI)

| File | Lines (approx.) | Change | Intent |
| --- | --- | --- | --- |
| `e2e/d78-founding-journey.qa.ts` | (new) | Synthetic signup → company setup → project → brief → estimate → programme → proposal review → pre-send PDF download | Finish the D38 ephemeral harness into the founding journey; publishes and emails nothing |
| `playwright.d38-ephemeral-replay.config.ts` | `testMatch` | Also matches the D78 spec | Reuse the existing local-only config, stubs and guards |
| `.github/workflows/d38-con-browser-replay.yml` | `paths` | Trigger on the D78 spec and `e2e/support/**` | Existing disposable CI job runs the journey |
| `e2e/support/backend.ts` | `publicationRecords` | Optional `env` argument | Read publications from the ephemeral stack, not only the hosted disposable project |
| `e2e/support/journey-data.ts` | `expectedProgramme` | Optional fixed Monday | Keep expected dates clear of UK bank holidays that the programme now skips |
## 2026-11-21 — D79 marketing a11y + speed (read-only CI)

| File | Lines (approx.) | Change | Intent |
| --- | --- | --- | --- |
| `e2e/readonly-marketing-audit/audit-harness.mjs` | new | Shared GET/HEAD guards, blocked hosts/paths, `createGuardedBrowserContext` | D79 reuses D69 write guards without duplicating policy |
| `e2e/readonly-marketing-audit/run-production-marketing-a11y.mjs` | new | Playwright + axe WCAG 2.x tags; fail on serious/critical | Production a11y evidence |
| `e2e/readonly-marketing-audit/run-production-marketing-lighthouse.mjs` | new | Lighthouse mobile+desktop per sitemap URL; metrics/opportunities as lab baseline, no invented score gate | Speed + a11y scores without form interaction |
| `.github/workflows/marketing-a11y-speed-audit.yml` | new | Read-only PR job including drafts; `CONSTRUCTA_MARKETING_AUDIT_ORIGIN`; artifacts | Guarded GET/HEAD baseline; separate hosted write journey stays draft-blocked |
| `package.json` / `package-lock.json` | devDeps | Pin `lighthouse@12.8.2`, `chrome-launcher@1.2.1` | Node 24 CI install |
| `src/components/public-chrome.tsx` | 19–66 | Skip link + `#public-marketing-content` on all marketing profiles | WCAG bypass on full launch profile |
| `src/components/Header.tsx` | logo/nav | `aria-label` on home + main nav; `text-gray-400` links | Contrast + discernible name (full profile) |
| `src/components/marketing/phase-one.test.tsx` | ~288 | Full profile expects skip + focusable main | Match a11y chrome |
| `readonlyaudit/README.md` | header | D79 artifact names | Handoff |
| `docs/delivery/2026-11-21/d79-marketing-a11y-speed.md` | new | Bounded delivery note | R1 / PR context |

**Checks:** NOT RUN locally (D79 lane). Validation is GitHub Actions; current-production axe findings remain an explicitly advisory baseline until the deployed fixes are rescanned.

## 2026-11-21 — D69 read-only production marketing audit (CI only)

| File | Lines (approx.) | Change | Intent |
| --- | --- | --- | --- |
| `e2e/readonly-marketing-audit/load-audit-target.mjs` | new | Parse `marketingSiteOrigin`, `MARKETING_SITEMAP_PATHS`, disallow prefixes from `src/lib/marketing-seo.ts` | Public origin from repo, not guessed |
| `e2e/readonly-marketing-audit/known-telemetry-ignores.mjs` | new | Documented Vercel Web Analytics ignore rules with source citations | Never fake-pass telemetry noise |
| `e2e/readonly-marketing-audit/run-production-marketing-audit.mjs` | new | Playwright chromium audit: GET/HEAD only, SEO/meta/OG, 390px overflow, links, JSON+MD | D69 marketing defect evidence |
| `.github/workflows/marketing-production-audit.yml` | new | `pull_request` job: `npm ci`, chromium install, 15m, `contents: read`, artifacts | CI-only; no secrets |
| `readonlyaudit/README.md` | new | Artifact directory pointer | CI output location |
| `.gitignore` | readonlyaudit | Ignore generated audit output; keep README | Avoid committing CI screenshots |

**Checks:** NOT RUN locally (source-only lane per D69). Validation is GitHub Actions on PR.

**Public origin:** canonical fallback `https://www.constructa.co` was audited separately; final11/11 CI uses independently verified main production alias `https://constructa-nu.vercel.app`. No domain/settings change.

## 2026-11-21 — D69 release evidence reconciliation (main 53167bc)

| File | Lines (approx.) | Change | Intent |
| --- | --- | --- | --- |
| `walkthrough-action-register.json` | 4–45, A038, A109, A093 | `mainReleaseEvidence20261120` block; `evidence20261120` on A038/A109; `evidence20261121` on A093; `updatedAt` | Reconcile compact register to D63/D64 merge CI without status inflation |
| `CLAUDE.md` | 3–8, 31 | Current-authority header → `AGENTS.md`/inbox; label April Perplexity commit block historical | Stop stale April instructions overriding live delivery rules |
| `docs/delivery/2026-11-21/d69-release-evidence-reconciliation.md` | new | Bounded handoff; points to private D61–D65 handoff | Public delivery note without inventing private filename gates |

**Checks:** NOT RUN (D69 source-only lane). No commit/push in this session.

## 2026-11-20 — D63 CON-061 case-study photo behaviour

| File | Lines (approx.) | Change | Intent |
| --- | --- | --- | --- |
| `src/lib/case-library/case-study-photo-behaviour.ts` | new | SHA-256 dedupe, active/legacy split, primary ordering for proposals | CON-061 pure rules |
| `src/lib/case-library/legacy-photos.ts` | 12–30 | Save accepts three active slots plus safe legacy tail | Preserve stored extras |
| `src/lib/proposal-publication.ts` | import + `selectCaseStudies` photos | `legacyProfileCaseStudyPhotos` | Main photo first on proposals |
| `src/lib/case-library/resolve.ts` | library photos line | `libraryCaseStudyProposalPhotos` | Library parity |
| `src/app/dashboard/settings/case-studies/case-studies-client.tsx` | photos section | Hash refusal, main control, legacy strip | Legacy editor UX |
| `src/app/dashboard/settings/case-studies/library/case-study-editor.tsx` | upload + slots props | Duplicate refusal, primary state | Library editor UX |
| `src/app/dashboard/settings/case-studies/library/case-study-photo-slots.tsx` | slot chrome | Main badge / Use as main | Shared slot UI |
| `src/lib/case-library/case-study-photo-behaviour.test.ts` | new | Hash, split, primary order | Regression |
| `src/lib/case-library/legacy-photos.test.ts`, `save-action.test.ts`, `photo-upload-outcomes.test.tsx`, `legacy-photo-save-outcomes.test.tsx`, `case-study-photo-journey.test.ts` | varied | Updated expectations | CON-061 contracts |
| `docs/delivery/2026-11-20/d63-con061-case-study-photo-behaviour.md` | new | Delivery note | Handoff |

**Checks:** NOT RUN in this session (source-only lane). Root owns validation and draft PR.

## 2026-11-20 — D64 CON053/CON013 minimal contact and apply forms (collection off)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/lib/marketing/public-form-collection.ts` | new | Default-off `CONSTRUCTA_PUBLIC_FORM_COLLECTION_ENABLED`; destination env name constants; readiness helpers | Single fail-closed gate for contact + apply collection |
| `src/lib/marketing/public-marketing-form-schema.ts` | new | Shared Zod schema: name, email, optional company, message, consent | CON053/CON013 minimal field contract |
| `src/lib/marketing/public-marketing-form-submission.ts` | new | Server-only submit stub; throws when off or unrouted | No send/store while off |
| `src/lib/founding-cohort/application-schema.ts`, `submission-adapter.ts` | rewire | Apply uses shared schema + apply readiness gate | Align apply with contact gates |
| `src/components/marketing/public-marketing-lead-form.tsx` | new | Shared client form; disabled submit when collection off | UI fail-closed |
| `src/components/marketing/public-form-collection-notice.tsx` | new | Notice citing enable + destination env var names only | Honest preview copy |
| `src/app/contact/page.tsx`, `actions.ts`, `contact-marketing-form.tsx` | rewrite | Replace Formspree with gated server action form | Remove third-party POST |
| `src/app/apply/actions.ts`, `founding-cohort-apply-form.tsx`, `page.tsx` | update | Minimal fields; server-passes `collectionReady` | Apply matches contact shape |
| `src/components/marketing/full-home.tsx` | contact panel | Remove Formspree `fetch`; reuse gated form | Home contact stops live collection |
| `src/components/marketing/founding-cohort-apply.module.css` | `.consentLabel` | Checkbox consent layout | Accessible consent tickbox |
| `src/app/**`, `src/lib/**`, `src/components/marketing/**` tests | update/new | Expect minimal fields, no Formspree, collection-off behaviour | Reviewable focused tests |

**Delivery note:** `docs/delivery/2026-11-20/d64-con053-con013-contact-apply-minimal-forms.md`

## 2026-11-19 — CON-043 phone estimate total and proposal review evidence

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `e2e/local-phase1/phone-journey-estimate-proposal.spec.ts` | new | Dual-bundle Edge tests at 360/390/430; add-line MOCK ack; trial-click reachability; screenshots + JSON manifest | Close remaining CON-043 scope without programme re-test |
| `playwright.local-phone-journey-estimate-proposal.config.ts` | new | Config for dual compile outputs (`CONSTRUCTA_LOCAL_ESTIMATE_OUTPUT` + `CONSTRUCTA_LOCAL_PROPOSAL_OUTPUT`) | Reuse existing fixture compiles |
| `e2e/local-phase1/build-brief-price.mjs` | resolve/compile | JSON bundle support, installed package resolution, symlinked `node_modules` fallback, clearer transpile errors | Unblock offline compile after `uk-bank-holidays-bundled.json` / Radix graph growth |
| `docs/evidence/con-043-phone-journey-evidence/*` | new | PNG captures + `con043-phone-journey-evidence.json` + README | Synthetic offline evidence; not hosted acceptance |

**Preserved:** Programme phone list at `611d767`; unit full-width #203; CON-032/181 dock padding — not duplicated. No app product source edits.

## 2026-11-19 — CON-074 browser/axe contrast evidence (offline fixture)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `e2e/local-phase1/con074-contrast-entry.tsx` | new | Real `DashboardClient` + `EstimateClient` under `ThemeProvider` | CON-074 surfaces without hosted app |
| `e2e/local-phase1/con074-contrast.spec.ts` | new | Playwright + `@axe-core/playwright`, computed contrast, screenshots | Browser evidence for pills + total bar in both themes |
| `playwright.local-con074-contrast.config.ts` | new | Dedicated config (Edge channel via phase1 base) | Isolated leg |
| `e2e/local-phase1/build-brief-price.mjs` | scenario list, JSON transpile guard, con074 stubs | `con074-contrast` scenario; `.json` bundle fix; pipeline/radix fixture adapters | Unblock offline compile at `4f4dfad` without shared `con066-fixture.mjs` edit |
| `docs/evidence/con074-browser-contrast/*` | new | `provenance.json`, PNGs, axe JSON, README | Head + sourceHashes + axe outcomes at `4f4dfad69823548dde19cd94dd961ab1c368d44c` |

**Boundary:** Synthetic job data; list/board are compiler stubs (pills/total bar are actual components). Not whole-dashboard WCAG sign-off.
## 2026-11-19 — CON-043 phone editing table horizontal scroll (bounded)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/app/dashboard/projects/schedule/client-page.tsx` | Gantt card ~1009–1260 | `data-planner-editing-table-scroll` with `overflow-x-auto lg:overflow-x-visible`; header/body `min-w-[444px] lg:min-w-[900px]` | Restore phone scroll for 444px fixed editing columns without putting `overflow-x-auto` on the outer card; phone date list unchanged |
| `src/app/dashboard/projects/schedule/schedule-control-palette.test.tsx` | desktop layout case | Assert editing scroll wrapper and 444px min width | Regression |
| `src/app/dashboard/projects/schedule/planner-phone-phase-list.test.tsx` | bounded list case | Assert editing scroll markup alongside phone list | CON-043 scroll repair |

**Preserved:** `PlannerPhonePhaseList` default phone view; no maths or storage changes.

## 2026-11-19 — CON-043 phone programme phase list (detailed planner)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/app/dashboard/projects/schedule/client-page.tsx` | phone list, Gantt breakpoints | `PlannerPhonePhaseList` from `displayPlan`; `lg:hidden` list; Gantt track `hidden lg:block`; stage inline dates `hidden lg:flex` | Phone shows start/finish/duration from same plan as chart; desktop Gantt/editing unchanged |
| `src/app/dashboard/projects/schedule/planner-phone-phase-list.test.tsx` | new | Date parity, responsive classes, incomplete-plan omit | CON-043 acceptance |
| `src/app/dashboard/projects/schedule/schedule-control-palette.test.tsx` | desktop layout case | Expect phone list + `lg:min-w-[900px]` / `lg:overflow-x-auto` | Align with bounded responsive layout |
| `src/app/dashboard/projects/schedule/planner-dates.test.tsx` | finish/stage assertions | Phone list + `fmtDateFull` completion labels | Keep date contract after mobile list |

**Preserved:** `plannerDisplayPlan` / `computeProgrammePlan` only; no storage, publication or new date math.

## 2026-11-19 — CON-083 sign-in copy, numbering, and disabled signup chrome

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/components/first-session-frame.tsx` | header tagline, overview `span` | “build your business”; decorative steps `1`–`4` not `01`–`04` | Trustworthy chrome; align overview numbers with journey labels (no `0`/`1` split) |
| `src/app/login/page.tsx` | policy import, `isSignUp`, mode toggle, footnote | Hide Get started / signup progress when `isPlatformSignupDisabled()`; guard `switchMode` | Signup OFF: no dead-end account creation affordances |
| `src/app/login/signup-disabled-presentation.test.tsx` | new | Disabled-gate presentation | CON-083 regression |
| `src/components/account-progress.test.tsx` | overview row regex | Expect `1`–`4` numbering | Matches frame change |
| `src/components/first-session-frame.test.tsx` | header describe | Tagline assertion | Regression |
| `src/app/login/*.test.tsx` (7 files), `completion-routing.test.tsx` | `vi.mock` policy | `isPlatformSignupDisabled: () => false` in harnesses that exercise signup UI | Keep existing signup contracts testable while production gate stays on |

**Preserved:** show/hide password and field-help from #207; `platform-signup-policy.ts` predicate unchanged; no auth/action logic changes.

## 2026-11-19 — CON-075 hide days open without enquiry_date (presentation fix)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/app/dashboard/pipeline-card-facts.ts` | `PipelineOpenFacts`, `pipelineDaysOpenAge` | Age from `enquiry_date` only; never `created_at` | HIDE outcome — no invented enquiry / no 218d demo |
| `src/app/dashboard/pipeline-card-facts.test.ts` | `pipelineDaysOpenAge` cases | `created_at`-only → null; `enquiry_date` → age | Regression helpers |
| `src/app/dashboard/pipeline-days-open-display.test.tsx` | list + board | 218d `created_at` demo: no column, no board age, no amber | CON-075 UI regression |
| `src/app/dashboard/project-list.tsx` | header, body, colspan | Remove Days Open column and sort; colspan 7 | No meaningless header/cells |
| `src/app/dashboard/project-board.tsx` | value strip | Remove open-age label (no dash) | Board consistent with hide |

**Preserved:** archived exclusion from prior commit; `projectAge` helper for future `enquiry_date`; Sent Date and other sort/metrics unchanged.

## 2026-11-19 — CON-075 pipeline days open (S35)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/app/dashboard/pipeline-card-facts.ts` | new | `projectAge` + `pipelineDaysOpenAge` (created_at basis; null when invalid/future/archived) | Meaningful days open or hide — no `0d`/`NaNd`/negative |
| `src/app/dashboard/pipeline-card-facts.test.ts` | new | Fixed `now`; labels, invalid dates, archived gate | CON-075 unit coverage without clock flake |
| `src/app/dashboard/pipeline-days-open-display.test.tsx` | new | List renders dash vs `5d` with mocked `Date.now` | List column regression |
| `src/app/dashboard/project-list.tsx` | import, sort, cell | Use `pipelineDaysOpenAge`; dash + tooltip when unusable | CON-075 list |
| `src/app/dashboard/project-board.tsx` | age strip | `Open today` / `Open 5w` / dash; no sent-display changes | CON-075 board age only |
| `src/app/dashboard/dashboard-client.tsx` | `filteredProjects` | Drop `is_archived` rows from board/list | Original scope exclude archived |
| `src/app/dashboard/page.tsx` | select | Include `is_archived` for client filter | Archived exclusion wiring |
| `src/app/dashboard/pipeline-filters.test.tsx` | new case | Archived row not passed to list mock | Regression |

**Sibling collected:** `.cq-wt/claude-d56-dashboard-demo` CON-075 age helpers only (no CON-073 `recordedPlatformSendAt`, KPI, seed, or `page.tsx` proposal_status).

## 2026-11-19 — CON-074 dark selected pills and estimate total bar contrast

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/components/project-chooser.module.css` | `--chooser-selected-*`, `.viewBar`/`.viewButton`, period/list sort | Shared selected-state tokens for light/dark; board/list view pills use module CSS instead of low-contrast charcoal-on-charcoal Tailwind | Fix illegible This Month / List selection in dark theme; AA pairs via tokens |
| `src/components/estimating.module.css` | `--price-totalbar-*`, `.totalDock` | Dark total bar uses deep sage (`#1e3428` / `#f3fff2`), not mint `--price-accent` | Stop light-green sticky total bar in dark estimating |
| `src/app/dashboard/dashboard-client.tsx` | `data-dark`, view toggle | `data-dark="true"` string; view pills → `ui.viewBar` / `ui.viewButton` | Match `[data-dark="true"]` selectors so dark tokens apply |
| `src/app/dashboard/project-list.tsx`, `project-board.tsx`, `review-send-client.tsx`, `first-project-start.tsx` | `data-dark` | Boolean → `"true"` string | Same dark-token wiring |
| `src/app/dashboard/con-074-theme-contrast.test.tsx` | new | Token/CSS assertions + explicit WCAG contrast math on pairs | Regression without claiming browser axe |

**Sibling `claude-d56-mobile-theme`:** changelog bundles CON-074 label with phone layout work only; no pill/total-bar token slice to port (avoided planner/units/quantity-draft overlap).

## 2026-11-19 — CON-073 history append best-effort + prior-status CAS

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/lib/pipeline-stage-history.ts` | `appendPipelineStageHistory` insert | `try/catch` around insert; thrown client → `{ recorded: false, schemaGate: false }` | Honour "never throws"; no false failure from history |
| `src/lib/pipeline-stage-history.test.ts` | new case | insert-throw regression | Helper contract |
| `src/app/dashboard/board-actions.ts` | `confirmedStageWrite` | `.eq("status", fromStatus)` on update; history append outside auth/update `try`, own swallow `catch` | CAS avoids wrong `from` on concurrent change; confirmed write stays `success:true` if append throws |
| `src/app/dashboard/board-actions.test.ts` | filters + new case | expect status CAS filter; append-throw → `success:true` | Sonnet BLOCK repair |

## 2026-11-18 — CON-073 board stage move confirmation (S45)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/app/dashboard/project-board.tsx` | pending ref, `requestMove` / dialog wiring, all board triggers | Confirm before any operational stage change; A115 `recordWin` allowed at same stage (Active) | Prevent accidental one-click Proposal Sent / Lost moves; keep operational semantics |
| `src/app/dashboard/pipeline-stage-move-dialog.tsx` | new | From/to summary + Cancel / Confirm move | Bounded confirmation with clear operational vs Mark as Won copy |
| `src/lib/pipeline-stage-move-copy.ts` | new | Dialog strings + display labels | Shared copy |
| `src/lib/pipeline-stage-history.ts` | new | `appendPipelineStageHistory` on `project_pipeline_stage_events` | Log transitions when table exists; schema gate otherwise |
| `src/app/dashboard/board-actions.ts` | `confirmedStageWrite` | Read prior `status`, append history after acknowledged write | Server-side transition log on existing mutation path |
| `src/app/dashboard/project-board-feedback.test.tsx` | CON-073 block + confirm helpers | Cancel/no write, confirm/single write, failure retains stage, no confirm for unchanged picker | S45 regression |
| `src/app/dashboard/board-actions.test.ts` | prior-row read mock | History call + missing-prior refusal | Server path |
| `src/lib/pipeline-stage-history.test.ts` | new | Record + schema gate | History helper |
| `src/app/dashboard/a115-pipeline-publication-clarity.test.ts` | disclosure line | Expect confirm-before-save copy | A115 alignment |

**Not changed:** KPI/metrics, proposal send/publication, D56 sent-display gating, migrations/SQL.

## 2026-11-18 — CON-058 PR210 proposal-wiring content hash pin

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/lib/case-library/proposal-wiring.test.ts` | legacy pin test (~28–40) | Content `e769bc4f…` / publication `3a92756f…`; revert `duration_label` alone restores `2b0185bf…` / `87b47a6d…` | PR210 CI: prove CON-058 delta is only `programme_plan.duration_label`; case-study/regional-calendar wiring pins stand |

**Evidence:** Canonical diff is one path, `programme_plan.duration_label`: `3 weeks` → `15 working days (3 weeks)`; that revert alone restores content `2b0185bf…` and publication `87b47a6d…`. Issued publications read stored `snapshot` JSON (not recomputed) — no frozen-label regression.

## 2026-11-18 — CON-058 programme duration labels

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/lib/programme-plan.ts` | `formatWorkingDuration` (~92–103) | Primary label is always N working day(s); whole job weeks append `(N weeks)` using `programmeWeekUnitCount` | CON-058: stop mixing bare “3 weeks” with “8 working days” on simple, detailed and proposal surfaces |
| `src/lib/programme-plan.test.ts` | wording + `computeProgrammePlan` | Expect `15 working days (3 weeks)` | Lock label contract |
| `src/lib/programme-working-pattern-integration.test.tsx` | format + PDF checks | Same expectations; PDF uses regex for escaped parentheses | Six-day and Mon–Fri patterns |
| `src/lib/simple-programme.test.ts`, `simple-programme-working-pattern.test.ts`, `planner-display-plan.test.ts`, `job-working-pattern-rob0942.test.ts`, `simple-actions.test.ts`, `actions.test.ts`, `proposal-document.test.ts`, `proposal-parity.test.ts`, `planner-dates.test.tsx` | `duration_label` / HTML asserts | Updated expected strings only | Tests follow shared formatter |

**Collection note:** Sibling `.cq-wt/claude-d56-programme` return (see `cos-inbox/constructa-runs/d56-programme.log`) did not implement CON-058 copy; only planner tooltips / 071 / 072 / 044 / 045 — not integrated here.

## 2026-11-18 — CON-070 PR209 inline save-and-next await repair

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/app/dashboard/projects/costs/estimate-client.tsx` | `newLineProps.onSaveNext` (~308), `InlineNewPriceLine`/`LineForm` types | Return `submitPriceLine` promise from Save and add next; widen handler types | CI: `inline-price-entry` concurrency test can await confirmation before asserting contractSum 500 |

## 2026-11-18 — CON-070 queue stall repair (e12559d Sonnet review)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `estimate-client.tsx` | `clearWorkListQueue`, `endWorkListQueueAfterContinueBlocked`, ~525–580, openers | End queue on post-save continue block/fail; clear queue on unrelated openers + `onQueueClear` | No stranded hidden queue; list text preserved for reopen |
| `price-work-list.tsx` | `onQueueClear` prop | Clear list invokes parent queue reset | Cancel queue when typed list cleared |
| `work-list-entry.test.tsx` | 4 cases | blocked/fail after save, edit opener, `onQueueClear` | Sonnet BLOCK regression coverage |
| `price-work-list.test.tsx` | Clear list | `onQueueClear` contract | Component wire for queue reset |

## 2026-11-18 — CON-070 bulk queue repair (ffb54c3 review)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/components/price-work-list.tsx` | helpers, `queuedRemaining`, bulk message | `filterUniqueWorkListRanges`; queue-remaining status; duplicate skip copy on bulk add | Visible queue progress; preserve per-row duplicate warnings |
| `src/app/dashboard/projects/costs/estimate-client.tsx` | queue advance, `onSaveNext`, status UI | Advance queue only after confirmed save/open; disable Save-and-add-next when queued; refusal retains queue | Fix silent queue loss on failed save / blocked advance |
| `src/app/dashboard/projects/costs/work-list-entry.test.tsx` | new cases | failed save + queue; Save-and-add-next; duplicate skip | Interaction contracts from Sonnet review |
| `src/components/price-work-list.test.tsx` | filter + queued UI | duplicate filter unit; queued-remaining copy | Component-level regression |

## 2026-11-18 — CON-070 estimating helper copy and bulk list drafts

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/components/price-work-list.tsx` | summary, help, `onOpenAll` | Rename to “Turn a list into lines”; truthful no-rates copy; **Add every line as an unpriced draft** | CON-070: no implied rate engine |
| `src/app/dashboard/projects/costs/estimate-client.tsx` | brief button/help, helpers note, queue + `submitNewPriceLine` | Start from brief; long-brief pointer; work-list queue in state; chain drafts after Save | Bulk list flow without AI/library rates |
| `src/lib/simple-estimate.ts` | `WorkListDraftQueue`, `work-list/queue` action | Persist pending list lines across saves | Queue survives save + revision bump |
| `src/components/brief-price-excerpt.tsx` | help | No suggested rates/quantities | Truthful brief excerpt helper |
| Tests | `price-work-list`, `work-list-entry`, `brief-pricing-entry` | `onOpenAll` + queue continuation; long-brief copy | Meaningful behaviour contracts only |

## 2026-11-18 — CON-069 repair (Sonnet 638e31a review)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/lib/discount-confirm.ts` | 19–24 | 100% shows large-discount warning; `highDiscountRequiresReason` helper | Match spec; shared server guard |
| `src/app/dashboard/projects/costs/advanced-estimate.tsx` | 287–548 | `acknowledgedDiscountRef`; rollback on missing reason; persist catch/reject cleanup | Baseline tracks last saved pair only |
| `src/app/dashboard/projects/costs/simple-actions.ts` | 356+ | Reject `>25%` with blank reason | Server boundary |
| `src/app/dashboard/projects/costs/actions.ts` | `saveDiscountAction` | Reject `>25%` with blank reason | Server boundary |
| Tests | discount-confirm, simple-estimate, advanced-discount-confirm, simple-actions | 100% warning; tab/cancel regression; server refusal | CON-069 repair evidence |

## 2026-11-18 — CON-069 high-discount confirmation (simple + advanced)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/lib/discount-confirm.ts` | 1–55 | Shared 25% boundary, reason + confirm gate; 100% skips large-discount warning | CON-069 business rules without touching `financial.ts` |
| `src/lib/simple-estimate.ts` | 312–322, 878–915 | `submitAdjustments` accepts `highDiscountConfirmed`; extended adjustment field errors | Gate high discounts before server write |
| `src/app/dashboard/projects/costs/estimate-client.tsx` | 155–178, 808–823, 1538–1565 | Confirm dialog + cancel reverts draft discount/reason to saved estimate | Simple pricing path |
| `src/app/dashboard/projects/costs/discount-confirm-dialog.tsx` | 1–58 | Reusable confirm dialog | Shared UI for simple + advanced |
| `src/app/dashboard/projects/costs/advanced-estimate.tsx` | 98–100, 287–295, 388–548, 1700–1810 | Baseline rollback, 0–100 blur validation, confirm-before-save above 25% | Advanced path; no blur autosubmit for high discounts |
| `src/app/dashboard/projects/costs/actions.ts` | 18–26, 99–102, 533–540 | Server-side 0–100 percentage validation on margins/discount | Align with D51 without broader prelim work |
| `src/lib/discount-confirm.test.ts` | new | Boundary, 100% warning, gate cases | CON-069 unit regression |
| `src/lib/simple-estimate.test.ts` | 548–620 | Adjustments submit result + high-discount cases | Simple flow regression |
| `src/app/dashboard/projects/costs/estimate-discount-confirm.test.ts` | new | Cancel/draft revert without save | Cancel preserves acknowledged amounts |
| `src/app/dashboard/projects/costs/advanced-discount-confirm.test.tsx` | new | 25% blur save; >25% no autosave | Advanced smoke |

## 2026-11-18 — CON-044 #206 f2d35dc published start ref + association autosave receipt

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/app/dashboard/projects/schedule/client-page.tsx` | `proposalStartRef` effect | Set ref from `project.start_date` only (empty when null); drop `programmeStart` dependency | Tracking writes must not publish editable calendar |
| `src/app/dashboard/projects/schedule/client-page.tsx` | tracking autosave | `publishedStartForWrite` → `updatePhasesAction`; association + planning saves draft then returns error | Durable planning without false auto-saved tracking |
| `src/app/dashboard/projects/schedule/planner-opening.test.tsx` | CON-044 describe | Null published start tracking arg; simultaneous plan+tracking refusal shows error | Regression for Codex f2d35dc blockers 1–2 |

## 2026-11-18 — CON-044 #206 fbec22b Sonnet review blockers (tracking start date, draft on refusal, duplicate publish)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/lib/programme-planner-draft.ts` | `programmeIdentityCollisionsInvolvingTracking` | Duplicate identity refuses tracking only when colliding stages carry tracking data | Untracked duplicate stages remain publishable |
| `src/app/dashboard/projects/schedule/client-page.tsx` | tracking autosave branch | `updatePhasesAction` / draft clear use `publishedStart`; on association failure with planning delta, draft autosave still runs | Published calendar stays on programme_phases; planning edits durable when tracking cannot merge |
| `src/lib/programme-planner-draft.test.ts` | duplicate cases | Split no-tracking vs tracked duplicate | Regression for blocker 3 |
| `src/app/dashboard/projects/schedule/planner-opening.test.tsx` | CON-044 describe | Assert tracking write start arg; manual save duplicates; rename keeps draft without tracking write | Regression for blockers 1–3 |

## 2026-11-18 — CON-044 #206 679bccc B1–B4 tracking association repair (codex/con-044-publication-review)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/lib/programme-planner-draft.ts` | `programmeTrackingFieldsChanged`, new helpers | Drop start-date gate on tracking diff; `programmeTrackingAssociationError` / collision checks | B1/B2/B3: no silent tracking loss; refuse ambiguous identity |
| `src/lib/programme-planner-draft.test.ts` | new cases | Rename, duplicate identity, changed start | B1–B3 unit regression |
| `src/app/dashboard/projects/schedule/client-page.tsx` | persist + open + manual save | Association guard before tracking merge/manual publish; overlay notice; always pass `workingPattern` (incl. `undefined`) before `startDate` | B4 signature fix + visible refusal |
| `src/app/dashboard/projects/schedule/planner-opening.test.tsx` | CON-044 describe | Legacy no-pattern manual save args; changed-start tracking publish; rename refusal | B1–B4 integration regression |

## 2026-11-18 — CON-044 BLOCK-1 tracking/draft split repair (codex/con-044-publication-review)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/lib/programme-planner-draft.ts` | identity, overlay, merge | Stable phase keys; overlay published tracking on draft reopen; merge tracking onto `programme_phases` without adopting draft planning; strip tracking from draft payloads | Fix BLOCK-1 dual-write and stale draft tracking |
| `src/lib/programme-planner-draft.test.ts` | new cases | Reorder overlay, merge, strip | Regression |
| `src/lib/server/programme-storage.ts` | `writeProgrammePlannerDraft` | Persist planning-only draft phases | Server-side tracking strip |
| `src/app/dashboard/projects/schedule/actions.ts` | draft autosave, new action | Strip tracking on draft write; `clearProgrammePlannerDraftAction` after tracking-only saves | Rebase/clear stale server drafts |
| `src/app/dashboard/projects/schedule/client-page.tsx` | persist + open | Split tracking vs planning autosave; overlay on open; `proposalPhasesRef` sync via effect; `plannerDraftViewerScope` prop | BLOCK-1 client path |
| `src/app/dashboard/projects/schedule/page.tsx` | mount | Pass `plannerDraftViewerScope={user.id}` | Authenticated viewer scope for session fallback |
| `src/app/dashboard/projects/schedule/simple-programme-client.tsx` | DetailedPlanner | Thread viewer scope into detailed planner | Scope propagation |
| `src/app/dashboard/projects/schedule/planner-opening.test.tsx` | CON-044 describe | Pending-draft reopen + split autosave regression | Integration coverage |
| `src/app/dashboard/projects/schedule/*.test.tsx` | props | `plannerDraftViewerScope` on test mounts | Type/test alignment |

## 2026-11-18 — CON-044 client/server boundary repair (cursor/con-044-publication)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/lib/plain-deep-equal.ts` | all | JSON-like `plainDeepEqual` | Remove `node:util` from client-imported draft helpers |
| `src/lib/programme-planner-draft.ts` | compare + sessionStorage | `plainDeepEqual`; scoped keys; write success boolean | Preserve order-independent planning compare in the browser |
| `src/lib/programme-planner-draft.test.ts` | new cases | Property order + scoped sessionStorage | Regression |
| `src/app/dashboard/projects/schedule/client-page.tsx` | draft fallback | `user_id` storage scope; failed local write surfaces error | Tab/account isolation + quota/privacy write failures |

## 2026-11-16 — D54 document repair of #186 at 69d10b6 (CON-055 suppression gated by presentation version)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/lib/proposal-document.ts` | after `feeSectionTitle`; About, price, cover use | `LABEL_SUPPRESSION_PRESENTATION_VERSION = 3`; `snapshotProjectTypeDisplay`, `snapshotFeeSectionTitle` | Snapshots issued without a version or at version 2 keep the type of work and lone price heading they were issued with; CON-055 suppression applies from version 3 |
| `src/lib/proposal-publication.ts` | presentation version type, snapshot build | New snapshots (draft preview and sent) carry `document_presentation_version: 3`; still outside both hashes | Explicitly versioned new snapshot; send fingerprint unchanged |
| `src/lib/proposal-document-p2-visual.test.ts` | new describe | Issued no-version and v2 wording kept (also when drawn as a draft); v3 suppressed in preview and sent alike; entered values stay in the snapshot; multi-group headings kept; hashes equal across versions | Regression cover. Written without a shell: Vitest, `tsc` and build NOT RUN in this session |

## 2026-11-16 — D57 PR #184 repair (cursor/d49-brief-con-017-034-035-483d)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/lib/postcode-address-provider.ts` | 21–34 | Literal `process.env.NEXT_PUBLIC_*` gate reads | Gates were undefined in client bundles (Claude blocker) |
| `src/components/postcode-address-picker.tsx` | search row + hint | Search controls disabled and gap copy shown once when no lookup | Remove duplicate fallback copy and dead-end Find |
| `src/components/uk-date-input.tsx` | preview + help | Full-month preview; help copy makes no browser-order or PDF-format claim | CON-035 copy accuracy |
| `src/lib/postcode-address-provider.test.ts`, `src/components/postcode-address-picker.test.tsx`, `src/components/uk-date-input.test.tsx`, `src/app/dashboard/projects/brief/brief-edit-lock.test.tsx` | (updated) | Source-form gate guard, unconfigured picker, date change events, restored input count | Regression |

## 2026-11-16 — D49 PR #184 follow-up (cursor/d49-brief-con-017-034-035-483d)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/components/uk-date-input.tsx` | state + `value` | Uncontrolled preview tracks `onChange`; controlled follows `value` | Fix stale UK preview (Claude block) |
| `src/lib/postcode-address-provider.ts` | gates + copy | User-facing gap message; lookup requires data-transfer approval env | CON-034 no third-party transfer without approval |
| `src/lib/postcode-address-provider.test.ts` | gates | Enabled-without-approval stays off | Regression |
| `src/components/uk-date-input.test.tsx` | uncontrolled SSR | `defaultValue` preview | CON-035 |

## 2026-11-16 — D49 CON-017 / CON-034 / CON-035 (cursor/d49-brief-con-017-034-035-483d)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/lib/proposal-figure-consistency.ts` | 1–82 | `evaluateProposalFigureConsistency` compares £ in text to canonical totals | CON-017 snag |
| `src/app/dashboard/projects/proposal/review-send-client.tsx` | readiness block | Alert list with `data-figure-consistency-warning` | Surface mismatches before send |
| `src/lib/postcode-address-provider.ts` | 1–81 | postcodes.io lookup gated by env flag; gap message | CON-034 integration + fallback |
| `src/components/postcode-address-picker.tsx` | Find/hint | Configuration gap copy when lookup off | CON-034 |
| `src/components/uk-date-input.tsx` | (new) | UK `lang`, `formatPlanDate` preview, controlled/uncontrolled | CON-035 |
| `src/app/dashboard/projects/new/new-project-form.tsx` | address + date | `clientPostcodeLookup()`; UK start date | Wire CON-034/035 on create job |
| `src/app/dashboard/projects/brief/brief-client.tsx` | start date | `UkDateInput` | CON-035 on brief |
| `src/app/dashboard/projects/settings/client-page.tsx` | pickers + date | Lookup provider + UK start date | CON-034/035 on settings |
| `src/lib/*.test.ts`, `src/components/*.test.tsx`, `review-send-client.test.ts` | (new/updated) | Focused regressions | Lock CON-017/034/035 behaviour |
| `src/app/dashboard/projects/brief/brief-edit-lock.test.tsx` | ~337 | Assert `UkDateInput` wrapper, not raw `input` count | SSR harness does not expand client components |
## 2026-11-16 — D46 P1 estimate #181 follow-up (portal, warnings, MoM) (cursor/d46-p1-estimate-con-022-031-032-a05d)

| File | Change | Intent |
|------|--------|--------|
| `catalogue-library-dropdown.tsx` | `catalogueDropdownPanel` + optional portal helper | Body-portal dropdown; inline fallback for replay/tests |
| `advanced-estimate.tsx` | `createPortal` + focus-synced coords | Non-clipping catalogue search at scroll edges |
| `estimate-batch-csv.ts`, `client-boq-normalize.ts` | Stricter heading rules, explicit totals | Priced/malformed rows stay priced; `parse_warnings` |
| `boq-import.tsx`, `boq-import-action.ts` | Warning banner + import block | Display and act on unreadable cells |
| `simple-actions.ts` | Legacy error only when MoM empty | Valid MoM survives legacy query failure |
| `con-181-integration.test.ts` | (new) | Real-path integration for portal, CSV, MoM, import guard |
| `estimating.module.css` | Mobile `advancedWorkspaceWide` | Narrow viewport + dock padding |

## 2026-11-16 — D46 P1 estimate #181 CI fix (cursor/d46-p1-estimate-con-022-031-032-a05d)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/lib/client-boq-normalize.ts` | (new) | `normalizeClientBoQLines` — non-string sections, heading heuristics, `parse_warnings` | #181: guard AI JSON; no invented qty/rate |
| `src/app/dashboard/projects/costs/boq-import-action.ts` | PDF/Excel parse | Normalise AI lines before `batchSectionHeadings` | Same |
| `src/lib/estimate-batch-csv.ts` | parse loop | Description-only headings; malformed qty/rate flags; no default qty | CON-022 CSV hardening |
| `src/app/dashboard/projects/costs/simple-actions.ts` | `loadAdvancedEstimatingDataAction` | Fail on `legacyLibrary.error`; explicit `catalogueSource` | CON-031 error handling + source |
| `src/app/dashboard/projects/costs/advanced-estimate.tsx` | activity | Match lines by `id` (sectionSource copies); live-section drift banner | Fix `catalogue-line-review` activity regression |
| `src/components/estimating.module.css` | workspace | `totalDock` z-index 20; scroller `overflow: visible`; wide inner scroll | CON-032 dropdown without lowering dock |
| `src/app/dashboard/projects/costs/estimate-client.tsx` | wrapper | `advancedWorkspaceWide` class on wide column | CON-032 |
| `src/lib/client-boq-normalize.test.ts`, `estimate-batch-csv.test.ts`, `con-032-advanced-panel-layout.test.ts` | tests | Expanded guards | Meaningful regressions |

## 2026-11-16 — D46 P1 estimate CON-022 / CON-031 / CON-032 (cursor/d46-p1-estimate-con-022-031-032-a05d)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/lib/estimate-batch-sections.ts` | (new) | `orderedEstimateSections`, `groupLinesBySection`, `batchSectionHeadings` | CON-022: section order follows batch/line sequence, not trade template |
| `src/lib/estimate-batch-csv.ts` | (new) | Deterministic BoQ CSV parser (`Section`, `Description`, `Qty`, `Rate`, …) | CON-022: structured CSV import without inventing prices |
| `src/lib/cost-library-catalog.ts` | (new) | MoM + override mapping; `parseStoredCatalogueRate` | CON-031: advanced catalogue uses same stored rates as library; skip missing rates |
| `src/app/dashboard/projects/costs/simple-actions.ts` | `loadAdvancedEstimatingDataAction` | Load `mom_items` + `mom_item_overrides`; legacy `cost_library_items` fallback only | CON-031 real source/display |
| `src/app/dashboard/projects/costs/advanced-estimate.tsx` | section grouping | Shared batch section helpers; `advancedSectionCard` | CON-022 coherent headings in advanced workspace |
| `src/app/dashboard/projects/costs/boq-import.tsx` | `processFile` | CSV fast path via `parseEstimateBatchCsv` before AI Excel parse | CON-022 CSV import |
| `src/app/dashboard/projects/costs/boq-import-action.ts` | sections | `batchSectionHeadings` for parsed BoQ | CON-022 heading order |
| `src/app/dashboard/projects/costs/boq-excel-export.ts` | section order | Shared `orderedEstimateSections` | CON-022 export matches display order |
| `src/components/estimating.module.css` | `advancedWorkspaceRoot`, `totalDock` z-index | Isolation + bottom padding; dock below workspace overlays | CON-032 panel overlap |
| `src/app/dashboard/projects/costs/estimate-client.tsx` | advanced wrapper classes | Apply workspace layout classes | CON-032 |
| `src/lib/*.test.ts`, `con-032-advanced-panel-layout.test.ts` | (new) | Focused CON-022/031/032 tests | No live data |
| `package-lock.json` | revert | Restored to `868df15` main; drop accidental npm-install churn from first push | Keep P1 diff scoped to estimate work |

## 2026-11-16 — D46 P1 proposal CON-036/037/040 (cursor/d46-p1-proposal-con-036-037-040-445c)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/lib/proposal-readiness.ts` | `ReadinessKey`, input, mandatory[] | `siteAddress` seventh mandatory gate | CON-036: cannot mark proposal ready without site address |
| `src/lib/proposal-review.ts`, `src/app/dashboard/projects/proposal/actions.ts` | readiness wiring | Pass `project.site_address` into readiness | Publish path matches review checklist |
| `src/app/dashboard/projects/proposal/review-send-client.tsx` | fixes, closing, draft ref UI | `siteAddress` fix link; MD message empty state + saved button; draft vs next issued reference | CON-036 UI; CON-037 explicit empty/saved MD message; CON-040 reference labelling |
| `src/lib/proposal-document.ts` | preview id, `isDraftProposalDocument`, reference | Preview publication → reference `Draft`; issued uses `proposalReference` | CON-040 draft immutable distinction (no issued PDF / #178 changes) |
| `src/app/dashboard/projects/proposal/publication-history-panel.tsx` | `projectId`, row labels | `data-issued-reference` per sent version | CON-040 correct issued reference display in history |
| `src/lib/case-library/proposal-wiring.test.ts` | readiness baseline | Mandatory checklist includes `siteAddress`; case-study guards unchanged | CON-036 wiring regression with library hashes |
| `src/lib/proposal-readiness.test.ts`, `proposal-document.test.ts`, `company-closing-entry.test.tsx`, `review-send-client.test.ts` | CON-036/037/040 cases | Focused Vitest (122 tests in 4 files) | Regression coverage per ID |
## 2026-11-16 — D49 P2 visual bundle CON-055–060 (cursor/d49-p2-document-polish-con-055-056-057-060-cecf)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/lib/proposal-document.ts` | 197–225, 361–378, 499 | `publicationProjectTypeDisplay`, `feeSectionTitle`, About/cover/price use | CON-055: hide placeholder Other and misleading Other work labels |
| `src/app/dashboard/projects/proposal/review-send-client.tsx` | 659–663, 517–540 | Cover summary + signature preview columns with `break-inside-avoid` | CON-055 prep cover; CON-056 signature labels stay with lines |
| `src/components/proposal/proposal-document-view.tsx` | 38–39, 110, 178 | `data-cover-logo`, `break-after-avoid` on section/subheadings | CON-057 headings with content; CON-060 logo hook |
| `src/components/proposal/proposal-web-pages.module.css` | 51–72 | Paginated logo max size, column break rules, signature groups | CON-057/060 web paginated layout |
| `src/lib/pdf/proposal-brochure.ts` | 970–976 | `signature-field` layout log entries | CON-056 PDF signature field grouping |
| `src/lib/proposal-document-p2-visual.test.ts` | (new) | CON-055/057/060 unit regressions | Focused bundle tests |
| `e2e/local-phase1/reader-styled.spec.ts` | 144–146, 205–207, 296 | Tab order/button count for layout toggles | Reader chrome parity with current UI |
| `docs/temp-files/playwright-p2-visual-reader.config.ts` | (new) | Chromium config for offline reader fixture | Synthetic layout screenshots/CI |
| Associated test updates | credential/metric/custom-job-type/preparation | Expectations for suppressed placeholder types | CON-055 regression |

## 2026-11-16 — D49 CON-024/041/042 concurrent saves, admin conversion, pipeline totals (cursor/d49-admin-con-024-041-042-5fd6)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/lib/server/legacy-case-studies-fingerprint.ts` | (new) | MD5 fingerprint of stored legacy `case_studies` (server-only) | CON-024 compare-and-set; fingerprint supplied on render, not computed in the browser |
| `src/app/dashboard/settings/case-studies/actions.ts` | `saveCaseStudiesAction` | Read profile, refuse stale `expectedFingerprint`, update with `case_studies` guard | CON-024 prevent blind whole-list overwrite across tabs |
| `src/app/dashboard/settings/case-studies/save-state.ts` | reducer + types | `storedFingerprint`, `conflict` result, save sends fingerprint | Client reflects CAS outcomes |
| `src/app/dashboard/settings/case-studies/case-studies-client.tsx` | save effect | Pass `expectedFingerprint`; optional `initialStoredFingerprint` | Wire CON-024 through UI |
| `src/app/dashboard/projects/costs/simple-actions.ts` | update + adjustments | Column guards on read-then-update for simple estimate paths | CON-024 estimate concurrent edits |
| `src/lib/pipeline-value.ts` | (new) | Shared home/kanban pipeline valuation using contract sum | CON-042 align Home KPI with CRM kanban |
| `src/app/dashboard/home/home-client.tsx` | pipeline KPI | `totalHomePipelineValue` | CON-042 |
| `src/app/dashboard/page.tsx` | kanban total | `kanbanFinancialsFromEstimates` + `totalKanbanPipelineValue` | CON-042 |
| `src/lib/admin-dashboard-metrics.ts` | (new) | `sumSignupPoints`, `signupConversionRatePct` | CON-041 same 30d window as Plausible visitors |
| `src/app/admin/page.tsx` | website metrics | Conversion from last-30d signups | CON-041 |
| `*.test.ts` / `save-state.test.ts` | synthetic | CAS and metric regressions; stale-tab tests now expect refusal | Same auth boundaries as production actions |

## 2026-11-15 — D36 CON-005/014 PDF identity and price repair (cursor/d36-pdf-identity-and-price-repair-141e)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/lib/proposal-document.ts` | presentation helpers, client name, price layout | Site-only client suppression; v2 cover authoritative price (incl. zero VAT); legacy layout when `document_presentation_version` absent | CON-005/014 + issued snapshot compat |
| `src/lib/proposal-publication.ts` | snapshot + content hash | `document_presentation_version: 2` on new snapshots; excluded from content hash | Freeze layout without changing send fingerprint |
| `src/lib/pdf/proposal-pdf-data.test.ts` | (new) | PDF counts, zero-VAT once, draft vs issued routes via `downloadProposalPdf` | Generated PDF data regression |
| `src/lib/proposal-document.test.ts` | identity + legacy layout | Allow client same as job title; legacy totals when presentation version omitted | Document layer regression |
| `src/components/proposal/proposal-metric-alignment.test.tsx` | reverse-charge key facts | Cover `Price` plus programme on zero VAT | Authoritative headline on cover |
| `src/app/dashboard/projects/proposal/review-send-client.tsx` | presend PDF copy | Draft watermark before issue; clean PDF from issued snapshots only | CON-014 export posture |
| `src/lib/pdf/proposal-brochure.ts` | `responseBlock` | Pack receipt block toward page foot when terms share the page | A075 compact pagination after shorter price block |

## 2026-11-15 — D38 CON-007 recipient email confirmation (cursor/d38-con-007-proposal-email-default-off-20261115)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/lib/proposal-review.ts` | types, `sendProposal`, `EMAIL_RECIPIENT_CONFIRM_ERROR` | Pass `emailRecipientConfirmed`; retry accepts `recipientEmailConfirmed` | Separate preview send from recipient-specific email consent |
| `src/app/dashboard/projects/proposal/actions.ts` | `publishProposalAction`, `retryProposalDeliveryAction` | Refuse email when confirmation flags are not exactly `true` | Server cannot email on preview confirmation alone |
| `src/app/dashboard/projects/proposal/review-send-client.tsx` | send + retry UI | Recipient checkbox after opt-in; retry checkbox; send blocked until confirmed | CON-007 explicit confirm before client email |
| `src/app/dashboard/projects/proposal/review-send-email-confirm.test.tsx` | (new) | Replay harness: no publish when opt-in without recipient confirm | Cancelled / withheld email path |
| `src/app/dashboard/projects/proposal/review-send-client.test.ts` | source guard | Separate `data-send-confirm` vs `data-email-recipient-confirm` | Preview confirm does not stand in for email |
| `src/app/dashboard/projects/proposal/actions.test.ts` | publish + retry | Mock transport: no send without `emailRecipientConfirmed` / `recipientEmailConfirmed` | Focused server regression |
| `src/lib/proposal-review.test.ts` | `sendProposal` | Pass-through of recipient confirmation | Controller wiring |
| `e2e/phase1-journey.spec.ts` | publish + retry | Tick recipient confirm when exercising mocked email | Preserve optional email journey |

## 2026-11-15 — D38 CON-007 proposal client email default off (cursor/d38-con-007-proposal-email-default-off-20261115)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/app/dashboard/projects/proposal/review-send-client.tsx` | `deliverByEmail` state, email checkbox | Default `useState(false)`; `data-deliver-by-email`; optional helper copy | CON-007: no client email unless contractor explicitly opts in; send confirmation unchanged |
| `src/app/dashboard/projects/proposal/review-send-client.test.ts` | new `it` | SSR guard: email opt-in unchecked by default | Focused D38 regression |
| `src/lib/proposal-review.test.ts` | new `it` | `sendProposal` with `deliverByEmail: false` | Controller still publishes link-only delivery |
| `e2e/phase1-journey.spec.ts` | `publish()` helper | `{ emailClient: true }` opts in before send | Preserve mocked email journey when explicitly requested |

## 2026-11-15 — D38 ephemeral hardening (post-8624f49, pre-PR)

| File | Change | Intent |
|------|--------|--------|
| `scripts/ephemeral-replay/parse-supabase-status-env.sh` | (new) Whitelist parse of `supabase status -o env`; no eval; no value logging | CI/local safety |
| `scripts/ephemeral-replay/guards.sh` | DB URL, link, Vercel, return-based failures | Local-only reset; guards testable |
| `scripts/test-ephemeral-replay-guards.sh` | (new) Shell validation | `npm run test:ephemeral-replay-guards` |
| `scripts/ephemeral-replay/d38-ephemeral-browser.sh` | Parse before reset; loopback DB_URL guard | Explicit local reset |
| `.github/workflows/d38-con-browser-replay.yml` | Chromium `--with-deps`; guard step | Clean Ubuntu CI |
| `src/lib/deployment/supabase-target.mjs` | Loopback forbidden in preview/E2E/Vercel | Test-only loopback |
| `playwright.d38-ephemeral-replay.config.ts` | `browserName: chromium` | CI browser install match |

## 2026-11-15 — D38 ephemeral Supabase browser replay (continuation on cursor/constructa-d38-con-001-002-browser-reproduction-bd36)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/lib/deployment/supabase-target.mjs` | context + URL + compiled | `e2e-replay` context; loopback `:54321` API URL; allow empty `.supabase.co` refs in bundle | Build/start guard for ephemeral CLI stack |
| `src/lib/deployment/supabase-target.test.ts` | tests | Ephemeral loopback pass/fail cases | Regression |
| `e2e/support/ephemeral-replay-env.ts` | (new) | Fail-closed env; no hosted credentials | D38 ephemeral harness |
| `e2e/support/ephemeral-replay-env.test.ts` | (new) | Unit tests | |
| `e2e/support/ephemeral-replay-global-setup.ts` | (new) | Local auth health; no production in build | |
| `playwright.d38-ephemeral-replay.config.ts` | (new) | Playwright + `e2e-replay` server env | |
| `e2e/d38-con-001-002-browser.qa.ts` | auth steps | Ephemeral sign-up/seed + hosted QA dual mode | No hosted secrets on ephemeral path |
| `e2e/support/backend.ts` | admin | Allow loopback ephemeral replay read-back | |
| `scripts/ephemeral-replay/*` | (new) | Guards, seed auth, orchestrator | Runnable local/CI startup |
| `supabase/config.toml` | (new) | Local CLI project id `ephemeralreplay00001` | Ephemeral stack |
| `.github/workflows/d38-con-browser-replay.yml` | (new) | CI job without E2E secrets | CI-only browser when Docker present |
| `docs/temp-files/d38-ephemeral-ci-execution-plan.md` | (new) | Blocker + steps | Agent VM without Docker |
| `package.json` | scripts | `e2e:d38-ephemeral-replay` | |

## 2026-11-15 — D38 CON-001 / CON-002 browser reproduction (cursor/constructa-d38-con-001-002-browser-reproduction-bd36)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `scripts/verify-phase1-smoke.sql` | ~157–182 | PR #170 `save_phase1_brief` RPC + persistence EXISTS check before publication smoke | CON-002 SQL replay; prior disposable assertions unchanged |
| `e2e/support/backend.ts` | ~156–188 | `savedProjectBrief` read-back helper | Mirror SQL read-back after browser save |
| `e2e/d38-con-001-002-browser.qa.ts` | (new) | Hosted Playwright: QA sign-in, new project, brief save, reload, DB check | CON-001/002 browser reproduction |
| `playwright.d38-con-brief-persistence.config.ts` | (new) | Single-project harness reusing no-publish global setup | Isolated from full journey matrix |
| `e2e/D38-CON-BRIEF-PERSISTENCE.md` | (new) | Operator prerequisites and honest limits | Evidence handoff |
| `docs/temp-files/d38-con-001-002-browser-evidence.md` | (new) | Green/red table for this agent run | Honest environment limits |
| `package.json` | scripts | `e2e:d38-con-brief-persistence` | Discoverable entry command |

## 2026-11-15 — D38 CON-004 BLOCK #171 follow-up (cursor/constructa-d38-con-004-b37b)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/lib/uk-bank-holidays.ts` | parseUkBankHolidayDivision | Validate persisted GOV.UK division strings | Reject malformed stored divisions |
| `src/lib/job-working-pattern.ts` | resolveProgrammeCalendar | Fall back to job region when stored division invalid | Safe calendar resolution |
| `src/instrumentation.ts` | register | Fire-and-forget GOV.UK feed refresh on Node boot | Wire official holiday feed with bundled fallback |
| `src/lib/server/planning-request.ts` | verifyPlanningRequest select | Include `region` for planning fingerprint/context | Regional holidays in planning request path |
| `src/lib/planner-phases.ts` | plannerDisplayPlan, plannerPhaseSpan | Optional `bankHolidayDivision` passed to canonical plan | Planner display uses job region |
| `src/app/dashboard/projects/schedule/client-page.tsx` | display plan + offsets | Resolve division from `project.region` | Detailed planner calendar matches region |
| `src/app/dashboard/projects/programme/*` | page + client | Region-aware baseline via `programmePlanForProject` / basis note | As-built baseline matches proposal calendar |
| `src/app/dashboard/projects/schedule/simple-programme-client.tsx` | basis fallback | Region-specific basis when no plan rendered | Simple programme empty-state copy |
| `src/lib/programme-plan.test.ts` | year-end case | 5 days from 2026-12-24 → 2027-01-04 skips New Year BH | Meaningful year-end regression |
| `src/lib/uk-bank-holidays.test.ts` | malformed division | Calendar rejects invalid stored division | Malformed persisted division validation |
| `src/lib/planning-conversation.test.ts` | region case | Scotland wording in planning context | Region propagation evidence |
| `src/lib/proposal-document.test.ts` | PDF/HTML basis | `programmeBasisNote(plan)` not static default | Fix stale PDF assertion |
| `docs/temp-files/d38-con-004-test-evidence.md` | (pending update) | BLOCK #171 receipts | Test evidence for review |

## 2026-11-15 — D38 CON-004 UK bank holidays in programme math (cursor/constructa-d38-con-004-b37b)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/data/uk-bank-holidays-bundled.json` | (new) | Snapshot of GOV.UK `bank-holidays.json` for all UK divisions | Offline fallback for programme working-day math |
| `src/lib/uk-bank-holidays.ts` | (new) | Regional division resolver, holiday lookup, basis-note copy, feed merge | CON-004 core: England/Scotland/NI bank holidays excluded from working days |
| `src/lib/uk-bank-holidays-feed.ts` | (new) | `refreshUkBankHolidaysFromGovUk` with TTL + merge over bundled | Live GOV.UK feed with bundled fallback |
| `src/lib/programme-calendar.ts` | (new) | Re-export calendar helpers from job-working-pattern | Avoid circular imports; project region → division |
| `src/lib/job-working-pattern.ts` | worksUtc, add/count/next, describe | Thread `ProgrammeCalendar` through all working-day math; skip bank holidays for v1 and v2 | All programme working-day paths honour UK holidays |
| `src/lib/programme-plan.ts` | compute/plan types, basis notes | `bank_holiday_division` on plans; region-aware `programmePlanForProject` | Publication/editor share one calendar |
| `src/lib/relative-programme.ts` | compute/basis note | Division on relative plans; updated basis wording | Relative + dated programmes consistent |
| `src/lib/simple-programme.ts`, `planning-conversation.ts`, `proposal-publication.ts` | call sites | Pass job region into display/snapshot programme math | Regional holidays follow brief site region |
| `src/lib/*.test.ts`, schedule/proposal tests | expectations | CON-004 acceptance (65 days → 2027-05-05); basis note copy; dates with holidays | Focused regression evidence |
| `docs/cursor-change-log.md` | this entry | Log D38 CON-004 scope | User change-log rule |

## 2026-11-15 — Marketing Features example screens follow-up (cursor/marketing-features-captures-e459)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/components/marketing/product-screenshots.tsx` | imports, alt, dates | `docs/evidence/marketing-product-screenshots-2026-11-15/*` from synthetic `journey` fixture at `527c7cf9` | Replace 5 Oct Stage 2F JPEGs with current-interface desktop+mobile captures; keep **Example screens** + synthetic labels |
| `src/components/marketing/product-screenshots.test.tsx` | blob SHA1, filenames, qualification | 15 Nov 2026 labels; strip `<picture>` before price-claim regex | Guard evidence paths and copy; avoid false positives from encoded image URLs |
| `docs/evidence/marketing-product-screenshots-2026-11-15/*.jpg` | (new, 4) | Playwright full-page JPEGs 1440×900 + 390×844 | Committed marketing evidence |
| `e2e/local-phase1/marketing-product-captures.spec.ts`, `playwright.local-marketing-captures.config.ts`, `docs/temp-files/run-marketing-product-captures.sh` | (new) | Offline journey build → capture harness | Regenerate fixtures without hosted writes |
| `docs/temp-files/marketing-public-image-sweep-2026-11-15.md` | routes | Extended sweep: sitemap paths + `/customers` + both guide slugs; 76 refs, 0 broken | Read-only constructa-nu.vercel.app coverage |

## 2026-11-15 — Marketing About hero/founder (cursor/marketing-about-illustrations-e459)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/components/marketing/cohort-about.tsx`, `cohort-about.module.css`, `full-about.tsx` | `figureImage`, intrinsic sizes | Hero 2048² + founder 1024² sizing; **problem** panel stays `about-problem1.png` | Preventive fix on captioned hero/founder panels (reported blanks); problem illustration unchanged |
| `src/components/marketing/cohort-about-illustrations.test.tsx` | (new) | Static markup guards cohort + full | Regression on captioned figures |

## 2026-11-15 — Marketing About captioned panels follow-up (cursor/marketing-about-illustrations-e459)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/components/marketing/cohort-about.tsx` | hero, founder, `AboutFigure` | `figureImage` on captioned + split panels; intrinsic sizes on hero/founder; **problem stays `about-problem1.png`** | Target hero/founder caption panels (reported blank), not problem asset swap |
| `src/components/marketing/cohort-about.module.css` | `.figureImage` | Module class on `Image` instead of `.figure img` only | Next optimizer wrapper sizing for captioned panels |
| `src/components/marketing/full-about.tsx` | hero/founder sizes | 2048² hero, 1024² founder; problem1 unchanged | Full-profile decode parity |
| `src/components/marketing/cohort-about-illustrations.test.tsx` | (new) | Hero/founder caption + dimension guards for cohort and full | Synthetic render proof |
| `docs/temp-files/verify-about-images-playwright.mjs` | (new) | Playwright `naturalWidth` / visibility on named host | Browser decode evidence (read-only) |

## 2026-11-15 — A001 D28 route palette walkthrough (cursor/a001-d28-route-palette-walkthrough-2527)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/app/dashboard/projects/contract-admin/components/DelayAnalysisTab.tsx` | imports, Run Analysis button | `corePrimaryButton` / `coreFocusVisibleRing` | Confirmed brand-blue primary deviation |
| `src/app/dashboard/projects/contract-admin/components/SupervisorInvite.tsx` | Generate Link button | Same core palette | Confirmed primary deviation |
| `src/app/offline/page.tsx` | mark tile | `bg-[#c9efcf]` + ink text | Public offline mark matches sage palette |
| `src/app/dashboard/a001-commercial-controls-palette.test.ts` | new `it` | Guard delay analysis + supervisor invite primaries | Regression |
| `src/components/a001-workflow-standalone-controls-brand.test.ts` | offline `it` | Assert sage mark, no `bg-blue-600` | D28 offline evidence |
| `e2e/local-navigation/compile.mjs` | `read()` | GNU/Linux-tolerant `stat` probe | Cloud agent offline fixture build |
| `docs/temp-files/a001-d28-evidence/*` | new | Route inventory, verification report, Chromium Playwright configs, nav screenshot script | D28 evidence (screenshots under `/opt/cursor/artifacts/a001-d28-palette/`) |

## 2026-11-14 — A109 Apply entry on full-profile marketing nav (cursor/a109-apply-marketing-nav-c539)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/components/Header.tsx` | landing + default header | Primary CTA → `/apply`; remove Sign up and waitlist scroll; keep Log in → `/login` | A109: one clear apply entry separate from sign-in on full-profile public chrome |
| `src/components/Footer.tsx` | Connect column | Apply + Log in links before contact | Footer matches cohort apply/sign-in split |
| `src/components/marketing/full-home.tsx` | hero + pricing cards | Apply copy; pricing card buttons → `/apply` | Full home CTAs no longer masquerade as sign-up |
| `src/components/marketing/full-features.tsx` | highlight bar | `/login` → `/apply` with founding cohort label | Features page bottom CTA is apply not sign-in |
| `src/components/marketing/full-pricing.tsx` | plan cards | Get Started buttons → `/apply` Apply links | Pricing tier actions route to application |
| `Header.a109-full-apply-nav.test.tsx`, `Footer.a109-apply-entry.test.tsx`, `full-features-apply-cta.test.tsx` | new | Focused full-profile nav regression | A109 evidence without broad rewrites |
| `Header.test.tsx`, `full-home-cta.test.tsx`, `phase-one.test.tsx` | expectations | Updated markers for Apply wording | Keep existing marketing integration guards green |

## 2026-11-14 — A074 proposal cover photo choice (cursor/a074-proposal-cover-choice-7129)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/lib/proposal-cover-photo.ts` | (new) | Shared assets, choice parsing, resolve site vs illustrative cover | A074: labelled render + first site photo; legacy default no cover |
| `src/lib/proposal-cover-photo.test.ts` | (new) | Focused parse/resolve tests | Regression guard |
| `src/components/marketing/project-cover-render.tsx` | imports | Reuse shared lib constants/helpers | One source for marketing + proposal |
| `src/lib/proposal-review.ts` | draft, payload, save | `coverPhoto` on draft; validation when `site` without photos | Reuse draft contract; preserve null default |
| `src/lib/proposal-publication.ts` | snapshot | Optional `cover_photo`; resolve on publish | Legacy snapshots unchanged |
| `src/lib/proposal-document.ts` | `ProposalDocument.coverImage` | Map snapshot cover into web/PDF model | Preview/PDF parity |
| `src/components/proposal/proposal-document-view.tsx` | cover header | Figure with mandatory caption | Client-readable cover |
| `src/lib/pdf/proposal-brochure.ts` | `cover()` | Draw cover image + caption | PDF matches preview |
| `src/app/dashboard/projects/proposal/review-send-client.tsx` | `review-cover` | Radio choices + illustrative preview | Settings in preparation flow |
| `src/app/dashboard/projects/proposal/actions.ts` | save draft | Persist `proposal_cover_photo` | Explicit selection stored |
| `src/types/domain.ts` | `Project` | `proposal_cover_photo` optional column | Type parity with migration |
| `supabase/migrations/20261114201500_a074_proposal_cover_photo.sql` | (new) | `projects.proposal_cover_photo` text nullable | Schema for persistence (not applied this run) |
| `src/lib/deployment/review-editable.ts` | allowlist | Include `proposal_cover_photo` | QA editable path |
| `src/app/dashboard/projects/proposal/a074-cover-photo-choice.test.tsx` | (new) | UI labels and selection state | A074 focused check |
| `src/lib/proposal-publication.test.ts`, `proposal-document.test.ts`, `proposal-review.test.ts`, `actions.test.ts` | tests | Cover choice behaviour | Save/publish/document guards |

## 2026-11-14 — A074 D27 pre-migration rollout gate (cursor/a074-proposal-cover-choice-7129)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/lib/proposal-cover-photo.ts` | gate | `CONSTRUCTA_PROPOSAL_COVER_PHOTO=1` enables reads/writes/UI/publication | D27: default off until column exists |
| `src/app/dashboard/projects/proposal/actions.ts` | save | Omit `proposal_cover_photo` from update when gate off | Routine PostgREST saves stay valid pre-migration |
| `src/lib/proposal-review.ts` | draft/preview | Ignore stored choice and column when gate off | Legacy rows and previews unchanged |
| `src/lib/proposal-publication.ts` | snapshot | No `cover_photo` without gate | Publication path safe pre-migration |
| `src/app/dashboard/projects/proposal/review-send-client.tsx` | UI | `coverPhotoEnabled` prop hides cover controls | No dead UI before rollout |
| `src/app/dashboard/projects/proposal/page.tsx` | pass gate | Server passes `isProposalCoverPhotoEnabled()` | Single deploy-time switch |
| `src/lib/deployment/review-editable.ts` | allowlist | Column allowed only when gate on | Review QA matches production |
| `*.test.ts` | pre-migration cases | Default-off save, UI, publication | Focused D27 regression |

## 2026-11-14 — A097 D12 Vercel Web Analytics default-off (cursor/a097-d12-vercel-web-analytics-985d)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/lib/public-measurement.ts` | 136–145, 179 | Replace `PUBLIC_PAGEVIEW_MEASUREMENT_ENABLED = true` with `isPublicPageviewMeasurementEnabled()` reading `NEXT_PUBLIC_CONSTRUCTA_VERCEL_WEB_ANALYTICS === '1'` | Existing deploys collect no page views until explicit code opt-in; custom-event inert path unchanged |
| `src/components/public-analytics.tsx` | 7, 28 | Gate mount on `isPublicPageviewMeasurementEnabled()` | Vercel `<Analytics>` stays unmounted by default |
| `src/lib/public-measurement.test.ts` | D12 describe + filter `beforeEach` | Default-off and filter-off cases; enable env stub for route filter tests | Focused A097 regression |
| `src/components/public-analytics.test.tsx` | mount gating | Default-off null render; nested suite with `NEXT_PUBLIC_CONSTRUCTA_VERCEL_WEB_ANALYTICS=1` | Preserve prior gating checks when activated |
| `docs/marketing/public-measurement-spec.md` | scope + layers | Document build-time env activation layer | Operator truth without dashboard changes |

## 2026-11-14 — A037 D17 suggestion-only tags (cursor/a037-example-discipline-sector-tags-6591)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/lib/case-study-example-tags.ts` | explicit flags, `readStoredExampleTags`, `legacyCaseStudyForSave` | Inferred tags are UI suggestions; `disciplineTagsExplicit` / `sectorTagsExplicit` gate persistence | D17: never auto-save hints; keep deliberate empty arrays |
| `src/app/dashboard/settings/case-studies/example-tags-section.tsx` | chip states | `data-tag-state` selected vs suggested; `aria-pressed` from stored only | Labels and pressed state match saved data |
| `src/app/dashboard/settings/case-studies/case-studies-client.tsx` | save map, tag edits | Strip implicit tags on save; set explicit on chip toggle | Suggestions do not reach `profiles.case_studies` |
| `src/lib/case-study-example-tags.test.ts` | D17 `describe` | Three focused cases: suggestions-only, empty explicit, stored selection | Regression guard |
| `src/app/dashboard/settings/case-studies/a037-example-tags.test.ts` | render + save | Markup and wire tests for suggestion vs selected | Focused UI/save checks |

## 2026-11-14 — A037 example discipline and sector tags (cursor/a037-example-discipline-sector-tags-6591)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/lib/case-study-example-tags.ts` | (new) | Discipline catalogue from `SETUP_WORK_SUGGESTIONS`; sector ids from brief client types; job-type hint map; normalise/toggle/infer helpers | Evidence-based tagging per walkthrough case-study feedback — work performed vs customer sector |
| `src/lib/case-study-example-tags.test.ts` | (new) | Focused tag catalogue, hints, and inference tests | A037 regression guard |
| `src/app/dashboard/settings/case-studies/example-tags-section.tsx` | (new) | Emerald chip pickers reusing core editing palette | Match library chip styling on legacy past-work editor |
| `src/app/dashboard/settings/case-studies/case-studies-client.tsx` | CaseStudy fields, update/add, card UI | Discipline/sector chips; hint merge when tags empty | Tag each legacy example without new SQL |
| `src/app/dashboard/settings/case-studies/page.tsx` | initialCaseStudies map | `legacyCaseStudyTagsFromFields` on load | Show inferred labels for stored examples missing tags |
| `src/lib/__fixtures__/proposal.ts` | case_studies rows | Pre-labelled synthetic examples | Fixture metadata matches A037 contract |
| `src/app/dashboard/settings/case-studies/a037-example-tags.test.ts` | (new) | Source guard + save passthrough for tag arrays | Focused checks |

## 2026-11-14 — A001 dashboard / estimate / programme palette sweep (cursor/a001-dashboard-estimate-programme-sweep-9d86)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/app/dashboard/dashboard-client.tsx` | launch notice banner | Blue info chrome → emerald/charcoal tokens | Pipeline dashboard launch notice matches A001 |
| `src/app/dashboard/home/home-client.tsx` | KPI win rate, pipeline value | Purple/blue metric chrome → emerald where not stage semantic | Command centre money/success highlights on sage palette |
| `src/app/dashboard/projects/costs/advanced-estimate.tsx` | drawing takeoff callout | Purple dashed callout → emerald | Estimate AI entry chrome aligns with charcoal/green |
| `src/app/dashboard/projects/schedule/programme-ai-update.tsx` | AI panel + Generate CTA | Purple → `corePrimaryButton` / emerald accents | Programme weekly-update actions on approved tokens |
| `a001-dashboard-primary-palette.test.tsx`, `a001-home-pipeline-brand-links.test.ts` | expectations | Guard updated tokens; stage status blues preserved | Focused regression |
| `a001-programme-ai-brand.test.ts`, `a001-estimate-drawing-callout.test.ts` | new | Source assertions for programme + estimate sweep | Bounded A001 guards |

## 2026-11-14 — A001 resources hub card hover chrome (cursor/a001-resources-hub-card-hover-e757)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/app/dashboard/resources/client-page.tsx` | 82, 132 | `hover:border-blue-200` → `hover:border-emerald-200` on labour/plant list cards | Nonsemantic brand chrome on legacy Company Resources hub matches charcoal/sage palette |
| `src/app/dashboard/resources/a001-resources-primary-palette.test.ts` | new `it` | Assert emerald hover; forbid `hover:border-blue-` on hub | Focused A001 regression guard |

## 2026-11-14 — D6/D7 cohort About nav, design system, images, home CTAs (cursor/d6-d7-about-nav-images-093b)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/components/marketing/phase-one.tsx` | header nav, footer nav | Add `/about` links in cohort MarketingHeader and MarketingFooter | D6: About reachable from cohort chrome |
| `src/components/marketing/cohort-about.tsx` | (new) | Phase-one styled About page with `next/image` | D7: align About with cohort design system; preserve AI disclosure and distinct `/apply` CTA |
| `src/components/marketing/cohort-about.module.css` | (new) | Layout tokens for cohort About sections | Match phase-one spacing and colour without touching marketing route split |
| `src/components/marketing/full-about.tsx` | (new) | Full-profile About body with `next/image` instead of raw `<img>` | Same content contract under `full` launch profile |
| `src/app/about/page.tsx` | whole file | Profile switch + shared JSON-LD | Cohort vs full About without duplicating metadata |
| `src/components/marketing/full-home.tsx` | hero + Try Constructa CTAs | `href="/apply"` replaces `#` / `#contact-form` on home entry CTAs | Dead Try Constructa / Get Started → founding cohort apply |
| `src/components/marketing/phase-one.test.tsx` | nav + skip routes | Assert `/about`; include `/about` in bypass route table | Regression guard for D6 |
| `src/app/about/about-preview-status.test.tsx` | mock + assertion | `next/image` mock; hero disclosure + image count | Synthetic verification for D7 |
| `src/components/marketing/full-home-cta.test.tsx` | (new) | Home CTA href regression | Preserve `feature-scroll.js`; assert `/apply` targets |

## 2026-11-14 — D5 apply form storage honesty (cursor/d5-apply-storage-notice-3517)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/lib/founding-cohort/submission-adapter.ts` | 3–22 | `hasFoundingCohortApplicationStorageAdapter()` gate; adapter throws when unwired | Single source for “no real storage” while A109 destination is open |
| `src/components/marketing/founding-cohort-apply-storage-notice.tsx` | 1–22 | Accessible status notice + `/contact` link | Tell visitors before the form that applications are not saved |
| `src/components/marketing/founding-cohort-apply-form.tsx` | imports, submit handler, button | Disable no-op submission; `aria-describedby` notice id | Prevent false success and block server action until storage exists |
| `src/app/apply/page.tsx`, `founding-cohort-apply-page.tsx` | form panel | Replace internal TODO copy with shared notice | Cohort + full profile parity |
| `src/app/apply/actions.ts` | pre-adapter guard | Return error when storage unwired | Defence in depth if POST is forged |
| `src/components/marketing/founding-cohort-apply.module.css` | `.storageNotice*` | Visitor-facing alert styling | Readable contrast before the form |
| `src/app/apply/apply-route.test.tsx`, `actions.test.ts`, `submission-adapter.test.ts`, `founding-cohort-apply-form.test.tsx` | expectations | Synthetic coverage for notice order, disabled submit, server guard | D5 evidence without storage wiring |

## 2026-11-14 — A109 about page founding cohort apply entry (cursor/a109-about-apply-cta-e8a5)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/app/about/page.tsx` | ~164–168 | Add **Apply to the founding cohort →** link to `/apply` ahead of Preview access in What's next | Close remaining dead entry on `/about`; one clear apply destination separate from sign-in and preview-access copy |
| `src/app/about/about-preview-status.test.tsx` | ~44–50 | Assert `/apply` precedes `/pricing` in What's next CTAs | Regression guard for A109 cohort navigation on about |

## 2026-11-13 — A038 up-to-three photo normalisation regression (cursor/a038-photo-limit-regression-14ce)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/lib/case-library/photos.test.ts` | ~13–25 | One Vitest case: `photoInputWouldBeCut` true for a fourth synthetic url and `normalisePhotoSlots` keeps only the first three slots | Close A038 unit gap between silent trim detection and the three-slot normaliser; synthetic fixtures only |

## 2026-11-13 — Marketing guides and cohort apply keyboard focus (cursor/marketing-focus-visible-1e4b)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/components/public-chrome.tsx` | 23–27 | `theme` + `marketingMain` on skip target `<main>` | Visible focus when bypassing chrome to page content |
| `src/components/marketing/phase-one.module.css` | after `.skip` | `.marketingMain:focus-visible` accent outline | Reuses `--accent`; no navigation behaviour change |
| `src/components/marketing/guides.module.css` | after `.card:hover` | `.card:focus-visible` border + outline | Hub article links match hover border for keyboard users |
| `src/components/marketing/founding-cohort-apply.module.css` | after theme focus rule | Field border + submit background on `:focus-visible` | Clearer tab focus on `/apply` without changing validation or gates |
| `src/components/marketing/marketing-pages-focus.test.ts` | 1–48 | Declared CSS regression checks | Evidence without full browser matrix |
| `src/components/marketing/phase-one.test.tsx` | 179 | Add `/guides` and `/apply` to skip-link route list | Guides and apply stay on the cohort public chrome contract |

## 2026-11-13 — A001 home pipeline navigation + A023 consent-not-stored a11y (codex/r1-20261113-a001-brand-next)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/app/dashboard/home/home-client.tsx` | imports, KPI/quick actions/view links, project name hover | `corePipelineTextLinkSmThemed(true)` and emerald hovers for pipeline entry chrome | Command-centre pipeline links off brand-blue; status badges and value highlights keep semantic blues |
| `src/app/dashboard/a001-home-pipeline-brand-links.test.ts` | (new) | Source assertions for home pipeline navigation tokens | Bounded A001 guard on `/dashboard/home` |
| `src/app/login/platform-terms-accessibility.test.tsx` | consent-not-stored `it` | Checkbox stays valid with handoff link when storage fails | Distinct offline A023 gap: storage failure is not a terms-refusal invalid state |

## 2026-11-13 — M.1 marketing SEO basics (codex/r1-20261113-m1-seo)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/lib/marketing-seo.ts` | 1–150 | Marketing origin, sitemap paths, robots disallows, `marketingPageMetadata`, sitemap/robots builders | Single source for public-route SEO; review mode blocks indexing |
| `src/lib/marketing-seo.test.ts` | 1–90 | Unit tests for origin, sitemap, robots, OG metadata | Evidence without full build |
| `src/app/sitemap.ts` | 1–6 | App Router sitemap handler | Indexable marketing URLs only |
| `src/app/robots.ts` | 1–6 | App Router robots handler | Preserve private/preview disallows; fail closed in review |
| `src/app/layout.tsx` | 6–14 | `marketingRootMetadata()` + clearer default description | `metadataBase` and shared OG defaults |
| `src/app/page.tsx`, `landing`, `features`, `product`, `customers` | metadata exports | Route-specific titles, descriptions, canonical, Open Graph | Distinct marketing page SEO |
| `src/app/pricing`, `contact`, `apply`, `privacy-policy`, `terms-of-service`, `about` | metadata | Same helper; about drops legacy `next/head` meta/canonical | App Router metadata consistency |
| `src/app/guides/page.tsx`, `guides/[slug]/page.tsx` | `index: false` | Preview guides excluded from sitemap and noindex | Do not index preview-only content |
| `src/app/pricing/pricing-metadata.test.tsx`, `contact/*metadata*.test.tsx` | assertions | Partial metadata expectations + OG/canonical | Keep contact/pricing contract tests green |
| `src/app/marketing-seo-routes.test.ts` | 1–16 | Handler wiring smoke test | Confirms `sitemap.ts` / `robots.ts` export |

## 2026-11-13 — A038 legacy photo save refusal UI seam (codex/r1-20261113-a038-offline)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/app/dashboard/settings/case-studies/legacy-photo-save-outcomes.test.tsx` | (new) | Two Vitest cases: refused save surfaces `LEGACY_CASE_STUDY_PHOTOS_MESSAGE` on `data-case-studies-save-status`, Try again, no success toast; draft photos kept and `saved` baseline unchanged | Close offline A038 gap between `saveCaseStudiesAction` photo refusal and older `CaseStudiesClient` honest save UX (no SQL, storage, or wire enablement) |

## 2026-11-13 — A001 pipeline Lead icon affordance (codex/r1-20261113-a001-palette, after 51e2ac9)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/lib/core-editing-palette.ts` | after `corePipelineMicroLinkColor` | `corePipelineMutedIconButton` | Lead-column “New lead” icon hover uses emerald pair, not brand-blue |
| `src/lib/core-editing-palette.test.ts` | imports + `it.each` | Muted icon button regression | Locks emerald hover + focus ring; no blue |
| `src/app/dashboard/project-board.tsx` | New lead `Link` className | `corePipelineMutedIconButton(isDark)` | Same pipeline surface as 51e2ac9; geometry/href unchanged |
| `src/app/dashboard/a001-pipeline-brand-links.test.ts` | board `it` | Assert icon token; forbid `hover:text-blue-*` on board | Guards remaining pipeline chrome gap |

## 2026-11-13 — A001 pipeline link contrast port (codex/r1-20261113-a001-palette)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/lib/core-editing-palette.ts` | 34–46 | `corePipelineLinkColor`, `corePipelineTextLinkSmThemed`, `corePipelineMicroLinkColor` | Theme-aware emerald links (light 700/800, dark 400/300); separate micro-link colour from typography |
| `src/lib/core-editing-palette.test.ts` | imports + pipeline `it.each` | Pipeline token regression tests | Locks contrast pair from local commit `3f659a1` |
| `src/app/dashboard/project-list.tsx` | import, Proposal `Link` className | `corePipelineTextLinkSmThemed(isDark)` | List Proposal link off legacy `text-blue-600` |
| `src/app/dashboard/project-board.tsx` | Start Estimating CTA, P&L `Link` | Sage primary CTA + `corePipelineMicroLinkColor` | Brand stage action + P&L micro-link; Estimating column blues unchanged |
| `src/app/dashboard/a001-pipeline-brand-links.test.ts` | (new) | Source assertions for list/board pipeline brand | Focused A001 guard on main |

## 2026-11-12 — A023 unrecorded-consent login handoff (cursor/constructa-critical-path-20261112)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/app/login/platform-terms.test.tsx` | 6, 191–203 | Import `PLATFORM_TERMS_COMPLETION_PATH`; assert completion link on `consent-not-stored` | Login Vitest suite mirrors unrecorded-consent handoff already covered in `completion-routing.test.tsx` |
| `docs/delivery/2026-11-12/changelog.md` | delivery table | Row for this test extension | Delivery trace for Codex PR packaging |

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

## 2026-11-14 — A089 Git-check diagnosis (cursor/a089-diagnose-9e93)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `docs/delivery/2026-11-14/a089-gitcheck-diagnosis.md` | (new) | Evidence table, bounded repro results, blocker statement | Codex preflight: A089 diagnosis without new fixture repair |
| `walkthrough-action-register.json` | A089 entry | `evidence20261114` | Record 14 Nov Cursor cloud repro; status stays Partial |

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

## 2026-11-20 — CON-068 persistent Included flag (D59, Cursor composer-2.5)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `supabase/migrations/20261120040000_con068_estimate_line_included.sql` | new | `estimate_lines.included` NOT NULL DEFAULT false; conservative false default; no inferred backfill | Durable CON-068 intent without overloading rate/notes columns |
| `src/lib/simple-estimate.ts` | ~45–210, 70–78 | `included` on draft/input; £0 validation; `draftFromLine`/`isIncludedNotChargedLine` | Client rules match server; reload restores checkbox |
| `src/app/dashboard/projects/costs/simple-actions.ts` | LineSchema, insert/update | Persist `included`; reject zero rate without flag | Owner-scoped simple save path |
| `src/app/dashboard/projects/costs/estimate-client.tsx` | badges + toggles | Included (not charged) UI | Visible intent on save/edit/read |
| `scripts/verify-phase1-smoke.sql` | ~361+ | Column presence + default smoke assertions | Scoped disposable CI only |
| `*.test.ts` | focused | build/save/mapping cases | No full-suite claim |

## 2026-10-27 — A059 weekend pattern → proposal refresh (Composer a059)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/app/dashboard/projects/schedule/simple-programme-client.tsx` | ~392–395 | Call `router.refresh()` after `router.push` on **Next: Proposal** | Re-fetch the proposal page server props so `programme_working_pattern` saved in Programme is not stale in Review & Send |
| `src/app/dashboard/projects/schedule/simple-programme-workspace.test.tsx` | hoisted router mock, new test | Assert push + refresh on **Next: Proposal** | Lock the navigation seam after saved weekend working days |
| `src/app/dashboard/projects/proposal/review-send-client.test.ts` | new test | All-week pattern shows Sunday 15 Nov finish in programme section | Prove production Review & Send uses saved pattern, not default Mon–Fri |

<<<<<<< HEAD
Codex integration: conservative false default for all unknown/legacy rows, no rate-inferred intent/backfill; missing-column mapper false. Optional legacy action inputs default false. Included participates in update CAS. Disposable SQL asserts true then false readback in-transaction; no browser/commit durability claim.
=======
D78 R1: actual disposable journey reached estimating and found first-line save refused because explicit is_client_boq selection names an optional column absent from committed replay migrations. Read available estimate columns while retaining BoQ protection when present; focused missing-column regression covers new/existing estimates. No SQL/schema changes. Prior signup/brief and D38 persistence passed; full journey requires fresh CI.

## 22 November — D92/D94 combined contractor critique

Sonnet source critique plus independently reproduced pricing mismatch, top-down contractor pricing and programme metric maps, graded findings and reuse recommendations. Only must-fix is held schema draft #238. No new original-Grok closure or runtime/release claims. Existing detailed programme features explicitly reused rather than rebuilt.
>>>>>>> origin/main
