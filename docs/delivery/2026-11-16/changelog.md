## CON-073 — Board stage move confirmation (S45) — 18 November 2026

Checks: focused Vitest on board feedback, board-actions, stage history, A115 source guard (no full build in this session).

| File | Change | Intent |
| --- | --- | --- |
| `src/app/dashboard/project-board.tsx` | Confirm gate before moves; operational copy | Stop accidental Proposal Sent one-clicks |
| `src/app/dashboard/pipeline-stage-move-dialog.tsx`, `src/lib/pipeline-stage-move-copy.ts` | Dialog UI + strings | Clear from/to + cancel |
| `src/lib/pipeline-stage-history.ts`, `src/app/dashboard/board-actions.ts` | Post-write append | History via `project_pipeline_stage_events` when present (schema gate if absent) |

## D51 snags 027 / 038 / 039 / 059 — Proposal site photos, director's message, programme labels, terms gap — 16 November 2026

| File | Lines (approx.) | Change | Intent |
| --- | --- | --- | --- |
| `src/lib/proposal-site-photos.ts` | new | `sitePhotoOrigin`, `sitePhotosForJob` | Site photographs filtered to this job only |
| `src/lib/proposal-publication.ts` | snapshot build | `sitePhotosForJob`, case-study primary photo ordering | D51/D63 publication behaviour on main |

## D49 CON-017 / CON-034 / CON-035 — Brief figures, postcode lookup, UK dates — 16 November 2026

Merged from main at `53167bc` (see integration note `docs/delivery/2026-11-20/approved-176-integration.md`).

---

## D46 CON-028 / CON-029 / CON-030 — Programme regenerate, dependencies, drag — 16 November 2026

### Block #180 follow-up (Grok)

| File | Lines (approx.) | Change | Intent |
| --- | --- | --- | --- |
| `src/lib/planner-phases.ts` | 111–182 | `estimateSectionsFromWork` + `sequenceSuggestedPhases` calendar fallback | CON-028 shared named placeholders when dated placement fails |
| `src/app/dashboard/projects/schedule/actions.ts` | 108–112, 169–175, 196–198 | Action uses section rollup fallback; `validateProgrammeDependencies` on save | CON-028 action regression path; CON-029 no silent self-loop drop |
| `src/lib/programme-phase-dependencies.ts` | 40–50, 89–118 | `programmeDependsOnHasSelfReference` + transitive reconcile | CON-029 explicit rejection; CON-030 A→B→C cascade |
| `src/app/dashboard/projects/schedule/estimate-phases-regeneration.test.ts` | 90–102 | Spy proves fallback when dated suggestion is empty | CON-028 action regression |
| `src/app/dashboard/projects/schedule/actions.test.ts` | 249–270 | Self-loop exact error, no DB writes | CON-029 persistence |
| `src/lib/programme-phase-dependencies.test.ts` | 1–72 | Self-loop, chain, cascade cases | CON-029 / CON-030 unit |
| `src/app/dashboard/projects/schedule/planner-axis.test.tsx` | 455–483 | Client mouseup handler cascade test | CON-030 client handler |

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
