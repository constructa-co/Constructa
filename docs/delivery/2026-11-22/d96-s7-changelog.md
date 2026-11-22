## D96 S7 — Programme final-week marker wording — 22 November 2026

| File | Lines (approx.) | Change | Intent |
| --- | --- | --- | --- |
| `src/app/dashboard/projects/schedule/client-page.tsx` | ~110, 547–556, 954, 1066–1230, 1281, 1315–1343 | Renamed `criticalSet` → `finalWeekMarkerSet`; user copy from “critical path” to “finishing in the final week”; comment documents last-week heuristic (not CPM) | D92/S7: truthful UI; scheduling logic, stars, rings, drag, save unchanged |
| `src/app/dashboard/projects/schedule/schedule-control-palette.test.tsx` | new `it` | Asserts legend/footer wording and absence of “critical path” in rendered HTML + source | Locks S7 wording without new harness |

Checks: not run locally (disk). R1 owns review and CI.