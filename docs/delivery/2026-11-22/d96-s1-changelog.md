## D96 S1 — estimate totals respect domestic reverse charge — 22 November 2026

| File | Change | Intent |
| --- | --- | --- |
| `src/lib/simple-estimate.ts` | `summarisePrice`, `currentSummary` and `previewRunningTotal` take an optional `{ vatRate }` (the shape `vatFor` returns); new `vatRatePct` on `PriceSummary` | VAT on the estimate screen follows the same rule as the proposal. Omitted means standard 20%, so existing callers are unchanged |
| `src/app/dashboard/projects/costs/page.tsx` | Select `is_vat_reverse_charge` and pass it to the client | Read the existing project field; no schema change |
| `src/app/dashboard/projects/costs/estimate-client.tsx` | `vatFor(project)` feeds the summary and unsaved-edit preview; VAT row label reads `VAT (20%)` or `VAT (domestic reverse charge, 0%)` | Estimate screen no longer adds 20% when the proposal adds 0% |
| `src/lib/simple-estimate.test.ts` | VAT treatment cases | Standard 20%, reverse charge £0, base/prelims/mark-up/discount unchanged, unset treated as standard, preview carries treatment |
| `src/app/dashboard/projects/costs/running-total.test.tsx` | Rendered total for standard, null/absent and reverse charge | Wiring: the displayed VAT row and total including VAT |
| `src/app/dashboard/projects/costs/page.test.ts` | Page passes the saved flag, `null` when unset | Wiring from the project row |

Not changed: VAT rates, registration rules, schema or defaults (held 185), base price, prelims, mark-up, discount, raw value handling.

Checks: not run locally (no tests, build, install or dev server, per instruction). Validation is GitHub CI only. R1 and Grok review to follow.
