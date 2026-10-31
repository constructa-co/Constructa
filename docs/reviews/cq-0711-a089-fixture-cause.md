# A089 fixture Git check: cause isolation and source repair

Status: **FAIL. The repair is written but has never been executed.**
Base: `7900d5ef8e010d4935f510bddd5f47937641e8ff`
Branch: `cq/cq-0711-a089-fixture-cause`
Changed source: `e2e/import-fixture/guard.test.ts` (uncommitted)
Base blob: `2a33a5ca3a716d36701caf92376a1a15a79ea303`
Candidate hash: NOT RECORDED. `git hash-object` and `shasum` were denied.

## Blocker

The session's permission layer returned `This command requires approval` for every
command that would run the checks, and the session is non-interactive. No approval was
possible, and none was bypassed.

| Command | Outcome |
| --- | --- |
| `npx vitest run e2e/import-fixture/guard.test.ts` | denied, not run |
| `npm test -- e2e/import-fixture/guard.test.ts` | denied, not run |
| `node --test scripts/recovery-manifest-check.test.mjs` | denied, not run |
| `node -p "require('os').tmpdir()"` | denied, not run |
| `/usr/local/bin/node --version` | denied, so no Node 24 binary was identified |
| `git --version` | denied |
| `GIT_INDEX_FILE=/nonexistent/a089-index git ls-files src/app/admin-e2e-import-fixture` | denied, not run |
| `GIT_DIR=/nonexistent/a089-git git ls-files src/app/admin-e2e-import-fixture` | denied, not run |

Two further limits apply:

- This worktree has no `node_modules` (`ls: node_modules: No such file or directory`).
- `node -v` on PATH is `v26.12.1`, while `package.json` requires `>=24.19 <25`.

Reading `/Users/robertsmith/dev/constructa-private-20261027/rob0612-actual-directions-20261031.json`
was also denied, so the directions were taken from the task text only.

## Commands that did run

```text
$ git rev-parse HEAD
7900d5ef8e010d4935f510bddd5f47937641e8ff
$ git rev-parse --git-dir --git-common-dir
/Users/robertsmith/dev/constructa-fresh-20261025/.git/worktrees/cq-0711-a089-fixture-cause
/Users/robertsmith/dev/constructa-fresh-20261025/.git
$ git ls-files src/app/admin-e2e-import-fixture
(no output, exit 0)
$ git ls-files src/app/admin-e2e-import-fixture .gitignore
.gitignore
```

These show that real Git answered promptly here in this worktree, and that
`.gitignore` works as a tracked positive control. No elapsed time was measured.

## Findings

Static findings come from the source. The behavioural items are expected from documented
Node and Git behaviour and were **not observed** in this session.

1. **Unbounded (static).** At base, `guard.test.ts:30` called `execFileSync` with no
   `timeout`. Sibling calls set one: `scripts/test-first-session-presentation.mjs:11`,
   `scripts/secret-scan.mjs:33` and `e2e/local-navigation/compile.mjs:29`.
2. **Timer starvation (expected, not observed).** `execFileSync` blocks the JS thread, so
   the Vitest 5000ms timer cannot fire while the child runs. A test case could therefore
   overrun its budget by as long as Git takes. This is consistent with an old duration far
   above 5000ms, but it does not show what the child was doing.
3. **`timeout` alone is not enough (expected, not observed).** The default kill signal is
   SIGTERM, which a child can ignore. SIGKILL cannot land on a process in uninterruptible
   kernel wait, and a synchronous call would stay blocked in that state. An asynchronous
   call leaves the Vitest timer live, so the case still fails at 5000ms. Such a child would
   be left running.
4. **False pass (expected, not observed).** The old assertion was "output is empty". Git is
   expected to exit 0 with no output when the index file is absent, which would read as
   "not tracked" with no metadata proof. The candidate's "index missing" test is the check
   for this.

Non-zero Git exits, including `fatal: not a git repository`, already threw at base. That
path was not a false pass.

## Repair

The change affects only the test file. No product, fixture app, config or threshold
changed, and the Vitest case stays at 5000ms.

- The real `git ls-files` check now uses asynchronous `execFile`, with `timeout: 4000` and
  `killSignal: "SIGKILL"`.
- The query adds `.gitignore`, and the result must equal exactly `[".gitignore"]`. A tracked
  harness file, or an index Git cannot see, fails this match.
- Failures throw with `code`, `signal`, `killed` and `stderr`. There is no skip or fallback.
- The 4000ms deadline exists so the diagnostic arrives before the 5000ms case limit, leaving
  time for the `.gitignore` read and reporting. It is a budget, chosen by reasoning and not
  measured. It is not a fix for, or a claim about, the old timeout.

New cases use real Git in scratch repositories under the OS temp directory, and never
touch real metadata:

- tracked file detected
- index removed
- outside a repository

The only stand-in is a stalled script that ignores SIGTERM, for the deadline path. It runs
for at most 200ms against a real child.

Line 94's `execFileSync("node", ...)` is also unbounded. It is not the Git check, so it was
left alone.

## Causal limits

- The old 177675ms timeout remains **unexplained**. Nothing here is proof of its root cause.
- The old `fatal: not a git repository` result and dataless-file observations are separate
  evidence, and were not investigated. No old repository or metadata was inspected.
- This is not hosted or full-app qualification.
- The candidate may contain type or runtime errors, because `tsc` and Vitest were not run.

## Checks still required

Run these from this worktree with Node 24 and an existing dependency set. Results must
replace the not-run entries above before this can pass.

```bash
npx vitest run e2e/import-fixture/guard.test.ts
npx tsc --noEmit --incremental false
npx eslint e2e/import-fixture/guard.test.ts
```

To confirm finding 4, revert the positive control and check that "index removed" then
exposes the false pass.

## Cursor focused verification (31 Oct 2026, cq-0721)

**Provenance:** Rob06:12 authority; worktree `cq/cq-0711-a089-fixture-cause` at commit
`1fc0da1367a696ddb06a1077aefc18cf4fc46003`. Source bytes unchanged (no product/test edits
this session). **`e2e/import-fixture/guard.test.ts` blob:** `bcc588f9f612f822c17c35bd2b23b925c1e29c1a`
(`git hash-object` on committed tree at HEAD).

**Prior grades retained (not superseded):** Claude author **FAIL** — COMMAND APPROVAL block,
checks not run (see Blocker table above). Different Cursor static checker **PASS** at
07:10:17 UAE — runtime/type correctness explicitly unproven there; not repeated here.

**Harness:** Node `/usr/local/bin/node` → `v24.19.0`. ROOT dependencies:
`/Users/robertsmith/dev/constructa-fresh-20261025/node_modules` via worktree symlinks to
`vitest`, `vite`, `vite-node`, `@vitest` (cq-0430/cq-0442 pattern; no install/copy).
**Temp/cache:** `TMPDIR` and Vite cache under
`$WT/node_modules/.cache/cq-0721` (ignored). No `.tmp-test-run`, no parent ROOT cache write.

**Not run:** `next build`, full vitest suite, Playwright, hosted qualification, false-pass
revert experiment (would need scratch `git init` or real index mutation — both out of scope
this run).

### Commands (literal argv) and raw outcomes

```text
/usr/local/bin/node -v
→ v24.19.0
→ exit 0

git rev-parse HEAD
→ 1fc0da1367a696ddb06a1077aefc18cf4fc46003
→ exit 0

git hash-object e2e/import-fixture/guard.test.ts
→ bcc588f9f612f822c17c35bd2b23b925c1e29c1a
→ exit 0

cd $WT && TMPDIR=$WT/node_modules/.cache/cq-0721 VITE_CACHE_DIR=$WT/node_modules/.cache/cq-0721/vite \
  /usr/local/bin/node ./node_modules/vitest/vitest.mjs run e2e/import-fixture/guard.test.ts
→ RUN  v5.0.2 …/cq-0711-a089-fixture-cause
→  ❯ e2e/import-fixture/guard.test.ts (9 tests | 2 failed) 377ms
→ FAIL  … > the Git check sees a tracked harness file
→ Error: Command failed: git init -q
→ …/node_modules/.cache/cq-0721/import-fixture-guard-geybUW/.git: Operation not permitted
→ FAIL  … > the Git check cannot pass when Git cannot see the index
→ Error: Command failed: git init -q
→ …/node_modules/.cache/cq-0721/import-fixture-guard-ojh6V4/.git: Operation not permitted
→ Test Files  1 failed (1)
→ Tests  2 failed | 7 passed (9)
→ Duration  464ms
→ exit 1

/usr/local/bin/node $ROOT/node_modules/eslint/bin/eslint.js e2e/import-fixture/guard.test.ts
→ (no stdout)
→ exit 0

/usr/local/bin/node $ROOT/node_modules/typescript/bin/tsc --noEmit --incremental false
→ (no stdout)
→ exit 0
```

### Focused verification verdict

| Check | Result |
| --- | --- |
| Vitest `e2e/import-fixture/guard.test.ts` only | **FAIL** — 7/9 passed; 2 scratch-repo cases failed before assertions (`git init -q` → `.git: Operation not permitted` under Cursor sandbox in task `TMPDIR`) |
| ESLint on changed test path | **PASS** — exit 0, 0 reported errors |
| Full `tsc --noEmit --incremental false` | **PASS** — exit 0 |

**Sandbox probe (same session):** `git init -q` under
`$WT/node_modules/.cache/cq-0721/scratch-probe` returned `.git: Operation not permitted`
(exit 1) without altering real worktree metadata.

**Finding 4 (empty-output false pass):** **Unproven** this session — counterexample needs
disposable scratch repos with `git init`; sandbox refused `.git` creation. Original static
expectation in Findings §4 unchanged.

**Causal limits unchanged:** old 177675ms timeout **unexplained**; metadata-recognition
evidence not investigated; not ROOT acceptance or A089 Complete.
