## CON073 — Pipeline stage history save warning — 19 November 2026

**Status:** Partial — source warns when history recording cannot be confirmed; history durability remains a separate follow-up.

**Outcome:** After a confirmed pipeline stage move, the server returns a non-blocking warning when recording the move in pipeline history could not be confirmed. The confirmed stage write is not rolled back and is not reported as unsaved.

| File | Lines (approx.) | Change | Intent |
| --- | --- | --- | --- |
| `src/lib/pipeline-feedback.ts` | new constant | `PIPELINE_HISTORY_UNRECORDED` user-facing copy | Shared warning text; no schema or DB detail |
| `src/app/dashboard/board-actions.ts` | `confirmedStageWrite` history + revalidate | Propagate `appendPipelineStageHistory` `recorded: false` and append catch as warning; combine with refresh warning | Stop silent success when history is missing |
| `src/app/dashboard/board-actions.test.ts` | history / combined cases | Default mock `recorded: true`; tests for unrecorded, throw, combined refresh | Focused regression on warning propagation |

**Preserved:** Owner filter, prior-status compare-and-set, returned-row verification, fail-closed before writes, invalid-status guard, `project-board` warning display (no UI change), history read/write implementation in `pipeline-stage-history.ts`.

**Out of scope this slice:** SQL/migrations, new tables, local test/build execution by Cursor (Codex owns CI).

**Suggested Codex check:** `vitest run src/app/dashboard/board-actions.test.ts`