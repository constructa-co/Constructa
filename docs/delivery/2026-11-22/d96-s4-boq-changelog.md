# D96-S4 — Priced BoQ Excel export: pricing parity

Branch `codex/d96-s4-boq-parity-20261122`, base `main` `185797f`.

## What changed

The full-profile "Export to Excel" summary rows no longer re-do the contract-sum
arithmetic. They come from `computeContractSum` (the helper the proposal
publication uses) and VAT from `vatFor(project)`:

| Case | Before | Now |
| --- | --- | --- |
| PC / provisional sums | Marked up with the work (OH/risk/profit applied) | Carried at face value, own summary row |
| Blank Preliminaries placeholder | Suppressed the prelims percentage allowance | Percentage allowance applies |
| Credit (negative) lines | Dropped from direct cost; line total and rate hidden in the sheet | Reduce the totals; shown in the sheet so it reconciles with subtotals |
| Negative explicit prelims | Row hidden | Shown |
| VAT | Always 20%, unrounded | `vatFor`: 20% standard, 0% domestic reverse charge (with the reverse-charge note); rounded as publication rounds |

The export is computed over every estimate line, as publication does (the sheet
body still lists only lines with a description).

`exportBoQToExcel(estimate, project?)` takes the job's `is_vat_reverse_charge`.
`costs/page.tsx` now selects that column and passes it through
`estimate-client.tsx` and `advanced-estimate.tsx` as an optional prop. With no
project passed it behaves as standard VAT, as before.

## Reuse of held 176 (`3a8f41a`)

Its `computeContractSum` call replacing the inline math was reused. Not taken:
`markup_method` (columns, `MARKUP_METHOD_NOTE`, `markupMethod` in the
breakdown), because main has none of it, and the held file still hardcoded 20%
VAT. 176 is not merged.

## Unchanged on purpose

The sheet still lists Overhead / Risk / Profit as explicit percentage rows,
as before. No existing contract or client-export policy was found that changes
this, and no new gate was added.

## Exposure recommendation (separate decision, not implemented)

A priced BoQ with OH / risk / profit percentages and amounts is a client-facing
file that reveals margin. The proposal PDF hides these (all-in rates), so the
two surfaces disagree. Recommend the owner decide whether the Excel export
should show only the all-in contract sum, or keep the breakdown for
contractor-internal use only.

## Tests

`costs/boq-excel-export.test.ts` (new, vitest): PC/PS face value, blank
prelims, credits, standard VAT, reverse charge. **Not run** — local
tests/build/install were out of scope for this task; cases were checked by
hand only.
