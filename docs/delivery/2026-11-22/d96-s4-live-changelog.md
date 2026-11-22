# D96-S4 — live budget cost parity (22 Nov 2026)

Branch `codex/d96-s4-live-budget-parity-20261122`, base `185797f`.

## Verified mismatch

The D92/D94 critique (S4, `docs/reviews/d92-d94-contractor-pricing-programme-critique-20261122.md`) said `live/page.tsx` used its own prelims rule. Confirmed against source on this base. At both budget-cost sites (per-project view and portfolio overview) the page called `computeBudgetCost` only when the estimate held a PC or provisional-sum line. Otherwise it used a local `direct + prelims` sum:

| Case | Old live budget | Canonical `computeBudgetCost` |
| --- | --- | --- |
| Zero or null `Preliminaries` row alongside real lines | prelims = 0 (any row counted as explicit) | `prelims_pct` applied (only non-zero priced rows count) |
| No line rows, legacy `total_cost` set | 0 | `total_cost` plus prelims |

Cases that already agreed: priced prelims rows, negative credit lines, and PC/PS sums (the old code switched to the helper for these).

`/dashboard/live` therefore showed a lower budget, and a higher estimated margin, than the P&L and billing pages for those two cases. The contract value at the same sites already used `computeContractSumValue`.

## Change

- `src/app/dashboard/live/page.tsx`: both sites now call `computeBudgetCost(estimate, lines)` unconditionally. The local direct, prelims and face-value branching is deleted, along with the unused `isFaceValueLineType` import.
- R1 removed the proposed new helper-only tests: they passed before the page repair and did not establish that the changed call sites use the helper. Reuse the adequate existing financial tests and original build/type checks; no new page harness or invented acceptance gate.

## Not changed

No `financial.ts` change, no markup method, no new defaults, no schema or migration, no held 176 work, and no change to `boq-excel-export.ts` (the other S4 site, outside this task).

## Verification status

Nothing was run locally by instruction: no tests, build, typecheck or install. Expected values were worked out by hand from `computeContractSum`. The page has no page-level test and no harness was added. The call sites can no longer diverge because the duplicate logic is gone, and the existing canonical helper suite remains the relevant calculation check. **R1 independent review and CI are still pending.**
