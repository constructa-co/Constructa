# Running Total Folded Summary - 28 October 2026

## A054 partial — assistive acceptance for folded dock

| File | Lines (approx.) | Change | Intent |
| --- | --- | --- | --- |
| `src/app/dashboard/projects/costs/estimate-client.tsx` | ~799–806 | Mirror `formatGBP(summary.contractSum)` on the native `<summary>` via existing `data-in-view-contract-sum`. | When the in-view dock is folded, the total stays visible and discoverable without reopening the panel or changing financial policy. |
| `src/components/estimating.module.css` | ~54–59 | Flex summary layout; hide summary amount while `<details open>`. | Avoid duplicate totals when expanded; show the summary amount only in the folded state. |
| `src/app/dashboard/projects/costs/running-total.test.tsx` | ~43–55 | Assert summary carries the contract sum and matches the expanded panel figure. | Lock the folded-summary behaviour without duplicating existing fold e2e coverage. |
