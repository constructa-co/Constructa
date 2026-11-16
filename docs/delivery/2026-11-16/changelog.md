## D51 snags 027 / 038 / 039 / 059 — Proposal site photos, director's message, programme labels, terms gap — 16 November 2026

Branch `claude/d51-proposal-evidence`, working tree only (not committed, not pushed). Checks NOT RUN in this session; see `d51-proposal-evidence.md`.

| File | Lines (approx.) | Change | Intent |
| --- | --- | --- | --- |
| `src/lib/proposal-site-photos.ts` | new | `sitePhotoOrigin`, `sitePhotosForJob`, `SITE_PHOTO_ELSEWHERE_ERROR` | 027: tell a photo uploaded for this job from one stored for another job, as branding or as a case study |
| `src/lib/proposal-publication.ts` | 14, 134–147, 520–523, 590–597 | Snapshot and cover photo use only this job's site photos; `CURRENT_DOCUMENT_PRESENTATION_VERSION = 3` | 027: unrelated photo never previewed or sent; 038/039: new layout only on new snapshots |
| `src/app/dashboard/projects/proposal/actions.ts` | 30, 136–141 | Draft save refuses a photo that belongs elsewhere, before any write | 027: unrelated photo never saved to the job |
| `src/app/dashboard/projects/proposal/review-send-client.tsx` | 36, 810–814, 1151 | Inline notice on a saved photo that is left out; closing helper copy states the message is shown once | 027 visibility; 038 copy matches behaviour |
| `src/lib/proposal-document.ts` | 86–87, 213–231, 518 | From presentation 3, director's message already used as the closing is not repeated under About; `presentationVersion` on the document | 038: message shown once; issued snapshots unchanged |
| `src/lib/pdf/proposal-brochure.ts` | 575–583, 600–624 | From presentation 3, a long stage name wraps and its row grows; earlier snapshots keep the first-line layout | 039: no clipped stage label in new PDFs; issued PDFs unchanged |
| `src/lib/proposal-site-photos.test.ts` | new | Origin rules, snapshot/document/preview filtering, issued snapshot untouched | 027 regression |
| `src/app/dashboard/projects/proposal/actions.test.ts` | 23, 56–57, 257–300 | Save refusal without write; publish omits another job's photo with reviewed-content parity | 027 regression |
| `src/lib/proposal-document.test.ts` | 401–480 | Message once on page and PDF; presentation 2 / absent still shows both; full stage name in PDF; presentation 2 keeps one-line rows | 038 / 039 regression |
| `docs/delivery/2026-11-16/d51-terms-gap.md` | new | Terms gap described from source, quoting existing clauses only | 059: documented, no wording changed |
| `docs/delivery/2026-11-16/d51-proposal-evidence.md` | new | Scope, behaviour, evidence limits, owner decisions | Handoff evidence |

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