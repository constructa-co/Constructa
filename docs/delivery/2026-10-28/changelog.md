# A005 Core Route Geometry - 28 October 2026

## Intent

Reduce core desktop workspace width, header, and divider imbalance on cohort
pre-construction routes without palette changes (A001), marketing edits, or
empty pipeline centre overrides.

## Files amended

| File | Change |
|------|--------|
| `src/lib/dashboard-route-geometry.ts` (new) | Shared 1600px column and px/pt/pb tokens for workflow and pipeline inset. |
| `src/lib/dashboard-route-geometry.test.ts` (new) | Synthetic QA: shell classes, four workflow pages, preserved max-w-3xl empty states. |
| `src/components/dashboard-route-shell.tsx` (new) | Route shell wrapper with `data-dashboard-route-shell` / header / body markers. |
| `src/components/dashboard-route-shell.module.css` (new) | Flex column row-gap replaces ad hoc ProjectNavBar bottom margins for divider rhythm. |
| `src/components/dashboard-route-shell.test.tsx` (new) | Static render checks for shell markers and 1600px class. |
| `src/app/dashboard/projects/brief/page.tsx` | Replace `max-w-5xl` div with `DashboardRouteShell`. |
| `src/app/dashboard/projects/costs/page.tsx` | Same shell; remove duplicated max-width/padding classes. |
| `src/app/dashboard/projects/schedule/page.tsx` | Same shell. |
| `src/app/dashboard/projects/proposal/page.tsx` | Replace `max-w-5xl` with shared shell (1600px). |
| `src/app/dashboard/dashboard-client.tsx` | Established pipeline uses `corePipelineWorkspaceInsetClassName()` instead of `pt-8 px-8`. |
| `src/components/brief-chrome.module.css` | Drop extra top margin and nested 1100px cap so brief content fills the route column. |

## Status

- A005 remains **Partial** — independent review required; not marked Complete.
- Mobile shell offset, navigation, dirty guards, and page content unchanged.
- No deploy, main merge, env, DB, or hosted QA in this slice.
