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

## C6 address pending repair - 28 October 2026

- **Branch:** `codex/c6-address-pending-repair-20261028` from `c6cd984064c170bd5c2252fe15684c7d30c219f7`
- **`src/components/job-address-field.tsx` (~64–70):** Removed `disabled={disabled}` from the plain address textarea so literal free-text drafts stay editable while create is pending; `disabled` continues to gate postcode Find, manual parts, and Use only (intent: restore pre–JobAddressField-lock UX without changing storage or submit snapshot rules).
- **`src/app/dashboard/projects/new/unsaved-entry.test.tsx`:** Mount real `JobAddressField` / picker / manual subtree (same seam as manual-address tests); `edit()` drives textarea `onChange` instead of mutating form state; pending test asserts site/client textareas stay enabled, structured Find/Use disabled, and post-refusal draft retained via textarea value + form state.

## DAY28 Second Green Integration - 28 October 2026

- Integrate second-wave pins on parent `00dcaa5` (keeps A001/A005/A063): A054
  `fb80a21`, A040 `aa7a32bc`, A041 `549583f`, A008 `852d9fcd`, A069 tests-only
  `a3954b1`. Excluded A115/A024/A075/A038; no 903 proposal-review overwrite.
- Merged A040+A041 into new job/settings with A001 palette preserved; adapted
  `unsaved-entry.test.tsx` fixtures only (inFlight ref + JobAddressField tree).
- Focused combined checks; receipt `day28-second-green-source-backup-20261028.json`.
  Five actions Partial; counts 66C/32P/19N/1B unchanged.

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
