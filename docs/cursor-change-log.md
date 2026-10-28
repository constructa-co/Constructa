# Cursor change log

## 2026-10-28 — A069 correction: revert unsafe null→MD auto-seed (Composer Rob28Oct)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/lib/proposal-review.ts` | removed ~125–151 | Delete `companyClosingForDraft`, `draftFromReviewContext` | Codex reject: null `closing_statement` matches deliberately saved empty (`trim \|\| null`); auto-seed refills intentional clears |
| `src/app/dashboard/projects/proposal/review-send-client.tsx` | ~152–159 | Restore `draftFromProject` only for initial state | No silent prefill on open; explicit **Use company message** unchanged |
| `src/lib/company-closing.test.ts` | + `A069_MISSING_DURABLE_PROVENANCE`, reopen describe | Regression: normalized-null reopen stays empty; explicit apply path retained | **originalGap:** missingDurableProvenance — no safe auto-prefill without new durable field/policy |
| `src/app/dashboard/projects/proposal/company-closing-entry.test.tsx` | reopen test | Parent remount after null closing must not fill MD text | UI-level guard against reintroducing auto-seed |

Reverts unsafe portion of `903b52d`. A069 remains **not Complete** for automatic prefill until provenance exists.

## 2026-10-27 — A059 weekend pattern → proposal refresh (Composer a059)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/app/dashboard/projects/schedule/simple-programme-client.tsx` | ~392–395 | Call `router.refresh()` after `router.push` on **Next: Proposal** | Re-fetch the proposal page server props so `programme_working_pattern` saved in Programme is not stale in Review & Send |
| `src/app/dashboard/projects/schedule/simple-programme-workspace.test.tsx` | hoisted router mock, new test | Assert push + refresh on **Next: Proposal** | Lock the navigation seam after saved weekend working days |
| `src/app/dashboard/projects/proposal/review-send-client.test.ts` | new test | All-week pattern shows Sunday 15 Nov finish in programme section | Prove production Review & Send uses saved pattern, not default Mon–Fri |
