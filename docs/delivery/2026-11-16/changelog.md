## D49 CON-017 / CON-034 / CON-035 — Brief figures, postcode lookup, UK dates — 16 November 2026

| File | Lines (approx.) | Change | Intent |
| --- | --- | --- | --- |
| `src/lib/proposal-figure-consistency.ts` | 1–82 | Parse £ in brief/proposal text; compare to ex/inc VAT and payment stages | CON-017 consistency checks |
| `src/app/dashboard/projects/proposal/review-send-client.tsx` | imports, `figureWarnings`, readiness alert | Show non-blocking warnings before send | CON-017 visibility on Review & Send |
| `src/lib/postcode-address-provider.ts` | 1–81 | postcodes.io behind `NEXT_PUBLIC_POSTCODE_LOOKUP_ENABLED`; configuration gap copy | CON-034 authorised provider + manual fallback |
| `src/components/postcode-address-picker.tsx` | Find + hint | Surface configuration gap when lookup unset | CON-034 UX |
| `src/app/dashboard/projects/new/new-project-form.tsx` | lookup + date | `clientPostcodeLookup()`; `UkDateInput` for start date | CON-034 / CON-035 wiring |
| `src/app/dashboard/projects/settings/client-page.tsx` | pickers + start date | Same lookup + UK date on project settings | CON-034 / CON-035 |
| `src/app/dashboard/projects/brief/brief-client.tsx` | start date | `UkDateInput` with UK preview | CON-035 |
| `src/components/uk-date-input.tsx` | 1–43 | `lang="en-GB"`, written preview, uncontrolled `defaultValue` | CON-035 shared control |
| Tests under `src/lib`, `src/components`, `review-send-client.test.ts` | (new/updated) | Focused regressions | CON-017/034/035 |

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