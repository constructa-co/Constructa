# Cursor change log

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

## 2026-10-27 — A059 weekend pattern → proposal refresh (Composer a059)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/app/dashboard/projects/schedule/simple-programme-client.tsx` | ~392–395 | Call `router.refresh()` after `router.push` on **Next: Proposal** | Re-fetch the proposal page server props so `programme_working_pattern` saved in Programme is not stale in Review & Send |
| `src/app/dashboard/projects/schedule/simple-programme-workspace.test.tsx` | hoisted router mock, new test | Assert push + refresh on **Next: Proposal** | Lock the navigation seam after saved weekend working days |
| `src/app/dashboard/projects/proposal/review-send-client.test.ts` | new test | All-week pattern shows Sunday 15 Nov finish in programme section | Prove production Review & Send uses saved pattern, not default Mon–Fri |
