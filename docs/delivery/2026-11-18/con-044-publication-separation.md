# CON-044 — Separate planner draft from proposal programme

## Schema dependency (not applied in this session)

- **Column:** `projects.programme_planner_draft` JSONB nullable
- **Migration file:** `supabase/migrations/20261118003000_con044_programme_planner_draft.sql`
- **Until applied:** autosave falls back to `sessionStorage` per job; proposal continues to read `programme_phases` only.

## Behaviour

| Path | Writes | Proposal revalidation |
|------|--------|---------------------|
| Autosave (planning edits) | `programme_planner_draft` or browser draft | No |
| Autosave (tracking-only) | `programme_phases` via existing action; clears draft when planning matches published | Yes (unchanged) |
| Autosave (tracking while planning draft pending) | `programme_phases` gets tracking merge; draft gets planning-only strip | Proposal unchanged until Save |
| Reopen with server draft | Draft planning + published tracking overlay (identity match, not index) | No |
| Save to proposal | `programme_phases`; clears draft | Yes |

## Changelog (18 Nov 2026)

| File | Lines (approx.) | Change | Intent |
| --- | --- | --- | --- |
| `supabase/migrations/20261118003000_con044_programme_planner_draft.sql` | all | Add optional `programme_planner_draft` column | Server-backed draft store when migration is applied |
| `src/lib/programme-planner-draft.ts` | all | Draft parse/helpers + sessionStorage fallback | Separate planning snapshot from proposal baseline |
| `src/lib/programme-planner-draft.test.ts` | all | Parser + tracking-only detection | Regression |
| `src/lib/server/programme-storage.ts` | 85–145 | `writeProgrammePlannerDraft`, `clearProgrammePlannerDraft` | Draft CAS writes without touching `programme_phases` |
| `src/app/dashboard/projects/schedule/actions.ts` | 131–175, 207–216 | `autosaveProgrammePlannerDraftAction`; clear draft on proposal save | Distinct server paths |
| `src/app/dashboard/projects/schedule/client-page.tsx` | 5–40, 195–290, 700–730 | Dual persist queue, open from draft, copy | CON-044 separation in UI |
| `src/app/dashboard/projects/schedule/planner-opening.test.tsx` | mocks + expectations | Draft vs proposal write mocks | Align with new paths |
| `src/lib/plain-deep-equal.ts` | all | Browser-safe deep equality | Keep client bundle off `node:util` |
| `src/lib/programme-planner-draft.ts` | compare + sessionStorage | `plainDeepEqual`; scoped keys; write boolean | Server/client boundary + tab isolation |
| `src/app/dashboard/projects/schedule/client-page.tsx` | draft scope + fallback | `user_id` scope; surface local write failure | CON-044 browser fallback hardening |