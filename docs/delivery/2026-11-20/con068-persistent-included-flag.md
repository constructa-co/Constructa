# CON-068 — Persistent Included flag for estimate lines (D59 source draft)

**Branch:** `codex/d59-con068-exact-main`  
**Worktree:** `.cq-wt/d57-pr-184`  
**Authorisation:** CTO D59 20 Nov 03:20 UAE — source + migration only; no production apply.

## Problem

CON-068 (snag) requires deliberate £0 simple estimate lines (“Included, not charged”) with validation from #199 plus **durable** save/reload. Prior Kimi draft inferred intent from `unit_rate = 0`, which mis-labelled legacy zero placeholders and dropped intent on readback.

## Solution

- New column `public.estimate_lines.included BOOLEAN NOT NULL DEFAULT false`.
- No inferred backfill: every unflagged legacy row defaults false.
- Simple estimating UI: “Included (not charged)” checkbox on rate/one-price drafts; saved badge when `included && unit_rate === 0`.
- Client `buildPriceLine` + server `LineSchema`: `unit_rate = 0` only when `included === true`.
- `toEstimateLine` maps DB flag; no inference from rate alone.

Contract-sum maths unchanged (`financial.ts` still ignores zero `line_total` rows).

## Files touched

| Path | Intent |
|------|--------|
| `supabase/migrations/20261120040000_con068_estimate_line_included.sql` | Column, comment, conservative false default |
| `src/lib/simple-estimate.ts` | Draft/input/`buildPriceLine`/`draftFromLine`/badge helper |
| `src/app/dashboard/projects/costs/simple-actions.ts` | Persist + validate on save/update |
| `src/app/dashboard/projects/costs/estimate-client.tsx` | Checkbox + saved Included badge |
| `src/app/dashboard/projects/costs/types.ts`, `estimate-mapping.ts`, `src/types/domain.ts` | Types |
| `scripts/verify-phase1-smoke.sql` | Disposable CI column + default assertions |
| `src/lib/simple-estimate.test.ts`, `simple-actions.test.ts`, `estimate-line-included.test.ts` | Focused behaviour |

## Intended verification (not run in this session)

1. **GitHub `migration-replay.yml`** — disposable Postgres replays all migrations; `verify-phase1-smoke.sql` asserts `included` exists and smoke line defaults false.
2. **Vitest (root packaging):**  
   `npx vitest run src/lib/simple-estimate.test.ts src/app/dashboard/projects/costs/simple-actions.test.ts src/app/dashboard/projects/costs/estimate-line-included.test.ts`
3. **Typecheck:** `npx tsc --noEmit` on candidate before draft PR.
4. **Independent review** per D59 — draft PR stays **unmerged** until Rob approves schema apply.

## Limits

- No local build/test/SQL execution in this Cursor session (D59 source-only).
- Advanced estimating / non-simple write paths rely on DB default `included = false` only; no Advanced UI toggle in this slice.
- Production Supabase not touched; migration apply remains Rob-gated.

## Evidence status

**Not complete** until disposable CI + review receipts exist on the draft PR head SHA.
Codex integration: conservative false default for all unknown/legacy rows, no rate-inferred intent/backfill; missing-column mapper false. Optional legacy action inputs default false. Included participates in update CAS. Disposable SQL asserts true then false readback in-transaction; no browser/commit durability claim.

Review repair: SQL toggles execute before proposal publication/acceptance, preserving the precontract lock. Reopen zero-rate expectation uses blank editor text. Server normalises positive-rate Included intent to false. Production rollout requires migration before code; no automatic apply.
