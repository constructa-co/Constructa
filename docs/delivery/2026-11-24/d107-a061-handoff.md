# D107 Job 4 — A061 bounded programme chrome

**Base:** `b2ea9f7cb09f2c5d9448c726428d69d57d1bcde9`  
**Branch:** `codex/d107-a061-programme-20261124`

## Review (what was already on `main`)

| Area | Evidence |
| --- | --- |
| Hero + sage save control | `client-page.tsx` header; `schedule-control-palette.test.tsx` (Save to Proposal sage/ink) |
| Grid column headers 10px | #260 `planner-dates.test.tsx` Calc/Working two-line headers |
| Stage dates `<time dateTime>` | `planner-dates.test.tsx` + inline desktop row dates |
| Activity tones / calculations | `ACTIVITY_TONES`, `displayPlan`, `toCalendarDays` — unchanged |

## First real remaining chrome gap

Desktop **timeline week axis** still used **9px / 8px** labels under the sticky header while the phase grid moved to 10px (#260). Contractors reading WC ranges on the chart got sub-caption sizing inconsistent with the rest of the professional grid.

## Repair (bounded)

- `client-page.tsx`: week `wk.label` / `wk.date` → `text-[10px]`; week label weight matches header column style.
- `planner-dates.test.tsx`: reject legacy 8–9px week-axis classes.

**Owner / blocker for remainder:** Full A061 visual direction (TeamGantt-scale chrome, density, baseline comparison) — product design pass; no schema or financial writes.

**Worker:** no PR/merge.