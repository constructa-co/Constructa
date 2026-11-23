## D96 S5 — Proposal fee-credit presentation — 22 November 2026

| File | Lines (approx.) | Change | Intent |
| --- | --- | --- | --- |
| `src/lib/proposal-publication.ts` | `buildFeeItems` filter (~322–330) | Keep every non-zero estimate line (was: non-face-value lines needed `> 0`) | A credit line is priced by `computeContractSum`; it is now published as its own marked-up negative fee item instead of being dropped and netted into the last positive line / a "Price adjustment" |
| `src/lib/proposal-allowances.test.ts` | first `it` | Existing credit case now expects an explicit `-126.50` "Work credit" item, no "Price adjustment", items and contract sum both `7323.50` | Locks the behaviour on the actual snapshot/fee-item path; no new harness |

Boundary check (source-only, no schema change): `fee_items` is jsonb and the publication SQL checks only `contract_sum_ex_vat`; negative fee items were already emitted for negative PC/provisional lines. Payment schedule is percentage-based and billing does not read `fee_items`. Contract sum, rounding-residual rule, snapshot sum guard and `assertProposalPublicationIsClientSafe` are unchanged. Ordinary positive-only estimates produce identical output. M1 schema RPC repair (238) untouched.

Known residual: negative amounts render via `formatGbp` as `£-126.50` (existing behaviour for negative allowances); not changed here.

Checks: not run locally (disk/instruction). R1 owns review and CI.
