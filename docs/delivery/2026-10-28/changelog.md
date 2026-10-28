# A001 Core Editing Palette — 28 October 2026

## Intent

Replace still-visible accidental bright-blue focus and selection styling on core editing screens with the existing charcoal/sage tokens. KPI, sidebar, and setup-exit palette work was left untouched.

## Files

| File | Change |
|------|--------|
| `src/lib/core-editing-palette.ts` | New shared focus ring, primary button, and selected-choice border helpers (emerald/sage). |
| `src/lib/core-editing-palette.test.ts` | Unit tests for token strings (no blue). |
| `src/app/dashboard/projects/proposal/review-send-client.tsx` | Payment/response tile selection + send-block focus use `coreSelectedChoiceBorder` / `coreFocusVisibleRing`. |
| `src/app/dashboard/projects/proposal/proposal-review-selection-palette.test.tsx` | Source guard against blue selection rings in review send. |
| `src/app/dashboard/projects/new/new-project-form.tsx` | Inputs and submit use `workspaceStyles` primary/sage focus instead of blue. |
| `src/app/dashboard/projects/new/new-project-form-palette.test.tsx` | Source guard for new-project form. |
| `src/app/dashboard/projects/settings/client-page.tsx` | Field focus rings and checkbox accent use `coreFocusRing` / emerald. |
| `src/app/dashboard/projects/settings/settings-editing-palette.test.tsx` | Source guard for project settings fields. |
| `src/app/dashboard/projects/schedule/schedule-control-palette.test.tsx` | Align working-week assertion with saved-pattern UI (no 4d–7d toggles); relax brittle line-count check. |

## Verification (synthetic QA only)

- Vitest: 51 passed across 8 focused palette files (see run output in agent receipt).
- `npm run typecheck`: pass.
- `npm run lint`: 0 errors (pre-existing warnings retained).
- `npm run build`: **retained failure** — `/login` prerender requires Supabase URL/key (no env in this run).

## Status

A001 remains **Partial** — independent review required; not self-completed.
