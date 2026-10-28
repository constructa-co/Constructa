# Running Total Draft Preview - 28 October 2026

## A054 partial — saved vs unconfirmed line-draft preview

| File | Lines (approx.) | Change | Intent |
| --- | --- | --- | --- |
| `src/lib/simple-estimate.ts` | ~371–420 | `previewSummaryWithOpenLineDrafts` applies open add/edit/delete drafts via `buildPriceLine` + `summarisePrice` only. | Label a would-be total while editing without mutating saved lines or proposal-facing sums. |
| `src/app/dashboard/projects/costs/estimate-client.tsx` | ~140–141, ~805–815, ~1390–1405 | Saved total copy; dock + running-total card show `data-in-view-draft-contract-sum` when preview is valid. | Clear saved-vs-unconfirmed figures during mounted edits; no optimistic inflation of `data-contract-sum`. |
| `src/app/dashboard/projects/costs/running-total.test.tsx` | ~32–85 | Mounted add/edit/invalid-draft cases for saved vs draft selectors. | Focused proof while editing, not CSS fold work. |
| `src/lib/simple-estimate.test.ts` | ~205–235 | Unit coverage for preview helper guards. | Lock canonical draft seam behaviour. |

## Earlier — folded summary (1c1b1e8)

## A054 partial — assistive acceptance for folded dock

| File | Lines (approx.) | Change | Intent |
| --- | --- | --- | --- |
| `src/app/dashboard/projects/costs/estimate-client.tsx` | ~799–806 | Mirror `formatGBP(summary.contractSum)` on the native `<summary>` via existing `data-in-view-contract-sum`. | When the in-view dock is folded, the total stays visible and discoverable without reopening the panel or changing financial policy. |
| `src/components/estimating.module.css` | ~54–59 | Flex summary layout; hide summary amount while `<details open>`. | Avoid duplicate totals when expanded; show the summary amount only in the folded state. |
| `src/app/dashboard/projects/costs/running-total.test.tsx` | ~43–55 | Assert summary carries the contract sum and matches the expanded panel figure. | Lock the folded-summary behaviour without duplicating existing fold e2e coverage. |
