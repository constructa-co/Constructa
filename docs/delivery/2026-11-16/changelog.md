## D46 CON-028 / CON-029 / CON-030 — Programme regenerate, dependencies, drag — 16 November 2026

| File | Lines (approx.) | Change | Intent |
| --- | --- | --- | --- |
| `src/lib/planner-phases.ts` | 129–175 | `estimateSuggestedPhases` rolls up every estimate section with work, including zero-hour lines and explicit zero-quantity review stages | CON-028: regenerate from estimate yields meaningful stage names and lengths |
| `src/app/dashboard/projects/schedule/actions.ts` | 19–20, 106–109, 165–188, 212–214 | Delegate zero-hour regeneration to planner helper; reject circular `dependsOn` on autosave and regenerate writes | CON-028 consistency; CON-029 server guard |
| `src/lib/programme-phase-dependencies.ts` | 1–95 | Shared cycle detection and post-move dependency reconciliation | CON-029 / CON-030 core logic |
| `src/app/dashboard/projects/schedule/client-page.tsx` | 21–26, 495–512, 528–535 | Refuse circular links in UI; reconcile finish-to-start timing after bar moves | CON-029 UX; CON-030 drag consistency |
| `src/lib/programme-phase-dependencies.test.ts` | 1–45 | Focused unit tests for cycles and drag reconciliation | Regression for CON-029 / CON-030 |
| `src/lib/planner-phases-estimate-sections.test.ts` | 1–35 | Regenerate rollup tests for labour and placeholder sections | CON-028 regression |
| `src/app/dashboard/projects/schedule/actions.test.ts` | 249–257 | Autosave/regenerate refuse cyclic dependencies | CON-029 integration |