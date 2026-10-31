# CQ-2210 A001 palette — resources hub primary actions

Date: 2026-10-31
Branch: `cq/cq-2210-a001-palette` (base `24b9dcd`, accepted)
Scope: A001 full approved charcoal/green application palette — remaining real primary-action/focus corrections on current application routes. Prior accepted slices (Kimi dashboard/first-project at c600581 lineage, Cursor shared manual-use/postcode-find at 7900d5e) were not re-reviewed or re-touched.

## Inspected seams (accepted paths, unchanged)

- `src/app/dashboard/dashboard-client.tsx`, `src/components/first-project-start.tsx` — already sage primary CTAs (a001-dashboard-primary-palette.test.tsx).
- `src/components/manual-address-entry.tsx`, `src/components/postcode-address-picker.tsx` — already on core palette (Cursor 7900d5e slice).
- `src/components/project-navbar.tsx`, `src/app/dashboard/projects/error.tsx`, drawings add-actions, archive restore — already on core palette (a001-workflow-brand-controls.test.tsx).
- Settings controls (case-studies, api-keys, integrations, profile, new-project form) — already on core palette (a001-four-settings-brand-actions / profile-form-brand-actions / new-project-form-palette).
- `src/app/dashboard/projects/costs/*` and `src/app/dashboard/projects/schedule/client-page.tsx` — `bg-blue-600` literals there are already overridden to brand sage by `estimating.module.css` and `programme.module.css` scoped rules; no source change needed.
- Semantic blues confirmed as intentional and left untouched everywhere: status chips/badges (Sent/Responded/Issued), informational banners, Gantt/phase chart colours, money figures, selected-card states, PDF link buttons, decorative step chips, launch-notice banner.

## Still-wrong primary contexts found and corrected (9 controls, 3 files)

All were real primary actions (`bg-blue-600`/`hover:bg-blue-[57]00` + `text-white`), with no CSS-module override, on current authenticated routes. Each now uses `corePrimaryButton` + `hover:bg-[#e0f9e3]` + `coreFocusVisibleRing` from `src/lib/core-editing-palette.ts` (the established A001 token set). Geometry (padding, radius, font, flex, transitions), copy, handlers, `type="submit"`, and disabled/destructive semantics retained exactly.

1. `src/app/dashboard/resources/staff/staff-client.tsx`
   - Staff form dialog submit (`Add Staff Member` / `Save Changes` / `Saving…`) — kept `type="submit"`, `disabled={isPending}`.
   - Toolbar `+ Add Staff Member` and empty-state `+ Add Staff Member`.
2. `src/app/dashboard/resources/plant/plant-client.tsx`
   - Plant form dialog submit (`Add Plant Item` / `Save Changes`) — kept `disabled={isPending || !form.name.trim()}`, `disabled:opacity-50 disabled:pointer-events-none`, spinner.
   - Toolbar `Add Plant Item` and empty-state `Add First Asset`.
3. `src/app/dashboard/resources/portfolio/portfolio-client.tsx`
   - Allocation modal `Add Allocation` (`flex-1` pair with Cancel).
   - Actions-row `Add Allocation` and absence form `Save`.
   - Page is dark-slate themed; the sage-on-ink primary token is theme-safe (same token pair already rendered in dark fixtures for the dashboard slice).

## New checks (existing source-based test pattern)

`src/app/dashboard/resources/a001-resources-primary-palette.test.ts` — 6 tests:

1. Parametrized per-file check: imports `core-editing-palette`, exactly 3 corrected primary buttons per file using the brand template, zero `bg-blue-600` / `hover:bg-blue-[57]00` remnants.
2. staff: submit type/disabled/copy retained; Cancel stays `variant="outline"`; delete action untouched; status badge + chargeout blues retained; field `focus:border-blue-500` documented as a separate seam.
3. plant: submit disabled rules + spinner retained; add copies retained; money + selected-card blues retained; input `focus:ring-blue-600` documented as a separate seam.
4. portfolio: allocation/save copies retained; info banner + legend swatch blues retained; secondary actions unchanged.

Verification run (no Next build, no new compiled output):

- `npx vitest run src/app/dashboard/resources/a001-resources-primary-palette.test.ts` — 6/6 PASS.
- Existing A001 suites re-run (dashboard, workflow, commercial, four-settings, guided-library, profile, new-project) — 29/29 PASS, no accepted test weakened.
- `npx eslint` on the 4 changed files — 0 errors; 31 pre-existing warnings, none on changed lines (plant 233–306 unused-vars block, staff 447 setState-in-effect).
- `npx tsc --noEmit` — 0 errors.

## Scope still open (not defects, not done here)

- **Whole-app A001 remains Partial.** Other authenticated areas still carry brand-blue primary actions outside this slice, e.g. accounting (`accounting-client.tsx` save/primary buttons), contract-admin (`contract-admin-client.tsx`), CIS (`cis-client.tsx`), P&L log cost sheet (`log-cost-sheet.tsx`), drawing viewer action buttons, `project-live-client.tsx`, supervisor portal, plus standalone surfaces (`offline/page.tsx`, `install-banner.tsx`, `project-picker.tsx` empty-state CTA, `postcode-lookup.tsx` legacy Find, `data/library-table.tsx` default button). Each needs its own seam-grade pass; not a global recolor.
- **Ordinary field focus blues** in staff (`focus:border-blue-500`) and plant (`focus:ring-blue-600`) inputs remain blue — separate focus seam from primary actions.
- **Portfolio checkbox accent** (`text-blue-600`) and rate-mode selected cards are semantic/selection states, left as-is.
- **Marketing site is a separate repo/scope** — no app-only claim of global palette completion.
- Served visual/dark-light/native verification not run here (source-class + test level only, per task constraints: no Next build, no browser).

## Notes

- Changes left uncommitted for the runner.
- No env/credentials/live services/signup/SQL/settings touched. Temp output: none outside the worktree.
- Grok to check the entire new diff independently; no reviewer is a source co-author.
