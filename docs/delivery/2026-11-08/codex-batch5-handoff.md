# Batch 5: tests-only RC port

8 November 2026. Owner: Codex, branch `codex/evidence-20261108-1020`,
HEAD `ec05a1e40904205e8289f9077bec1ab42b3c6efd`.
Deliverable: `codex-batch5-rc-test-port.patch` in this directory. Built from
`git show f690204a7360c900e2ecd3f4fd9d79030a1ccfde:<path>`, not from an RC
checkout. No product-source replacement. No remote freshness claim.

## Patch contents

| File | Additions |
| --- | --- |
| `scripts/recovery-manifest-check.test.mjs` | A079: composed/decomposed Unicode export-path collision; directory replacing a required regular file (2 cases). |
| `e2e/import-fixture/guard.test.ts` | A089: synthetic exit 23 retains code/signal/stderr diagnostic; absent executable retains ENOENT (1 case with two assertions). Uses RC's existing `trackedAmong` → shared `runGit`; no old helper reinstated. |
| `src/lib/public-measurement.test.ts` | A097: 8 adversarial instances (runtime event/property filtering, 6 private/lookalike routes, repeated attempts) plus 3 offline boundaries (no transport/persistence, no attribution leakage, route recheck). Existing RC `/apply` positive assertion retained; attribution and navigation cases now begin on `/apply`. |

Total: **14 test instances**, three existing test files, additions only.
Patch SHA256: `b2ad964ad498099cc0e8149bef6bae1b5eae658d24324220e17c04515171d08a`.

## Verification and limits

Git blob comparisons, via `git rev-parse HEAD:<path> f690204:<path>`:

| Source under test | Owned HEAD blob | RC blob | Result |
| --- | --- | --- | --- |
| `scripts/recovery-manifest-check.mjs` | `6f4faa87fdb07f1eba25b465787581281e826bd5` | `4e12de8ed3494061e89115d3665da9f10355daff` | Different. Both A079 additions **unverified against RC**, not rerun against older local source. |
| `src/lib/public-measurement.ts` | `96f55a35985cda25b90b51ac733bb03b68675da3` | `abb8c45ca91a16ddec9cd7176459cb38217d332f` | Different (`/apply` added). All 11 A097 additions **unverified against RC**. |
| `e2e/import-fixture/prepare.mjs` | `10fe74f44752702e0bceaa31d492341b9fe3db5e` | Same | Byte-identical. A089 selected case passed using the actual patched RC helper below. |

A089 helpers are inside the test file itself, whose original HEAD/RC blobs differ
(`9f8608fa2241f3735a8ebd7eda0122957137cd31` versus
`24f48489ba8425b2257f0f16c8a6005282bac9be`). Therefore, rather than using the
older local helper, verification generated an exact full patched RC test copy at
`e2e/import-fixture/codex-batch5-rc-guard.test.ts` in this owned worktree.
The copy kept all RC imports/helpers unchanged, including `runGit` and its
subprocess config. Only the new diagnostic case was selected; no Git init/add
cases executed. The generated copy was removed after verification; original
tracked test files were never changed. The patch is its durable source.

Exact preflight and runtime commands (owned worktree cwd):

```sh
python3 - <<'PY'
import shutil
free=shutil.disk_usage('.').free/2**30
print(f'Disk preflight: {free:.3f} GiB')
assert free>=16
PY
node --version
node /Users/robertsmith/dev/constructa-fresh-20261025/node_modules/vitest/vitest.mjs run --config /private/tmp/constructa-codex-batch2-vitest.mjs e2e/import-fixture/codex-batch5-rc-guard.test.ts -t 'distinguishes a synthetic command failure from a deadline'
```

Results: disk **41.136 GiB**; Node **v26.12.1**; Vitest **v5.0.2**, exit **0**,
**1 passed, 9 skipped**, **760ms**, start **18:11:29 UAE**. Existing temporary
config: owned worktree root, node environment, `maxWorkers: 1`,
`fileParallelism: false`, `@` alias to owned `src`, Vitest alias to live dependency
installation. Dependencies used read-only; no installation/build/server.
This is synthetic subprocess diagnostic evidence, not historical timeout causality
or whole-RC execution evidence. No Node 24 build claim.

Patch construction/check command was
`python3 /private/tmp/constructa-codex-batch5-port.py` (exit 0). It read each RC
and HEAD test via `git show`, extracted only missing cases, preserved the RC base,
and generated unified diffs with `difflib.unified_diff`. An independent Python
hunk/context reconstruction matched all three intended patched files exactly;
assertions confirmed additions only, existing `/apply` assertion and shared
`runGit` preserved. This is an offline patch-context check, **not** a `git apply
--check` receipt or runtime pass for A079/A097. Temporary generator/config paths
are execution receipts, not required dependencies for applying the patch.

## RC integrator next action

Owner: Cursor or Claude, through the coordinator's authorised RC work.
Transfer this patch without replacing product files or cherry-picking older
source. In the intended RC checkout, inspect branch, existing edits and candidate
SHA first. If the three test files changed since pinned RC, review/rebase the
small additions without overwriting others. Under the integrator's authority:

```sh
git apply --check /absolute/path/to/codex-batch5-rc-test-port.patch
git apply /absolute/path/to/codex-batch5-rc-test-port.patch
```

These commands are proposed next actions, **not executed by Codex**. After the
16 GiB disk preflight, use the RC's single-worker offline test configuration:

```sh
node --test --test-concurrency=1 --test-name-pattern='Unicode-normalised export paths|directory in place' scripts/recovery-manifest-check.test.mjs
node /absolute/path/to/existing/node_modules/vitest/vitest.mjs run --config /absolute/path/to/rc-single-worker-config.mjs e2e/import-fixture/guard.test.ts -t 'distinguishes a synthetic command failure from a deadline'
node /absolute/path/to/existing/node_modules/vitest/vitest.mjs run --config /absolute/path/to/rc-single-worker-config.mjs src/lib/public-measurement.test.ts -t 'adversarial public measurement inputs|A097 offline evidence boundaries'
```

The configuration must root the actual RC checkout, node environment,
`maxWorkers: 1`, `fileParallelism: false` and correct existing dependency aliases.
Do not use this batch's temporary configuration unchanged from another checkout.
Record exact tested candidate and results. A079/A097 RC runtime verification is
still outstanding; full RC suite, integration/build/hosted/human/DB/email acceptance
are not supplied by this handoff.

## Boundaries and packaging

Current exact task preserved here: Constructa only; QuantFund priority; tests-only
port and truthful source/offline evidence, <=90 minutes or 20:45 UAE, finish early
when done; roughly 2 points/hour ceiling (actual points unavailable). No subagents,
build/install/new dependencies/worktree/dev server, live actions, credentials,
external messages, register/dashboard changes, commit or push. ACK appended first;
entire inbox read programmatically (initial raw terminal display truncated), latest
dated material extracted. Earlier other-tool/housekeeping jobs were outside this
assignment. Private record directory is outside writable roots, so current material
directions/results are preserved in this owned handoff. No inbox directions cleared.

Only this patch and handoff remain for coordinator packaging after exit.
**Git add/commit/push: not attempted.** No main/RC checkout or write, no product
source change. Finished early because the requested patch and eligible focused
verification are complete; no repeated unchanged tests or artificial delay.
