# CON044 — durable server planner draft: migration packaged with DB assertions

Source-only draft, 20 Nov 2026. **Nothing was run** (no tests, build, SQL, network). CI is the verifier. Migration stays **unmerged and unapplied** for Rob.

## Finding
The gap was packaging and evidence, not code. Already present and reused unchanged:
- Migration `supabase/migrations/20261118003000_con044_programme_planner_draft.sql` adds `projects.programme_planner_draft JSONB` (idempotent, no new RLS needed: the existing `projects` owner policies cover the column).
- `writeProgrammePlannerDraft` / `clearProgrammePlannerDraft` (`src/lib/server/programme-storage.ts`) filter every read and write by `id` and `user_id`, use compare-and-swap, and refuse when the column is absent.
- `autosaveProgrammePlannerDraftAction`, `clearProgrammePlannerDraftAction` and `saveProgrammePhasesAction` (`schedule/actions.ts`) keep auth/editable-access checks, explicit "Save to Proposal" writing `programme_phases` only, and the confirmed-write refresh warning (`PROGRAMME_REFRESH_WARNING`).
- `schedule/page.tsx` loads the project row (`select *`, `user_id` scoped) and passes `plannerDraftViewerScope={user.id}`; the browser `sessionStorage` fallback is used only when the column is unavailable.

No application code was changed.

## Added
`scripts/verify-phase1-smoke.sql` (existing step of `migration-replay.yml`, which already triggers on this path and on `supabase/migrations/**`), inserted after the authenticated brief save and before publication:
1. Owner stores a published `programme_phases` and a `programme_planner_draft` under the `authenticated` role.
2. A second user (new `auth.users` row) cannot see the project and an update of its draft affects 0 rows.
3. A new owner role context reads the draft back, with `programme_phases` unchanged (draft separate from proposal baseline).
4. Clearing the draft sets it NULL and leaves `programme_phases` intact.

No guard or RLS is weakened; the script rolls back and uses only the disposable localhost database.

## Intended checks (CI, not yet run)
- Migration replay + Phase 1 smoke: new assertions pass; existing `project_benchmarks` count of 1 is unaffected.
- Existing unit tests (`programme-planner-draft.test.ts`, `schedule/actions.test.ts`, `planner-opening.test.tsx`) cover the app paths; no new TS test was needed.

## Remaining limits
- The server-side CAS/ownership checks in TypeScript are covered by mocked unit tests only; the SQL asserts the database boundary, not the Next.js action.
- Production still lacks the column until Rob applies the migration; until then the sessionStorage fallback (per user and job) applies and drafts do not survive browser changes.
- The smoke's `projects` UPDATE policy behaviour is asserted against the real replayed schema; if a later policy blocks the owner update, CI will say so and the assertion needs adjusting, not the guard.
- CON044 is not marked complete: needs migration applied plus a live cross-browser check.
