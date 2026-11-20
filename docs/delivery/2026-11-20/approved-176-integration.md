# PR #176 — main integration (source-only) — 20 November 2026

**Worktree:** `.cq-wt/codex-d36-markup-package-20261116`  
**Integration branch:** `codex/approved-176-integration-20261120`  
**PR #176 head (unchanged on original draft):** `dbbbaab4f08c699eceb60111f4a35c9c639894f3`  
**Preserved draft tip:** `bcb1f1ab034e0f9c8fa93dead786a9d75838bf02` on `codex/d36-markup-package-20261116`  
**Main merged target:** `53167bce1049c39901261186b18119039b8c47d4` (PR #225 photo release; local merge **not committed** — shell blocked in authoring session)

Release sequence for #176 remains **STOPPED** until R1 runs fresh CI, Sonnet review, and Preview. No #185 advancement. No SQL apply, deploy, settings, or auth actions were performed.

## Conflict resolution (intent)

| Area | Resolution |
| --- | --- |
| `src/lib/financial.ts` | **Merged:** D36 `on_net` / `compound` markup (default on-net for new estimates, legacy compound for null) **plus** main CON-016 face-value lines, `isPricedPreliminariesLine`, and `computeBudgetCost` including PC/provisional sums |
| `src/lib/simple-estimate.ts` | **Merged:** main prelims notes + face-value totals + `line_type` in `summarisePrice`; **retained** `markupMethod` on `PriceSummary` |
| `src/lib/proposal-publication.ts` | **Merged:** D36 `calculation_note` + main `sitePhotosForJob`, face-value fee items, case-study photo ordering via `legacyProfileCaseStudyPhotos` |
| Estimate UI (`estimate-client.tsx`) | **Merged:** D36 markup method printouts + main face-value running-total row and adjustment notes |
| Advanced / BoQ | **Partial:** D36 markup banner and `boq-excel-export` canonical sum remain; full file-level sync from main for `advanced-estimate.tsx` still recommended before CI |
| Library tests | D36 `templates-actions.apply-template.test.ts` retained; main case-library / photo tests added via new `case-study-photo-behaviour.ts` + `proposal-site-photos.test.ts` |
| Delivery log | `docs/delivery/2026-11-16/changelog.md` — main CON-073 / D51 / D49 entries **prepended**; D36 sections **retained** |

## New / restored files from main (copied in this session)

- `src/lib/estimate-line-type.ts`
- `src/lib/proposal-site-photos.ts`
- `src/lib/proposal-site-photos.test.ts`
- `src/lib/case-library/case-study-photo-behaviour.ts`

## Focused test added

- `src/lib/markup-method.test.ts` — face-value lines do not receive markup under both `on_net` and `compound`

## Rollback plan (#176 schema only — no apply in this session)

Apply order on preview/staging first; production only after green CI + Sonnet + verified readback.

1. **Before apply (Rob/operator):** Supabase backup / PITR snapshot; **export the live `create_phase1_project_graph` definition** (pre-apply RPC backup — not inferred from git). Record `profiles.markup_method` and `estimates.markup_method` row counts, null rates, and any non-null `on_net` rows created after go-live.
2. **Migrations (forward):**
   - `20261115120000_d36_markup_method.sql` — adds `profiles.markup_method`, `estimates.markup_method` (default `on_net` column default for new rows only; existing rows unchanged until written by app).
   - `20261116140000_d36_phase1_project_graph_markup_method.sql` — `CREATE OR REPLACE` `create_phase1_project_graph` to stamp company method on new estimates in the RPC payload.
3. **Rollback (if apply fails or post-apply defect):**
   - **Stop estimate/profile writes** if rollback cannot preserve stored `markup_method` values and pricing semantics (especially any post-apply `on_net` estimates).
   - **Do not** blindly redeploy a pre-#176 app build after new on-net estimates exist — that build ignores stored method and would mis-price live jobs.
   - **Do not** drop `markup_method` columns to “clean up”; that destroys contractor choices and is irreversible without a row-level backup.
   - SQL rollback (preview only): restore **the backed-up** `create_phase1_project_graph` body from step 1. Leave columns in place; forward-fix the app if urgent.
   - App rollback is allowed only when readback proves no production estimates depend on stored `on_net` (or those rows are migrated/compounded under operator control).
4. **Readback after apply:** `SELECT markup_method, count(*) FROM estimates GROUP BY 1;` and spot-check one legacy null-method estimate still compounds in UI/PDF; spot-check one new estimate matches company default.

## Remaining blockers (honest)

| Blocker | Status |
| --- | --- |
| `git merge 53167bc` + merge commit on `codex/approved-176-integration-20261120` | **Conflict markers cleared in source** — R1 must `git add` and commit merge |
| Fresh GitHub CI on integration branch | **NOT RUN** |
| Independent Sonnet review post-merge | **NOT RUN** (prior review at `dbbbaab` only) |
| Protected Vercel Preview | **NOT CLAIMED PASS** — Supabase browser signed out; stale health run cited at release stop |
| Full sync `advanced-estimate.tsx`, `financial.test.ts`, `proposal-document` presentation v6 from main | **PARTIAL** — large files; recommend `cp` from main worktree at `53167bc` then re-apply D36 markup lines |
| SQL apply / production | **STOPPED** per CTO sequential schema gate |

## Commands for R1 (when shell available)

```bash
cd /Users/robertsmith/dev/constructa-fresh-20261025/.cq-wt/codex-d36-markup-package-20261116
git fetch origin main
git merge --no-ff 53167bce1049c39901261186b18119039b8c47d4 -m "Merge main 53167bc into approved #176 integration"
# resolve any remaining conflict markers, then:
git add -A && git status
# commit source-only integration; push only when authorised
```