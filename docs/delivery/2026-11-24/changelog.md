## D105 Job 1 — A055 post-#259 — 24 November 2026

| Item | Result | Evidence |
| --- | --- | --- |
| A055 source follow-up | **SKIP** | `pricingWorkFromSavedProject`, `scope_text` on server, `activeFullScope` / `onScopeSaved` on costs — merged **PR #259** (`fcdcc2f5`). No demonstrated nongated defect on `main`. |
| Partial (standing) | Provider/readiness/hosted runtime | Not a source patch in this batch |

## D105 Job 2 — A061 programme grid readability (PARTIAL) — 24 November 2026

**Scope:** Limited desktop grid readability only — **not** a full A061 redesign, **not** P6 parity. Broader programme desktop visual acceptance (density, chart polish, full planning UX) remains open for a later pass.

| File | Lines (approx.) | Change | Intent |
| --- | --- | --- | --- |
| `src/app/dashboard/projects/schedule/client-page.tsx` | ~1020–1095 | Two-line **10px** headers (`Calc`/`days`, `Working`/`days`); clean **Phase / Trade** header; readonly stage dates as `<time dateTime>`; no timeline wrapper `aria-label` (week cells keep `aria-label`) | Readable headers for touch/keyboard without 8px subcaptions or title-only help; no math changes |
| `src/app/dashboard/projects/schedule/planner-dates.test.tsx` | header + dateTime | Rendered header and ISO `dateTime` checks | Affected date/header coverage |
| `src/app/dashboard/projects/schedule/planner-phone-phase-list.test.tsx` | desktop date parse | Match `<time>` desktop inline dates to phone list | Phone/desktop date parity |

**Calc column semantics (unchanged):** body cell still shows calculated working days only when `manhours > 0`; otherwise `—` with existing per-cell title.

**Remaining (honest):** Full A061 professional planning look — Gantt chrome, settings bar density, mobile/desktop breakpoint polish — not claimed in this diff.

Checks: `vitest run` on `planner-dates.test.tsx`, `planner-phone-phase-list.test.tsx`, `schedule-control-palette.test.tsx`; `npx tsc --noEmit`.

## D105 Job 3 — A102/A103 marketing drafts — 24 November 2026

| File | Change | Intent |
| --- | --- | --- |
| `docs/marketing/drafts/linkedin-saved-job-data-2026-11-24.md` | New | LinkedIn copy; cites live guide URLs |
| `docs/marketing/drafts/facebook-programme-check-2026-11-24.md` | New | Facebook copy |
| `docs/marketing/drafts/medium-brief-to-proposal-2026-11-24.md` | New | Long-form draft |
| `docs/marketing/drafts/pilot-review-plan-2026-11-24.md` | New | Review plan; no publish/forms |

### Job 3 copy repair (R1 — post `e56485ba`)

| File | Change | Intent |
| --- | --- | --- |
| All `docs/marketing/drafts/*.md` | Bounded copy + URL policy | Review links on `constructa-nu.vercel.app`; www canonical labelled unverified (D89); approved attribution and draft-PDF / non-binding language only; remove unsupported margins/universal-loss/legal/send claims |
| `pilot-review-plan-2026-11-24.md` | Measurement + review steps | Unpublished: no traffic/conversion data; no hosted-flow gate; no Plausible inference from #228 |

### Job 3 completion — A103 pilot articles (post #260–#262 merge)

| File | Change | Intent |
| --- | --- | --- |
| `docs/marketing/drafts/estimate-review-pilot-article-2026-11-24.md` | New (~400w) | Practical estimate review prose from approved `estimate-review` guide only |
| `docs/marketing/drafts/programme-review-pilot-article-2026-11-24.md` | New (~400w) | Practical programme review prose from approved `programme-review` guide only |
| `docs/marketing/drafts/pilot-review-plan-2026-11-24.md` | Assets table | Lists A102 social/Medium + A103 pilot articles; measurement NOT AVAILABLE |

Branch synced with `origin/main` @ `ff855dee` (fast-forward) before article add. UNPUBLISHED handoff for Rob; no new routes, posts, or tests for copy.

## D105 Job 4 — A020 resource portfolio + A037 — 24 November 2026

| Item | Result | Evidence |
| --- | --- | --- |
| A037 example tags | **No new source gap (register Not started)** | Existing tag source + persistence guard on `main` (`case-study-example-tags.ts`, `example-tags-section.tsx`, `a037-example-tags.test.tsx`). Do not mark Complete from source/tests alone; no newly verified hosted save in this pass. |
| A024 privacy | **No change** | `src/app/privacy-policy/page.tsx` + tests; M.3 only if owner finds gap |

### A020 read-failure fix (this branch — PR 262)

| File | Change | Intent |
| --- | --- | --- |
| `src/app/dashboard/resources/portfolio/page.tsx` | Five-read error detection; native `<a href="/dashboard/resources/portfolio">` reload | Fail closed vs `?? []` zero-looking dashboard; full route reload for fresh server read |
| `src/app/dashboard/resources/portfolio/page-read-outcomes.test.tsx` | Redirect, per-table `it.each` errors, empty/data success | Route read outcomes; no mirror class guards |

**Before:** Failed reads ignored → `PortfolioClient` got empty arrays and misleading zeros.

**After:** Any read error → `role="alert"` + reload link, no DB details. Legitimate empty data unchanged.

Checks: `vitest run src/app/dashboard/resources/portfolio/page-read-outcomes.test.tsx`; `npx tsc --noEmit`.

## D107 Job 2 — marketing mobile Apply nav (public site; not A102) — 24 November 2026

| File | Lines (approx.) | Change | Intent |
| --- | --- | --- | --- |
| `src/components/marketing/marketing-mobile-menu.tsx` | ~38 | Add `/apply` link **Apply to the founding cohort** with `closeOnSelection` | Small-viewport parity with header/footer; **#227** / **#228** holds unchanged |
| `src/components/marketing/phase-one.test.tsx` | ~47, ~82–83 | Expect Apply in mobile link list; 6 menu links | Regression for mobile nav + source wiring test |
| `docs/delivery/2026-11-24/d107-batch-handoff.md` | — | Correct gated labels; A103 already Partial (D105); A061 pending separate branch | R1 PR; worker does not merge |

**A102** remains Partial (social copy in repo; publication with Rob). This diff is Job 2 public marketing repair only.

**D107 Jobs 1, 3:** SKIP on `b2ea9f7c`. **A103:** register already Partial since D105 — no duplicate index. **Job 4 A020/A037:** SKIP. **A061:** separate `codex/d107-a061-programme-20261124`.

Checks: `vitest run src/components/marketing/phase-one.test.tsx`; `npx tsc --noEmit`.

## D107 Job 4 — A061 programme week-axis readability (PARTIAL) — 24 November 2026

**Scope:** Desktop Gantt **week header** typography only — continues #260 grid-header pass; not P6 parity, not activity-tone changes, not calculations/dates/save paths.

| File | Lines (approx.) | Change | Intent |
| --- | --- | --- | --- |
| `src/app/dashboard/projects/schedule/client-page.tsx` | ~1042–1043 | Week label/date from 9px/8px → **10px** slate chrome aligned with phase column headers | Readable timeline axis on professional planner |
| `src/app/dashboard/projects/schedule/planner-dates.test.tsx` | week-axis case | Assert no legacy 8–9px week-axis classes | Bounded regression |

**Remaining A061:** Gantt bar density, settings strip polish, full desktop workspace — not this diff.

Checks: `vitest run src/app/dashboard/projects/schedule/planner-dates.test.tsx`; `npx tsc --noEmit`.
