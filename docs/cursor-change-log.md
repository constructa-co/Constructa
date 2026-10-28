# Cursor change log

## 2026-10-28 — A069 MD message → closing auto-prefill (Composer Rob28Oct)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/lib/proposal-review.ts` | ~123–151 | Add `companyClosingForDraft`, `draftFromReviewContext` | Seed Review & Send closing draft from `profiles.md_message` when `closing_statement` is unset (null/missing), mirroring scope-from-brief; legacy `""` saved blanks stay empty |
| `src/app/dashboard/projects/proposal/review-send-client.tsx` | ~151–162 | Initial review state uses `draftFromReviewContext` when editable | Automatic unsaved prefill on proposal open; locked proposals skip seeding |
| `src/lib/company-closing.test.ts` | setup + expectations | Cover auto-seed, legacy blank, explicit Use-company-message path | Lock A069 behaviour without save-on-read |
| `src/app/dashboard/projects/proposal/company-closing-entry.test.tsx` | several cases | Expect auto-prefill on null; legacy `""` and explicit button paths retained | Parent UI tests aligned with real ReviewSendClient |

**Blocker (unchanged):** intentional saved blank stored as `closing_statement = null` (current save policy) cannot be distinguished from never-set; revisiting Review & Send may re-seed from `md_message` until a provenance field exists. No schema/SQL added.

## 2026-10-27 — A059 weekend pattern → proposal refresh (Composer a059)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/app/dashboard/projects/schedule/simple-programme-client.tsx` | ~392–395 | Call `router.refresh()` after `router.push` on **Next: Proposal** | Re-fetch the proposal page server props so `programme_working_pattern` saved in Programme is not stale in Review & Send |
| `src/app/dashboard/projects/schedule/simple-programme-workspace.test.tsx` | hoisted router mock, new test | Assert push + refresh on **Next: Proposal** | Lock the navigation seam after saved weekend working days |
| `src/app/dashboard/projects/proposal/review-send-client.test.ts` | new test | All-week pattern shows Sunday 15 Nov finish in programme section | Prove production Review & Send uses saved pattern, not default Mon–Fri |
