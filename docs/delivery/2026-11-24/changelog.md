## D105 Job 2 — A061 programme grid readability (PARTIAL) — 24 November 2026

**Scope:** Limited desktop grid readability only — **not** a full A061 redesign, **not** P6 parity. Broader programme desktop visual acceptance (density, chart polish, full planning UX) remains open for a later pass.

| File | Lines (approx.) | Change | Intent |
| --- | --- | --- | --- |
| `src/app/dashboard/projects/schedule/client-page.tsx` | ~1020–1095 | Two-line **10px** headers (`Calc`/`days`, `Working`/`days`); clean **Phase / Trade** header; readonly stage dates as `<time dateTime>`; no timeline wrapper `aria-label` (week cells keep `aria-label`) | Readable headers for touch/keyboard without 8px subcaptions or title-only help; no math changes |
| `src/app/dashboard/projects/schedule/planner-dates.test.tsx` | header + dateTime | Rendered header and ISO `dateTime` checks | Affected date/header coverage |
| `src/app/dashboard/projects/schedule/planner-phone-phase-list.test.tsx` | desktop date parse | Match `<time>` desktop inline dates to phone list | Phone/desktop date parity |
| `docs/delivery/2026-11-24/changelog.md` | (this file) | Receipt | Cursor change log |

**Calc column semantics (unchanged):** body cell still shows calculated working days only when `manhours > 0`; otherwise `—` with existing per-cell title.

**Remaining (honest):** Full A061 professional planning look — Gantt chrome, settings bar density, mobile/desktop breakpoint polish — not claimed in this diff.

Checks: `vitest run` on `planner-dates.test.tsx`, `planner-phone-phase-list.test.tsx`, `schedule-control-palette.test.tsx`; `npx tsc --noEmit`.