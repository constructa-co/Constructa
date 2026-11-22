## D96 S6 — Programme and preliminaries hint — 22 November 2026

| File | Change | Intent |
| --- | --- | --- |
| `src/app/dashboard/projects/costs/estimate-mapping.ts` | New `savedProgrammeDuration()`: reads the saved programme with `readProgrammeInclusion`, `programmeCalendarForProject`, `computeProgrammePlan` / `computeRelativeProgramme` and `planCoversEveryPhase`, and returns the plan's own `duration_label`, or `null` | Reuse the Programme tab's calendar maths (job working pattern, bank holidays, overlapping stages counted once, no assumed 5-day week). Never invents a length |
| `src/app/dashboard/projects/costs/page.tsx` | Selects `start_date, programme_phases, programme_working_pattern, region`; passes `programme_duration` in the existing `project` prop | Read-only; no new field, schema, default or gate |
| `src/app/dashboard/projects/costs/estimate-client.tsx` | Optional `programme_duration` on `ProjectContext`; `TotalCard` shows one paragraph (`data-programme-prelims-hint`) once an estimate exists | Says a changed programme does not reprice preliminaries or any price, and names the length when one is reliable. Totals and S1 VAT logic untouched |
| `src/app/dashboard/projects/costs/page.test.ts` | Fixture rows and two `it` blocks | Overlap counted once (12 working days, not 15); `null` for no programme, undated phase, a stage that cannot be counted, programme left out of the proposal, malformed working pattern |
| `src/app/dashboard/projects/costs/running-total.test.tsx` | New `describe` | Wording with and without a length; no invented length; contract sum and reverse-charge VAT unchanged |

Behaviour notes:
- A programme deliberately left out of the proposal (`programmeIntent: "omit"`) gets no length, only the manual-review wording. That is a judgement call; it is one line to change in `savedProgrammeDuration` if R1 prefers to show retained stages.
- Nothing reprices. No estimate, adjustment, preliminaries line or percentage is read, written or defaulted by this change.
- Draft 222 field, schema, SQL, env and settings: not touched.

Checks: not run locally (no tests, build, install or dev server per brief; disk was 14 GiB free at start). Test expectations were derived by hand from `programme-plan.test.ts` fixtures, not by running them. R1 owns review and CI.

R1 kept the calendar helper separate from estimate-mapping so shared price-row mapping does not acquire programme/calendar imports. It is used only by the server page; clients receive a plain duration string.
