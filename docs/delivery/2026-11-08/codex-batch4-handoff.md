# Codex Batch 4 — Tuesday RC evidence and remaining blockers

8 November 2026, started 16:10 UAE. Tool: Codex exec tools. Branch
`codex/evidence-20261108-1020`. Source/offline evidence only; no status promotions.

Agreed outcome: establish what the RC actually contains from Codex-owned evidence,
lock two remaining testable flat-tag boundaries, and identify owners/actions for
Tuesday 10 November. No new A061/A037/A096/A097 plans or A079/A089 narratives.

## Authority and exact comparison scope

Latest user direction preserved here: Constructa only, QuantFund priority; roughly
30–90 minutes only if justified, finish early if done, hard stop 17:45 UAE or 90
minutes. No subagents, build/install/new dependencies/worktree/server, deployment,
merge, main/RC/production/settings writes, SQL, credentials, external messages,
account login or destructive actions. Only this branch's tests and own delivery
path; canonical register/dashboard untouched. No git add/commit/push; coordinator
packages after exit. Approximate hourly ceiling 2 points, not a spending target;
these tools do not expose exact point usage. Prior inbox operational directions
about housekeeping/other tools are outside this narrower assignment and were not
executed. Full inbox read programmatically; initial raw terminal display truncated;
latest dated directions separately extracted. No inbox directions cleared.
Private execution directory is outside writable roots, so material directions and
results are preserved in this owned handoff. ACK appended before substantive work.

Pinned local refs (no fetch; remote server freshness not independently checked):

- Owned HEAD: `78ecf0fc04a6b71b128d6ea9e6828a5ffcebe712`.
- RC: `origin/cursor/rc-integration-20261108` = `f690204a7360c900e2ecd3f4fd9d79030a1ccfde`.
- Main: `origin/main` = `2d056c335ae14d8391bbe242eaa701e480a45a36`.

Only `git rev-parse`, `git diff` and `git log` used for branch comparison; no
checkout or mutation of main/RC. Findings apply to these snapshots, not a future
candidate or hosted deployment. Reading checked-in source references to environment
variable names did not read environment files, credential values or auth configs.

## What landed and what drifted

| Item | RC relative to main | RC relative to owned evidence HEAD | Meaning for handoff |
| --- | --- | --- | --- |
| A079 | Checker and its tests are absent on main, present on RC. RC contains malformed-bucket refusal and primitive-string Git-ref guards; log includes `33b4cba`, `86da555`, `a3ec486`. | RC checker is ahead: validates declared/object bucket identities and ref values before lookup. RC tests add malformed bucket/ref cases, but lack our Unicode-normalised path collision and directory-in-place-of-file cases. | Ref repair is landed in this RC. Do not reimplement it or label manifest validation as recovery completion. Two owned offline cases remain unintegrated. |
| A089 | Fixture guard absent on main, present on RC; log includes `6938141` and merge `fcd7071`. | RC adds shared `runGit`, per-command `core.fsmonitor=false` and `core.untrackedCache=false`; preserves 4000ms/SIGKILL bounds and synthetic stall case. It lacks our exit-23/ENOENT diagnostic case. | Earlier statement that owned source lacked subprocess exclusions must not be applied to RC. Mitigation landed; historical cause remains unknown. |
| A096 | RC root removes main's Plausible loader/queue and Clarity injection. Root tracking-boundary test and full-landing component are present, absent on main. Admin file differs from main by only two changed lines overall. Log includes `96a27e4` and `386f28b`. | Root layout, boundary test, full-landing, marketing wiring test and complete admin page are byte-identical to owned HEAD. | Earlier inventory transfers at source level for these exact files. Kit JS/form still exists in full-landing; root loader removal does not prove all third-party collection absent. No provider acceptance supplied. |
| A097 | Typed disabled public measurement module/test absent on main, present on RC (`554d7f3`). | Only production module change is `/apply` in exact public routes; RC base test adds the corresponding positive assertion. RC lacks our adversarial event/property/route cases and all three Batch 2 offline evidence cases. | Collector remains disabled/test-sink-only. Source scope expanded to `/apply`; no new event names, attribution or conversion receipt. Earlier owned test results are not fresh RC test results. |
| A037 evidence | `labels.ts` and `content.ts` absent on main, present on RC. | Both source files byte-identical to owned HEAD. Our `a037-facet-boundaries.test.ts` is absent on RC. | New tests below target source shared with RC, but were run only in this owned worktree. Separate sectors remain unimplemented. |
| Codex documents | No integration claim from documentation. | All four earlier 8 November Codex documents are absent on RC: initial evidence, substantive handoff, Batch 2, Batch 3. | Coordinator should retain/link evidence from this branch rather than assume it travelled with product merges. |

The A097 absence is 8 adversarial test instances plus 3 Batch 2 cases; this is
coverage drift, not an observed product failure. A079 loses 2 owned cases and
A089 loses 1 owned case compared with this branch. No unchanged tests were rerun.
No broad A093 release review is claimed; Claude owns that allocation.

For byte identity, `git rev-parse <ref>:<path>` matched on HEAD/RC for:
`src/app/layout.tsx`, `src/app/behavioral-tracking-boundary.test.tsx`,
`src/components/marketing/full-landing.tsx`,
`src/components/marketing/marketing-measurement-wiring.test.tsx`,
`src/app/admin/page.tsx`, `src/lib/case-library/labels.ts` and
`src/lib/case-library/content.ts`.

## Small offline increment

Only test source changed: `src/lib/case-library/a037-facet-boundaries.test.ts`.
Added two cases under `A037 stale and ambiguous tag identities`:

1. A removed/nonexistent chip ID yields no tagged match despite matching job
   signals; untagged examples remain discoverable. Clearing chips restores job
   matching. This prevents accidental silent fallback being called filtering.
2. Two studies with the same label and different IDs remain distinct under chip
   matching (duplicate chosen IDs do not duplicate output); label-based job
   matching cannot distinguish them. This exposes the existing flat-contract
   limitation before any future typed sector extension.

Pure synthetic fixtures, current `groupByTag` only; no product behavior change,
SQL, browser, network, email, hosted, tenant-isolation or human acceptance claim.
Existing library tests were inspected to avoid duplicating their ordinary chip
precedence and exact-label tests. No new structural A096 test was justified:
provider/consent/delivery facts cannot be established from another source-string
assertion and existing root/wiring coverage already addresses the local boundary.

Exact preflight/test commands from this worktree:

```sh
python3 - <<'PYCODE'
import shutil
free=shutil.disk_usage('.').free/2**30
print(f'Disk preflight: {free:.3f} GiB')
assert free >= 16
PYCODE
node --version
node /Users/robertsmith/dev/constructa-fresh-20261025/node_modules/vitest/vitest.mjs run --config /private/tmp/constructa-codex-batch2-vitest.mjs src/lib/case-library/a037-facet-boundaries.test.ts -t 'A037 stale and ambiguous tag identities'
```

Results: preflight **41.641 GiB**; Node **v26.12.1** (not Node 24 build
validation); Vitest **v5.0.2**, exit **0**, **1 file passed, 2 passed, 2 skipped**,
**127ms**, start **16:11:52 UAE**. Earlier two tests deliberately skipped.
Existing temporary config roots this worktree, node environment, `maxWorkers: 1`,
`fileParallelism: false`, aliases owned `src` and live Vitest. Live node_modules
used read-only; no install/copy/new node_modules/build or full suite.

Comparison commands (all exit 0, except an initial harmless file search also
named nonexistent `tests`, corrected to `src`):

```sh
git rev-parse HEAD origin/cursor/rc-integration-20261108 origin/main
git diff HEAD origin/cursor/rc-integration-20261108 -- scripts/recovery-manifest-check.mjs scripts/recovery-manifest-check.test.mjs e2e/import-fixture/guard.test.ts src/lib/public-measurement.ts src/lib/public-measurement.test.ts src/app/layout.tsx src/components/marketing/full-landing.tsx src/app/admin/page.tsx src/lib/case-library/labels.ts src/lib/case-library/content.ts
git log --oneline origin/main..origin/cursor/rc-integration-20261108 -- scripts/recovery-manifest-check.mjs e2e/import-fixture/guard.test.ts src/lib/public-measurement.ts
git diff origin/main origin/cursor/rc-integration-20261108 -- src/app/layout.tsx
git diff --name-status HEAD origin/cursor/rc-integration-20261108 -- docs/delivery/2026-11-08
```

## Remaining Codex-owned blockers for Tuesday 10 November

| Item | Concrete blocker | Owner and next action |
| --- | --- | --- |
| Evidence packaging | This batch's tests/document are uncommitted; earlier owned coverage above is absent from RC. | Coordinator reviews/packages these two paths on this branch after exit. RC integrator decides which existing tests/evidence to carry to the exact candidate; do not blindly cherry-pick older source over RC fixes. Run only affected checks if integration changes the tested source. |
| A079 Partial | Offline checker cannot prove independently reconciled deployed repos/ref/history/assets or DB/Auth/Storage restore. | Codex evidence owner preserves scope; Rob supplies explicit export/restore authority, destination and owner before an authorised recovery operator acts. Reuse existing runbook; no new export/backup task was dispatched. |
| A089 Partial | Original failure trace/discriminating failure is missing; fixed/unfixed historical Mac passes do not identify cause. | Codex evidence owner retains unknown-cause qualification. Existing artifact owner supplies original non-secret trace if retained. Reopen only for that artifact or a fresh failure; no repeat passing-run investigation. |
| A096 Partial | Deployed profile/loader state, Plausible ownership/domain and Kit form purpose/ownership, confirmation, consent, suppression and retention facts unverified. | Rob/provider owner supplies non-secret existing setup/policy evidence. Coordinate with Kimi's A101 design through coordinator; no send or new provider selection here. Source inventory is complete for compared files. |
| A097 Later | No collector, visit denominator, confirmed conversion receipt or approved attribution contract. `/apply` allowlisting alone supplies none of them. | Rob/product/privacy owners decide whether activation is needed for Tuesday and approve collection boundaries before implementer changes transport. Keep attempt events labelled attempts; do not promote from offline counts. |
| A037 Later | Current schema/helper has flat disciplines, no separate sector semantics or two-facet intersection. | Rob/product owner decides whether deferred or separately scoped. Codex's new checks preserve existing contract; no schema/UI implementation implied. |

A061/A020/A025/A026 remain earlier Later plans, not new Tuesday launch gates.
This document does not decide whole-RC readiness, reopen closed work, or change
canonical statuses. Preview HOLD and real signup OFF remain the assignment's
operating boundaries. Exact-candidate merge/release authority still belongs to Rob;
CI/source evidence cannot supply that authority.

## Packaging status

No git add, commit or push attempted. No PR or external message. Coordinator owns
commit/push after this run exits. Product source unchanged. Delivery consists of
the focused test extension and this handoff; no additional runtime test/build loop
is justified by these results. Finished early once assigned work was complete.

Final verification: `git diff --check` exit 0; tracked diff contains only the 29-line test extension. New handoff exists separately (untracked). Final disk 41.643 GiB. Inbox reread before result append; concurrent Kimi ACK preserved. No further tests run.
