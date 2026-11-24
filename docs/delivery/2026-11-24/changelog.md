## D105 Job 1 — A055 post-#259 — 24 November 2026

| Item | Result | Evidence |
| --- | --- | --- |
| A055 source follow-up | **SKIP** | `pricingWorkFromSavedProject`, `scope_text` on server, `activeFullScope` / `onScopeSaved` on costs — merged **PR #259** (`fcdcc2f5`). No demonstrated nongated defect on `main`. |
| Partial (standing) | Provider/readiness/hosted runtime | Not a source patch in this batch |

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

## D105 Job 4 — A020/A037 — 24 November 2026

| Item | Result | Evidence |
| --- | --- | --- |
| A037 example tags | **SKIP (Complete on main)** | `src/lib/case-study-example-tags.ts`, `example-tags-section.tsx`, `a037-example-tags.test.tsx` — explicit-chip persistence |
| A020 resources gap | **SKIP** | Portfolio hub at `src/app/dashboard/resources/portfolio/` with allocations/demand; no durable gap identified without schema/feature scope |
| A024 privacy | **No change** | `src/app/privacy-policy/page.tsx` + tests; M.3 only if owner finds gap |

Checks: docs-only branch; no app routes touched.