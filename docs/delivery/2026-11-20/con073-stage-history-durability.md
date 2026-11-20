## CON073 follow-up — Pipeline stage history durability — 20 November 2026

**Status:** Source drafted, UNMERGED, UNAPPLIED. No test, build, SQL or network run by the author. Not evidence of completion; CON073 stays Partial until CI and independent review pass and Rob applies the migration.

**Gap:** `appendPipelineStageHistory` wrote to `project_pipeline_stage_events`, but no migration created it, so every confirmed move hit the schema gate and returned the "history not confirmed" warning.

| File | Change |
| --- | --- |
| `supabase/migrations/20261120032000_con073_pipeline_stage_history.sql` | New table (`project_id`, `user_id`, `from_status`, `to_status`, `created_at`), length and `from <> to` checks, FKs with cascade, indexes, RLS. SELECT/INSERT policies require `user_id = auth.uid()` and ownership of the project (`projects.user_id`). Grants: `authenticated` SELECT+INSERT only; no UPDATE/DELETE; `anon` none. |
| `scripts/verify-phase1-smoke.sql` | Scoped assertions before the final `ROLLBACK`: owner insert persists and reads back; cannot attribute a row to another user; no-op row rejected; update and delete denied; a second user sees zero rows and cannot insert for the first user's project. |
| `src/lib/pipeline-stage-history.ts` | Comment corrected only. Payload already matches the schema; no behavioural change. |
| `src/lib/pipeline-stage-history.test.ts` | Pins table name and exact insert columns; RLS rejection (42501) is `recorded:false, schemaGate:false`. |

**Preserved:** `board-actions.ts` untouched — owner filter, compare-and-set, returned-row verification, confirmed move never rolled back, history-not-confirmed warning, combined refresh warning. The migration is idempotent in shape (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`). The workflow already triggers on `supabase/migrations/**` and `scripts/verify-phase1-smoke.sql`; no workflow change.

**Intended checks (not run):** `vitest run src/lib/pipeline-stage-history.test.ts src/app/dashboard/board-actions.test.ts`; `tsc --noEmit`; `migration-replay.yml` clean replay + smoke on disposable localhost Postgres.

**Remaining limits:**
- The smoke SQL is unexecuted; the `42501` / `check_violation` exception mappings and the `smoke.history_project_id` GUC are the likeliest first-run failures.
- The audit insert is a separate statement from the status update (not atomic); a failed insert still yields the warning, by design. Moves made before the migration is applied are not backfilled.
- Cross-organisation (non-owner member) access is intentionally not granted; ownership follows `projects.user_id`, as the board action does.
- Migration must remain unmerged until Rob approves.
