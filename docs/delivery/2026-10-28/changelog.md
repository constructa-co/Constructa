# Delivery changelog — 28 October 2026

## A075 — PDF page structure and spacing (partial)

**Branch:** `cursor/pdf-page-structure-spacing-fdf4` (from `backup/welcome-first-slice-20261018`)

**Intent:** Address remaining A075 gaps called out in walkthrough feedback: largely empty receipt/response page and weak scope/price/programme composition on short proposals, without changing terms, money, wording, response modes, or the jsPDF engine.

### Files amended

| File | Lines (approx.) | Change | Intent |
| --- | --- | --- | --- |
| `src/lib/pdf/proposal-brochure.ts` | ~890–975, ~905–925 | Section breaks use opening-fit only; compact proposals start body sections after a dedicated cover page; response block centred on receipt-only pages and given balanced leading space when sharing a page | Reduce empty receipt pages and group scope/price/programme on one page for minimal fixtures |
| `src/lib/pdf/proposal-brochure.test.ts` | ~240–270 | New `compact page composition (A075)` tests | Lock layout against `minimalInput()` offline fixture |

### Source gap (no token patch)

- Robert’s inspected four-page `Integrated_preview_job_Proposal_Draft.pdf` is not in-repo; reproduction uses `src/lib/__fixtures__/proposal.ts` `minimalInput()` plus existing `renderProposalBrochure` layout log (same pipeline as `docs/evidence/stage2-tranche-2d` PDF tests).
- Draft receipt wording (A076) already correct via `responseWording`; no `proposal_token` change.

### Verification (this run)

- Node `v24.22.1`, `npm run typecheck` exit 0, `npm run lint` exit 0 (0 errors), focused PDF vitest 52/52 pass, `node --test scripts/secret-scan.test.mjs` 15/15 pass.
- `npm run build` exit 0 with nonprod guard only: `CONSTRUCTA_NONPROD_SUPABASE_PROJECT_REF=umqtzfsnyoofmgfbnrgv` and fake JWT-shaped `NEXT_PUBLIC_*` / service keys (no real credentials).
