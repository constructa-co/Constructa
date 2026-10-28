# Pipeline Won Lifecycle Guard (A115) — 28 October 2026

## Files amended

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/app/dashboard/project-board.tsx` | 106–109, 57 | Record `fromStage` before optimistic UI; **only** Completed→Active reopen uses `updateStatusAction` (status-only, preserves prior acceptance); all other Active moves keep baseline `markAsWonAction`. | Independent review correction: do not approve generic Estimating→Active semantics; narrow fix for reopen only. |
| `src/app/dashboard/project-board-feedback.test.tsx` | 85–97 | Reopen test retained; Estimating→Active test asserts **baseline** still calls Won (not new policy). | Replace unapproved generic-policy assertion with baseline preservation proof. |

## Verification (this branch)

- Branch: `composer/a115-pipeline-won-lifecycle-guard-20261028` (from `backup/welcome-first-slice-20261018`).
- Node `v24.22.1`: `npm test` on `board-actions.test.ts` + `project-board-feedback.test.tsx` — 31 passed.
- `npm run typecheck` — exit 0.
- `npm run build` with preview guard: 20-char disposable ref `abcdefghijklmnopqrst`, fake JWT keys in process env only — Supabase target check PASS.

## A115 status

**Partial** (unchanged). Returned-row acknowledgement and optimistic rollback were already present on `board-actions.ts`; this slice closes one real client routing gap. Still not done: no publication/readiness gate on stage writes, `updateTypeAction` outside slice, no hosted or real DB readback, no automatic send/Won/publication policy change.
