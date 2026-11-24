## D105 Job 2 — A061 programme grid readability — 24 November 2026

| File | Lines (approx.) | Change | Intent |
| --- | --- | --- | --- |
| `src/app/dashboard/projects/schedule/client-page.tsx` | ~1018–1095 | Column header labels (`Working` under Days, phase sub-caption), `title` hints on Calc/Days/Starts After, timeline `aria-label`, readonly stage dates as `<time dateTime>` with tabular numerals | Professional planning workspace: clarity on working vs calendar days and aligned headers without touching activity/status blues or new P6 parity |
| `docs/delivery/2026-11-24/changelog.md` | (new) | Receipt for D105 Job 2 | Cursor change log |

Checks: `vitest run src/app/dashboard/projects/schedule/schedule-control-palette.test.tsx` — 12 passed. No new mirror class guards.