# Programme-driven costs and client-safe BOQ export (draft)

Date: 2026-11-27 · Author: Claude (D120 session) · Status: design-only draft PR, no implementation or merge authority. No schema, flag or code change made for any item below.

Scope: domestic and small commercial contracting. Gang floors, unique day/night supervision, hire/off-hire and client-safe BOQ export. For each: data model, screens, what is reused, what is genuinely missing compared with an earlier full build.

## What exists today (verified in `constructa-fresh-20261025` @ ece70ce)

| Area | Existing | Where |
|---|---|---|
| Programme phases | `PlannerPhase {name, calculatedDays, manualDays, manhours, startOffset, dependsOn, pct_complete, actual_*}` saved in `projects.programme_phases` JSONB. Lengths come from estimate man-hours. No gang/crew size, no shift. | `src/lib/planner-phases.ts`, `schedule/*` |
| Working calendar | `JobWorkingPattern` v1 (weekdays) / v2 (timezone, weekday intervals, `standardMinutesPerDay`, `productivityPct`). Intervals can express a night window, but there is no named shift. | `src/lib/job-working-pattern.ts` |
| Resources | `staff_resources` (simple/full-cost chargeout, job title) and `plant_resources` (simple/full buildup, categories, daily chargeout). No calendar or allocation. | resources/staff, resources/plant, migrations 20260405*, 20261001213000 |
| Hire cost capture | P&L Log Cost sheet: plant hired with `hireRateType` daily/weekly/monthly and a rate. One-off cost entries; no on-hire/off-hire dates or link to the programme. | `p-and-l/log-cost-sheet.tsx` |
| Prelims prompt | The estimate tells the contractor to check time-related prelims (scaffold hire, welfare, supervision) by hand when the programme changes. | `costs/estimate-client.tsx:1707` |
| Client BoQ export | `boq-excel-export.ts`: Ref/Description/Qty/Unit/Rate/Total per section, plus summary rows from `computeContractSum`. **It prints Overhead %, Risk %, Profit % rows**, so it is not client-safe under the "margins never shown to client" rule. | `costs/boq-excel-export.ts` |
| Client BoQ import | Proposed in unmerged draft PR #274: all-tab deterministic import with row reconciliation; not on main. Provenance (sheet/row) is in the preview only, not persisted. | `src/lib/boq-workbook.ts` |

## 1. Gang floors (minimum PAID gang per unique shift)

A gang floor is a **cost floor, not a duration rule**. It must not change phase lengths. It is counted once per unique shift-window, never per phase, so overlapping phases cannot double-count it.

Three quantities stay separate:
1. **Measured, output-led labour.** Man-hours from the measured items (`estimate_line_components.total_manhours`), costed at their own rates. Unchanged.
2. **Planned crew capacity / duration.** The current planner derives `calculatedDays` from person-effort and retains `manualDays`; `plannerCalendarDays` and v2 working-pattern intervals can be reused. Crew-resourced duration needs a separate planned-capacity model and is not delivered here. A paid gang floor never changes dates automatically.
3. **Paid minimum uplift.** For each unique shift-window *s* (calendar date × day/night window, from the shift set in section 2): `additional paid operatives(s) = max(0, minimum paid gang(s) − operatives already costed on s)`. Here "already costed on s" is the operative allocation that measured labour already pays for in that window. The uplift is priced at the correct rate for that shift (day or night) and is applied **once per window**. Supervision is separate (section 2, union once), never inside the floor.

- **Feasibility:** if the programme's labour demand in a window exceeds the planned crew capacity, show a warning against that window. **No automatic date or duration changes.**
- **Model (draft only):** job-level `gangFloors: [{ shiftKey, minimumPaidGang, rateRef }]`. `rateRef` starts with existing `staff_resources` chargeout; any further rate mapping is a design decision. Per-phase planned crew (`plannedOperatives`, by shift) is needed only for allocation and feasibility. No schema or calculation is implemented.
- **Screens (draft):** a "Minimum paid gang" card in prelims, listing the uplift per shift (window count × additional operatives × shift rate) as the sum of window-level uplifts, with each computing window shown. A feasibility marker on the planner.
- **Reuse:** man-hours from `estimate_line_components`; the planner length maths; `JobWorkingPattern` v2 intervals; `staff_resources` chargeout.
- **Missing:** a shift dimension on phases (section 2); an allocation of costed operatives to windows; the pure uplift function and its synthetic tests.
- **Earlier full-build compatibility:** not yet checked.

## 2. Unique day/night supervision

- **Model:** a named shift set on the job: `shifts: [{key:"day"|"night", intervals: JobWorkingInterval[]}]` (v3 of the working pattern, or a sibling field). Supervision as a time-related prelim line with `basis: "per_shift_day"` and `shiftKeys`. **Unique** means counted once per calendar shift-day in which any phase works that shift, not once per phase. This stops overlapping phases double-charging a supervisor.
- **Screens:** shift toggle per phase on the planner. A "Supervision" prelim card showing the derived day and night shift counts, with an override and a reason.
- **Reuse:** v2 intervals (already timezone-explicit); the prelims section of the estimate.
- **Missing:** the shift dimension on phases; deriving the union of shift-days across phases (a pure function, testable on synthetic programmes); a guard that a programme change re-prompts the prelim and never silently re-prices it (matches the current text at estimate-client:1707).

## 3. Hire / off-hire

- **Basis:** hire cost follows the **supplier's billing basis**, not an assumption that all hire is charged per calendar day. Per hire: billing unit (day / week / 4-week / month / per-hire), the supplier's billing calendar (whether weekends or bank holidays are chargeable, and part-week rules), minimum hire period, the off-hire rule (charged to the off-hire call/notice date or the collection date; any notice period), and delivery/collection charges. Cost = the supplier's billable periods between on-hire and the off-hire basis date, with the minimum hire applied. Calendar days are only the default where the supplier really bills that way.
- **Model (draft only):** a programme-linked hire record `{ plantResourceId | description, supplierBasis: { unit, chargeableDays, partPeriodRule, minimumPeriods, offHireRule, noticeDays }, onHire: phase start | date, offHire: phase finish | date, deliveryCharge, collectionCharge }`. JSONB first; a table only if Live Projects needs actual on/off events. No schema or calculation is implemented.
- **Screens (draft):** a "Plant on hire" strip under the planner (on- to off-hire bars, with the billable periods shown); a prelim cost line that names its basis; in Live, "Off-hire now" records the actual off-hire date into the P&L cost sheet.
- **Reuse:** `plant_resources` (`daily_chargeout_rate`, rate modes); P&L log-cost `hireRateType` (daily/weekly/monthly) as the starting vocabulary; planner phase dates; `JobWorkingPattern` only where the supplier bills working days.
- **Missing:** the supplier-basis fields, the off-hire rule, minimum-period handling, and in-app off-hire reminders (no email or cron in scope).
- **Earlier full-build compatibility:** not yet checked.

## 4. Client-safe BoQ export

- **Problem found:** the current export (`boq-excel-export.ts`, `boqSummaryRows`) appends Overhead/Risk/Profit percentage rows to the sheet. It is not client-safe.
- **Client copy must contain no internal data anywhere in the file:** no margins, buffers or risk/contingency allowances, supplier names or notes, rate build-ups or internal comments. This applies to visible sheets **and** to hidden or very-hidden sheets, defined names, cell comments/notes, document properties/metadata and custom XML. The export writes a fresh workbook with only client fields; it never edits a copy of an internal workbook.
- **Totals:** all-in rates (margins spread into rates, as the proposal does). Σ client line totals plus face-value PC/provisional sums must equal the **approved contract sum** to the penny, from the existing `computeContractSum` / proposal-publication figures. Any rounding residue is reconciled explicitly, never hidden. If they do not tie, the export refuses.
- **VAT:** the mode comes from the existing approved inputs only (`vatFor(project)` / `is_vat_reverse_charge`, as the export uses today). No new tax logic, and no publication or sending.
- **Round-trip (held):** writing a priced copy back into the client's own workbook layout would need the import provenance (`source_sheet`/`source_row`) persisted. That is a schema change, held for Rob.
- **Screens (draft):** export menu with "Client copy (all-in rates)" as the default and "Internal (with margins)".
- **Tests before any build:** open the produced client file and assert no internal OH/profit/risk percentage, buffer or supplier text (approved VAT percentages remain permitted) in any sheet (hidden included), name, comment or property; Σ = approved contract sum to the penny; VAT row matches `vatFor`.
- **Earlier full-build compatibility:** not yet checked.

## Held / not done

No schema, migration, flag, settings or UI change for items 1–4. Provenance persistence and the write-back export depend on a schema decision by Rob. Gang-floor uplift, shift-union supervision and hire billing should be built as pure functions with synthetic tests first. This note changes no runtime scope, schema, flag or calculation.
