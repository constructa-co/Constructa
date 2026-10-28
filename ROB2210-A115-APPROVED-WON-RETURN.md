# ROB2210 — A115 approved Won policy (2026-10-28)

| Field | Value |
|-------|--------|
| Branch | `codex/a115-approved-won-20261028-2210` |
| Base | `6a192967570df57df5efd2636d003d5723676687` |
| Policy | Active = operational only; **Mark as Won** alone runs `markAsWonAction`; stage picker / reopen use `updateStatusAction` without acceptance rewrite; client portal unchanged (non-binding acknowledge only). |

## Paths

- `src/app/dashboard/project-board.tsx` — `move(..., intent)`; `recordWin` only on Trophy **Mark as Won** button.
- `src/app/dashboard/project-board-feedback.test.tsx` — replaced baseline Active test; added Proposal Sent→Active picker test.

`board-actions.ts` unchanged (explicit Won payload + returned-row ack retained).

## Runtime RED / GREEN

| Phase | UTC | Scope | Result |
|-------|-----|-------|--------|
| Prefeature RED | 2026-10-28T18:13:49Z | `vitest -t A115` (2 tests, base + new tests, pre-code) | **2 FAIL** — `markAsWonAction` used for picker Active |
| Post-fix GREEN | 2026-10-28T18:13:57Z | same `-t A115` | **2 PASS** |
| Retained | 2026-10-28T18:13:59Z | full `project-board-feedback.test.tsx` | **14/14 PASS** |
| Retained | 2026-10-28T18:13:58Z | `board-actions.test.ts` | **26/26 PASS** |

## Tooling

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | exit 0 |
| ESLint (2 changed paths) | exit 0 |
| ROOT Node 24 guarded build | **NOT_RUN** (cloud Node v22.23.4) |

## Partial / not in slice

- Global A115 / pipeline publication-readiness beyond this UI routing.
- Guided-library branch (`eb764cd`) and other codex lines preserved separately.
- No DB, SQL, provider, or live mutation exercised (vitest mocks only).
