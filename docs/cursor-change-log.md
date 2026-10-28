# Cursor change log

## 2026-10-28 — A041 explicit job-type relevance (Rob28Oct, Composer 2.5)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/lib/job-type-datalist.ts` | new | `buildJobTypeDatalistOptions`, `priorProjectTypesFromRows`, gap constant | Order datalist from saved `project_type` history and substring matches in `business_type` / `specialisms` / `preferred_trades` only — no `getProjectTypes` taxonomy |
| `src/lib/job-type-datalist.test.ts` | new | Unit + source-range scans for create/settings/proposal/case-studies | Lock A041 surfaces and document unauthorised mapping gap |
| `src/app/dashboard/projects/new/page.tsx` | ~13–35 | Load profile + prior types; pass datalist options | Create form suggestions from explicit saved context |
| `src/app/dashboard/projects/new/new-project-form.tsx` | ~26–32, ~300–304 | Optional `jobTypeDatalistOptions` prop | Keep tests on static eight when prop omitted |
| `src/app/dashboard/projects/settings/page.tsx` | ~27–48 | Same explicit context fetch | Settings job type matches create |
| `src/app/dashboard/projects/settings/client-page.tsx` | ~61–67, ~234–236 | Optional `jobTypeDatalistOptions` | Render server-built datalist |
| `src/app/dashboard/settings/case-studies/case-studies-client.tsx` | ~309–315 | Shared eight-example datalist on project type | Align company settings with create/settings |

## 2026-10-27 — A059 weekend pattern → proposal refresh (Composer a059)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/app/dashboard/projects/schedule/simple-programme-client.tsx` | ~392–395 | Call `router.refresh()` after `router.push` on **Next: Proposal** | Re-fetch the proposal page server props so `programme_working_pattern` saved in Programme is not stale in Review & Send |
| `src/app/dashboard/projects/schedule/simple-programme-workspace.test.tsx` | hoisted router mock, new test | Assert push + refresh on **Next: Proposal** | Lock the navigation seam after saved weekend working days |
| `src/app/dashboard/projects/proposal/review-send-client.test.ts` | new test | All-week pattern shows Sunday 15 Nov finish in programme section | Prove production Review & Send uses saved pattern, not default Mon–Fri |
