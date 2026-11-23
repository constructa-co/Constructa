# D96-S2 legacy NULL mark-up parity

**Branch:** `codex/d96-s2-null-markups-20261122` (base `185797f`)  
**Origin:** merged critique #239 (D92/D94), non-schema pricing logic repair S2.

## Problem

`toEstimate()` in `src/app/dashboard/projects/costs/estimate-mapping.ts` mapped a stored NULL `overhead_pct` / `profit_pct` to 10 / 15. Proposal, billing, home and live read raw rows, where NULL becomes 0 through `toNumber`. For a legacy row with a £10,000 line and NULL mark-ups, the estimate screen showed £12,650 and the proposal £10,000.

## Change

- `toEstimate()` now maps NULL or missing `overhead_pct` and `profit_pct` to 0, matching the raw canonical readers. Only these two defaults changed; `risk_pct`, `prelims_pct` and `discount_pct` already defaulted to 0.
- Stored values, including an explicit 0 and explicit non-zero values such as 10 / 15, pass through unchanged.
- New regression file `src/app/dashboard/projects/costs/estimate-mapping.test.ts` runs the same row through `toEstimate()` and through the raw row with `computeContractSum`, and asserts the two sums agree for NULL, missing, zero, stored non-zero, one-sided NULL and numeric-string mark-ups.

## Callers checked

`toEstimate` is used by `costs/page.tsx` (estimate screen), `costs/simple-actions.ts` (refresh after first saved line), and `lib/server/pricing-request.ts` (assistant revision). The existing tests that import it (`pricing-request.test.ts`, `job-assistant-request.test.ts`, `costs/page.test.ts`) compute expectations through the same mapper or assert only IDs, so none pinned the old 10 / 15 default. Their fixtures that omit mark-ups now produce a different revision hash than before; both sides of each comparison use the same mapper, so they stay consistent.

## Out of scope (unchanged)

- New-estimate defaults: `costs/actions.ts` still creates new estimates with explicit 10 / 15 (S3, held separately).
- No schema change, backfill, SQL, env or settings change; no rate, VAT or UI wording change.
- Held #176 untouched.

## Verification status

Not run in this session: no local test, build, install or dev server, per instruction. `tsc` and vitest results are pending original CI and R1 review.
