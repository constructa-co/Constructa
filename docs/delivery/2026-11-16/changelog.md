## D36 template estimate bootstrap — 16 November 2026

| File | Lines (approx.) | Change | Intent |
| --- | --- | --- | --- |
| `src/app/dashboard/library/templates-actions.ts` | 4, 89–95 | Import `companyMarkupMethod` and set `markup_method` when `applyTemplateAction` creates a project's first estimate | Close PR #176 gap: template-created estimates must snap the company method like `createEstimateAction` and simple lazy-create |
| `src/app/dashboard/library/templates-actions.apply-template.test.ts` | 1–130 | Regression tests for template apply when creating vs reusing an estimate | Prove company `compound` profile flows into new estimate rows and existing estimates are untouched |

## D36 blank-project wizard markup — 16 November 2026

| File | Lines (approx.) | Change | Intent |
| --- | --- | --- | --- |
| `supabase/migrations/20261116140000_d36_phase1_project_graph_markup_method.sql` | 1–270 | Redefine `create_phase1_project_graph` to read `profiles.markup_method` and set `estimates.markup_method` on each insert in the payload | Database path for wizard/smoke initial estimates; no historical row updates |
| `src/lib/blank-project.ts` | 14–15, 124–175 | `BlankProjectEstimateSeed`, `stampCompanyMarkupOnEstimateSeeds` | App path mirrors other creation flows before RPC |
| `src/app/dashboard/projects/new/actions.ts` | 10–11, 26–33 | Call `companyMarkupMethod` and stamp seeds sent as `p_estimates` | Blank-project wizard freezes company choice at create time |
| `src/lib/d36-phase1-project-graph-markup-method.test.ts` | 1–70 | Migration ordering and static RPC contract | Explicit schema order after `d36_markup_method`; replay-safe additive source |
| `src/lib/blank-project.test.ts` | 9, 168–181 | Regression for seed stamping | Focused unit coverage without DB |
| `src/app/dashboard/projects/new/actions.test.ts` | 3–9, 36–41, 52 | Assert `companyMarkupMethod` invoked on create | Wizard action wired to company method |
| `src/lib/new-job-closing.test.ts` | 22–24, 138–158 | Allow D36 as latest RPC migration in static contract | A069 parity test still passes when function is redefined again |
| `e2e/local-phase1/first-job-entry.tsx` | 151 | Use `estimates={[]}` after graph seed type widened | Fixture still models blank job with no estimate |