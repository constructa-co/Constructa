## DAY28 Page fixture repair (DashboardRouteShell) - 28 October 2026

- Branch `codex/day28-page-fixture-repair-20261028` from `ebf6a81e33644aa1a80682f908d2a21ce4250231`.
- **Root cause (tests only):** cohort workflow pages now mount editors inside
  `DashboardRouteShell` (`header` + single `children` body). Four page tests still
  read `page.props.children[1]` from the pre-shell fragment layout, so the editor
  was `undefined` and assertions failed (`props` / `key`).
- **New fixture:** `src/lib/__fixtures__/dashboard-route-shell-page.ts` (lines 1–30)
  — `dashboardRouteShellBody` / `dashboardRouteShellHeader` assert shell root type
  and return the real body/header elements; `dashboard-route-shell-page.test.ts`
  (lines 1–22) smoke-checks traversal.
- **Tests updated (traversal only, assertions preserved):**
  - `src/app/dashboard/projects/costs/page.test.ts` — `editor()` line ~18 uses
    `dashboardRouteShellBody(page)` instead of `children[1]`.
  - `src/app/dashboard/projects/schedule/page.test.ts` — same ~line 19.
  - `src/app/dashboard/projects/costs/brief-activity-page.test.tsx` — lines ~31,
    ~43–44, ~58: body helper for project/key/brief_trade_sections reads.
  - `src/app/dashboard/projects/costs/experience-page.test.tsx` — lines ~22, ~34:
    body helper for `project.experience`.
- **No product changes.** `ProjectEntry` / guard paths unchanged (`entry.props.path`,
  `projects`, db logs, read-only checks retained).
- **Focused verification (Node 24.19):** vitest 5 files 15/15 PASS (baseline 10
  FAIL / 4 PASS on same files); eslint direct on touched sources 0 errors; `tsc
  --noEmit` 0 errors.

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

## DAY28 Second Green Integration - 28 October 2026

- Integrate second-wave pins on parent `00dcaa5` (keeps A001/A005/A063): A054
  `fb80a21`, A040 `aa7a32bc`, A041 `549583f`, A008 `852d9fcd`, A069 tests-only
  `a3954b1`. Excluded A115/A024/A075/A038; no 903 proposal-review overwrite.
- Merged A040+A041 into new job/settings with A001 palette preserved; adapted
  `unsaved-entry.test.tsx` fixtures only (inFlight ref + JobAddressField tree).
- Focused combined checks; receipt `day28-second-green-source-backup-20261028.json`.
  Five actions Partial; counts 66C/32P/19N/1B unchanged.

## RESUME1300 Next Green - 28 October 2026

- Parent `c6cd984`: integrate **A075** `dc23b492` PDF compact layout (2 product files
  vs da8 parent; c6 PDF base matched da8) and **A115** `afaac1d` Completed→Active
  reopen guard only (2 board files; baseline Active→Won retained, generic Won policy
  still pending). **Excluded:** A038 until SQL compatibility return; unreviewed A115
  `9bba165` type-ack; A054 advanced; address-lock P2 repair (separate, not integrated).
- Focused checks: `proposal-brochure.test.ts` 38 PASS (+3 new); board feedback 13 PASS
  (+2 new). No full PDF/pipeline suite rerun when pre-patch base matched tested parent.
- Receipt `resume1300-next-green-source-backup-20261028.json`. A075/A115 remain Partial.

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
