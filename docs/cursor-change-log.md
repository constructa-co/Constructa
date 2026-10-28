# Cursor change log

## 2026-10-28 — A069 new-job closing seed blocked at create RPC (Composer codex/a069)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/lib/a069-new-job-closing-seed.ts` | new | Blocker id, RPC persisted-key contract, `approvedClosingSeedFromProfile`, recommendation | Document exact gap: `create_phase1_project_graph` INSERT omits `closing_statement`; approved text is existing `md_message` only |
| `src/lib/a069-new-job-closing-seed.test.ts` | new | Contract + legacy-null guard tests | No auto-seed on proposal open; no implementation until bounded RPC slot exists |
| `src/app/dashboard/projects/new/actions.test.ts` | +1 test | Create handler never sends `closing_statement` today | Real-create-handler proof at 335a56a pin |

**originalGap / blocker:** `A069_BLOCKER_PHASE1_CREATE_RPC_NO_CLOSING_STATEMENT_SLOT` — not Complete; no SQL/post-create write added.

## 2026-10-27 — A059 weekend pattern → proposal refresh (Composer a059)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/app/dashboard/projects/schedule/simple-programme-client.tsx` | ~392–395 | Call `router.refresh()` after `router.push` on **Next: Proposal** | Re-fetch the proposal page server props so `programme_working_pattern` saved in Programme is not stale in Review & Send |
| `src/app/dashboard/projects/schedule/simple-programme-workspace.test.tsx` | hoisted router mock, new test | Assert push + refresh on **Next: Proposal** | Lock the navigation seam after saved weekend working days |
| `src/app/dashboard/projects/proposal/review-send-client.test.ts` | new test | All-week pattern shows Sunday 15 Nov finish in programme section | Prove production Review & Send uses saved pattern, not default Mon–Fri |
