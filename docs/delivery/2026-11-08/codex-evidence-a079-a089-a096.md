# A079 / A089 / A096 evidence and later-release planning

8 November 2026, UAE. **Source/offline only; no human or hosted acceptance.**
Assigned branch: `codex/evidence-20261108-1020`; inspected base:
`4116d1349a0ee89c904d0e41cac8acca66e5dc38`. One bounded documentation pass.
Deliverable: distinguish reusable evidence from missing proof for the RC owners;
no application implementation or canonical register/dashboard changes.

## A079 — recovery evidence and gaps (Partial)

Sources: `docs/recovery/a079-recovery-runbook.md`,
`scripts/recovery-manifest-check.mjs`, `scripts/recovery-manifest-check.test.mjs`,
`docs/delivery/2026-10-27/handoff.md`, and the A079 entry in
`walkthrough-action-register.json` (read only).

- The runbook records app source backup `679182996680920363187c352ffc78d825bf096d`
  and programme backup `3cd4bf54690d02623df4f7fb6a07f4717f52ad9a` as historical
  observed-tree evidence, not current independent recovery of both deployed repos.
  The register records reviewed runbook/checker backup `c21457e` and 24 historical
  offline tests; these were not rerun or treated as current acceptance.
- The inspected checker keys refs by repository plus ref, checks conflicting SHAs,
  and matches required refs against that key. The tasklist records Cursor fix
  `a3ec486` on `cursor/a079-ref-identities-fix-20261107`; no branch-name repair,
  reimplementation, branch checkout or fresh verdict on that separate tip here.
- A self-consistent manifest and bundle structural validation cannot establish
  completeness against source or demonstrate restore. Missing proof includes
  both deployed repositories and deployed revisions, all required refs/history,
  LFS/assets, private/unsaved work, and independently restored DB/Auth/Storage.
  The historical QA “No backups” observation is not a fresh production finding.

Next owner/action: Codex prepares the exact recovery scope; Rob approves private
export destination, projects, retention/owners and disposable restore target before
an authorised operator executes anything. Reuse the runbook sections 3–9: reconcile
migration/managed-schema customisations, Auth boundary and session/MFA handling,
bucket configuration/policies/metadata/object hashes and restored references;
compare bundle heads with required repo/ref/SHA tuples and reconcile private work.
Record constructa-ops export or an owned waiver (waiver retains Partial). Preserve
non-secret counts, hashes, discrepancies and read-back evidence separately. No
export, credentials, SQL, restore or new backup was accessed/executed here.

## A089 — timeout evidence and causal gap (Partial)

Sources: A089 `evidence20261107` in `walkthrough-action-register.json` and
`/Users/robertsmith/cos-inbox/constructa-tasklist-20261108.md`; matching 7 November
Mac return in `/Users/robertsmith/cos-inbox/constructa.md`. These are recorded
returns, not independently rerun raw traces in this pass.

| Recorded context | Result | Limit |
| --- | --- | --- |
| Cursor cloud Linux, `6938141`, `cursor/a089-gitcheck-timeout-20261107` | 9/9 | Does not reproduce original hang |
| Mac, 7 Nov 11:58 UAE, fixed source | 9/9, 0.49 s | Passing mitigation does not identify cause |
| Same Mac, unfixed `b09dd69` | 9/9, 0.54 s | Historical timeout not reproduced |

The register describes `runGit()` using per-command fsmonitor/untracked-cache
exclusions and a 4000 ms SIGKILL timeout; Mac settings were reported unset.
Do not infer fsmonitor caused the hang. Missing: original failing command and
fixture identity, subprocess stage, exit/signal, elapsed timing and a discriminating
fixed/unfixed reproduction under the same conditions. Next owner/action: Codex
retains Partial and requests existing failing trace if available; on a later
explicitly bounded investigation capture those facts around the actual failure.
No repair, timeout increase, Git mutation or whole-suite rerun is justified here.

## A096 — analytics/newsletter inventory (Partial)

Source paths inspected or located:

| Source | Available evidence / remaining boundary |
| --- | --- |
| `src/app/layout.tsx`; `src/components/marketing/full-landing.tsx` | Current layouts/legacy landing are source surfaces; no hosted instrumentation assertion |
| `src/app/behavioral-tracking-boundary.test.tsx` | Three existing tests express absence of root/landing Plausible and Clarity loaders, retention of waitlist UI and review script exclusion; inspected, not rerun |
| `src/app/admin/page.tsx`; `src/app/admin/types.ts`; `src/app/admin/tabs/website-tab.tsx`; `src/app/admin/tabs/growth-tab.tsx` | Existing Plausible reporting/funnel references and unavailable/connection guidance; source does not establish a configured provider or accurate live attribution |
| `src/components/marketing/full-landing.tsx` | Existing ConvertKit script and subscription form action plus waitlist-attempt hook; source integration exists, but provider operation, consent and newsletter suitability are unverified |
| `src/lib/public-measurement.ts`; `src/lib/public-measurement.test.ts` | Existing typed ContactFormSubmit, TryConstructaClick and WaitlistSubmitAttempt contract; collection flag false, public-route restrictions, sanitised props and test sink only. Reuse this contract; do not implement duplicate instrumentation |
| `docs/backup-snapshots/2026-10-20/marketing-analytics-content-plan-20261018.md` | Historical analytics/Kit planning, optional signup and consent/unsubscribe boundaries; not active configuration or approval |

No credentials, environment files, provider configuration/token files or provider
accounts were read. No tracker enabled, contacts imported, emails sent or provider
calls made. Deployed loader state, provider ownership, existing list purpose,
consent provenance, sender setup, suppression/unsubscribe and retention remain
unverified. Next owner/action: Codex hands this inventory to the later A097 design;
Kimi owns A101 newsletter design; Rob retains provider/data-handling decisions.
Reuse existing work before selecting or replacing any tool.

## Later-release plans only

- **A020:** inventory existing resource/financial views before designing anything.
  Define each useful measure's units, data source, update period, permissions and
  unavailable state. Future acceptance: reconciled example totals, honest missing
  data, and no blank placeholder panels or invented operational data.
- **A025:** reconcile the existing benchmark choice and cohort capability boundary
  (`src/lib/launch-profile.test.ts`, `src/app/api/v1/benchmarks/route.ts`,
  `src/app/admin/tabs/benchmarks-tab.tsx`) before proposing regional/trade pricing
  or programme benchmarks. Record provenance, sample size, age, geography, units
  and opt-in meaning. Future acceptance: choice is accurately explained and gated;
  no unsupported “market rate” or automatic collection claim.
- **A026:** propose an opt-in measurement dictionary for estimated versus actual
  price/duration and missing activities. Separate estimates from actuals, record
  units/context and missingness; define aggregation, permissions and retention.
  Future acceptance: reproducible synthetic calculations and privacy review,
  before any collection or customer-data use.
- **A097:** propose public acquisition → signup → activation → proposal milestones,
  with explicit denominators/time windows and non-sensitive campaign attribution.
  Compare the existing Plausible work against required outcomes before choosing
  a primary tool. Exclude confidential project text, email addresses and replay.
  Future acceptance: synthetic event/attribution examples, deduplication and
  consent/review exclusions; source UI alone cannot prove conversion delivery.

## This pass: verification and handoff

Disk preflight: 20,604,140 KiB available (about 19.65 GiB), above 16 GiB.
No application tests, full build, dependency operations or server were run.
Documentation-only verification: `git diff --check` and a tiny Python check of
this document's required IDs and cited repository paths. Existing test results
above are historical/recorded, not fresh runs. All three evidence items remain
Partial; no human/hosted acceptance or release readiness is claimed. Commit/push
outcome is supplied in the final session receipt; no PR is requested.

Packaging outcome: `git add` and `git commit` were blocked by filesystem permissions
creating the shared Git worktree index lock. No commit was created and no push was
attempted; stop without bypassing permissions. The document remains in this assigned
worktree for authorised packaging.
