# CON044 — confirmed programme save no longer reported as failed on cache-refresh error

Branch `codex/con-044-confirmed-save-refresh-warning`, base `e43a369`. Source-only; **CON044 stays partial** (the planner-draft schema is still unapplied). Not closed.

## Bug
`saveProgrammePhasesAction` (`src/app/dashboard/projects/schedule/actions.ts`) committed the programme with `writeProgrammeStorage`, tried `clearProgrammePlannerDraft` best-effort, then called `revalidatePath` three times unguarded. If `revalidatePath` threw, the action rejected, so the client treated a stored proposal programme as a failed save.

## Behaviour now
- Guards, `requireEditableProjectAccess`, dependency validation, calendar/start-date checks and the write order are unchanged: validate, access, `writeProgrammeStorage`, draft clear (best-effort), then revalidate.
- A failure in `writeProgrammeStorage` (or any earlier guard) still throws. The client does not clear its local draft or advance its published refs, so the unsaved draft is retained.
- Only a `revalidatePath` failure after the committed write is caught. It is logged and the action resolves `{ warning: PROGRAMME_REFRESH_WARNING }`. The normal path resolves `undefined`, as before.
- `PROGRAMME_REFRESH_WARNING` lives in `src/lib/programme-planner-draft.ts` (a "use server" file may only export async functions).
- `client-page.tsx`:
  - Manual save carries the warning through the write queue (`ProgrammeWriteResult`, `success: true` plus optional `warning`). It stays `saved`, shows the existing success toast, plus `toast.warning`, and appends the warning to the status line.
  - Regenerate-from-estimate shows the same warning toast after its success toast.
  - Autosave (`updatePhasesAction`) is untouched; it still returns `{ success: true }` with unguarded revalidation. Out of scope for this task.

## Tests added (`schedule/actions.test.ts`), not run
- Refresh throws after a committed write: resolves with the warning, stored phases changed.
- A real write refusal (stale working-pattern expectation) still rejects with no update and no revalidation, even with `revalidatePath` set to throw.

No tests, typecheck, lint or build were run in this session (no command execution allowed). CI is the verifier.

## Not done
No migration, durable storage, auth/signup/settings change, or shared changelog edit. `backup/` and `.con083-partial-dependency-links/` untouched.
