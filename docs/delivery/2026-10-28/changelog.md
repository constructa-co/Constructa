# A038 Case study photos and library AI - 28 October 2026

- Branch `codex/a038-case-photos-20261028` from backup pin `00dcaa5470ceaaeacecb596dfe6eed82b99440a1`.
- Library case-study content contract: three ordered photo slots (url + optional caption), shared vectors + SOURCE ONLY migration `20261028120000_case_library_photos.sql` (not applied).
- Improved journey: full-form editor photo slots (injectable upload), optional AI Enhance on delivered/value_added with explicit accept/refuse; guided path links to full form for photos; resolver publishes safe photo urls from approved library rows.
- Older `profiles.case_studies` path unchanged (three url slots, existing enhance/upload actions). Adoption from older records still does not copy pictures without explicit choice.
- Tests: `photos.test.ts`, `case-study-photo-journey.test.ts`, contract vectors updated; A038 remains Partial until independent review and migration apply.

## Cursor change log (A038)

| File | Lines (approx) | Change | Intent |
|------|----------------|--------|--------|
| `src/lib/case-library/photos.ts` | new | Photo slot rules, url safety, proposal mapping | Single place for three-slot contract |
| `src/lib/case-library/content.ts` | 35-190 | `photos` on CaseStudyContent | Align app rules with SQL migration |
| `src/lib/case-library/service.ts` | 64-266 | Deep compare photos; CONTENT_KEYS | Fix approval/save with photo arrays |
| `src/lib/case-library/resolve.ts` | 70-82 | Map approved photos to proposals | Close library→proposal reuse seam |
| `src/lib/case-library/status.ts` | 39-40 | Track photo changes since approval | Honest approval-changed labelling |
| `src/app/dashboard/settings/case-studies/library/case-study-editor.tsx` | imports, enhance, photos UI | Library journey photos + AI | A038 improved journey |
| `src/app/dashboard/settings/case-studies/library/case-study-photo-slots.tsx` | new | Three-slot UI with captions | Reuse pattern from older editor |
| `supabase/migrations/20261028120000_case_library_photos.sql` | new | SOURCE ONLY SQL | DB parity when applied |
| `src/lib/case-library/__fixtures__/contract-vectors.json` | bulk | `photos` on all drafts | TS/SQL vector parity |
| Tests under `case-studies/` and `case-library/` | various | Seams, guided exclusion, FULL draft | Offline synthetic proof |

# DAY28 First Green Integration - 28 October 2026

- Integrate accepted product pins only: A001 core editing palette (`5aa12e6`),
  A005 core route geometry (`5cb40a9`), Claude A063 pre-transport planning
  conversation core/UI (`71952dd`). Parent da8b8ee unchanged scope for rejected
  or pending jobs.
- Retained focused checks on combined bytes: palette schedule-control 8/8
  (prior five expectation failures resolved on integrated A001 test, not
  spurious), A001 bundle 17, A005 geometry 6, A063 planning 27; A005 production
  eslint 0 errors (3 retained warnings on pre-existing dashboard-client anys).
- Planning UI stays honestly Not enabled: no default generator, model, budget,
  provider or App AI activation. Tripwire review only; not deployed conversation.
- Required fresh Node24 output-only build, full source-tree readbacks, 0 preview
  events, source+range gitleaks 0, non-force backup remote match. Exact SHA in
  private day28-first-green-source-backup-20261028.json. A001/A005/A063 remain
  Partial pending parent original-grade criteria; no self-Complete.

## Earlier Changelog Retained

# Programme Navigation Follow-Through - 28 October 2026

- Accept Kimi's single refresh-after-push regression; explicitly condition the
  last-save/newer-edits warning and correct the earlier leaving-state assertion.
- Two actual affected mounted cases PASS/17NOT_SELECTED; lint PASS. No fake
  pre-change VitestRED; original failures and all earlier evidence retained.
- Reject promise premise against actual AppRouter void API. No router/model/
  save/calendar/money/Auth/legal/runtime-hold behavior changed.
- Record autonomous routine app authority and mandatory workflow-effects
  preflight before any PR; PR106closed/nohostedrerun.
- Exact current build/scans/backup final result belongs in the private source
  receipt; all118statuses unchanged and unfinished scopes remain Partial.
