## D51 snags 054 / 061 / 065 — Case-study media: limits, upload feedback — 16 November 2026

Checks: **NOT RUN** in the authoring session (no shell). Evidence, commands to run and the open owner decision are in `d51-case-study-media-evidence.md`.

| File | Lines (approx.) | Change | Intent |
| --- | --- | --- | --- |
| `src/lib/storage/public-image.ts` | 31–62 | `publicImageProblem` (size and declared type) and `PUBLIC_IMAGE_LIMITS_HINT`; `validatePublicImage` now calls the same check | One wording for the 10 MB / JPEG-PNG-WebP limit on screen and at upload |
| `src/app/dashboard/settings/case-studies/case-studies-client.tsx` | 32–33, 150–186, 301–346, 525–560 | Limits in the photo label; oversize/unsupported/empty picks refused before sending; per-slot "Uploading…" tied to the latest pick; input cleared after each pick; same-file-twice note | Accurate limit messages; feedback for concurrent and repeated picks |
| `src/app/dashboard/settings/case-studies/library/case-study-editor.tsx` | 132–160 | Same pre-send refusal; thrown upload reported, not left unhandled; reply placed on current photos | Two library uploads on their way no longer undo each other (path still gated off) |
| `src/app/dashboard/settings/case-studies/library/case-study-photo-slots.tsx` | 6–15, 43, 57, 65 | Limits in the copy; input cleared after each pick | Same limit wording; same file can be chosen again |
| `src/lib/storage/public-image.test.ts` | 52–82 | `publicImageProblem` cases and wording parity with the upload | Regression |
| `src/app/dashboard/settings/case-studies/photo-upload-outcomes.test.tsx` | 312–470 | Limits, uploading state, refused later pick, same file again and twice | Regression |

Not changed: `saveCaseStudiesAction`, `save-state.ts`, `savePricingExperienceAction` and `saveProposalDraftAction` (no save or compare-and-set path touched); which past jobs a proposal starts with (owner decision, see evidence note).

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