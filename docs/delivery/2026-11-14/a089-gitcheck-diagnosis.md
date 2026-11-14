# A089 — Git-check fixture timeout diagnosis

14 November 2026 (UTC). **Read-only diagnosis; no Git repair, timeout inflation, or whole-suite rerun.**

## Fixture under test

`e2e/import-fixture/guard.test.ts` — Vitest unit tests for the import-fixture harness Git boundary (`trackedAmong` → `git ls-files` on `src/app/admin-e2e-import-fixture` and `.gitignore`). Included in `npm test` via `vitest.config.mts` (`e2e/**/*.test.ts`).

## Historical signal (retained, not re-run)

| Artifact | Observation |
| --- | --- |
| Register / Oct delivery handoff | Full integration once reported **~177675 ms** on the unchanged Git assertion; root cause recorded **unexplained** |
| Register / backup snapshots | Passing runs at **18.75 ms**, **4656.75 ms**, **28.60 ms** under the same **5000 ms** Vitest case budget — timing variance, not a stability proof |
| `cursor/a089-gitcheck-timeout-20261107` (`6938141`) | `runGit()` adds per-invocation `-c core.fsmonitor=false` and `-c core.untrackedCache=false`, async `execFile` with **4000 ms** `SIGKILL`; **9/9** on Linux |
| Mac return 7 Nov 2026 | **9/9** in **0.49 s** (fixed) and **0.54 s** (pre-fix `b09dd69`); Mac git config reported **without** fsmonitor/untrackedCache — hang **not reproduced** |

## Concrete fixture gap (already on `main`)

Pre-fix (`b09dd69`): subprocess `git` inherited host `core.fsmonitor` / `core.untrackedCache`. When enabled (common on macOS with Watchman), `git ls-files` can block far longer than the Vitest case budget.

Repair merged as **`6938141`** (`fix(A089): isolate import-fixture Git checks from fsmonitor hangs`): central `runGit()` / `argvForGit()` disable those options **only for test subprocesses** (no repo metadata mutation). Stall handling tests use a fake `git` binary and **200 ms** sub-deadline; production **4000 ms** budget unchanged.

## Bounded repro (this run)

Environment: Cursor cloud Linux, **Node 24.19.0**, repo at **`012b708`**. Global `~/.gitconfig` has **`core.fsmonitor=true`**.

| Candidate | Command | Result |
| --- | --- | --- |
| Current `main` guard | `vitest run e2e/import-fixture/guard.test.ts` | **10/10** pass, **~600 ms** wall |
| Pre-fix `b09dd69` guard (ephemeral checkout) | same | **9/9** pass, **~567 ms** wall |

Hang and multi-minute `ls-files` **not reproduced** here even with global fsmonitor enabled.

## Exact blocker (A089 stays Partial)

1. **No retained failing trace** tying **177675 ms** (or any timeout) to a specific subprocess stage, signal, and fixture revision under the original host.
2. **Mitigation is merged** but **causal proof is missing**: passing runs on Linux and Mac (fixed and unfixed) do not discriminate fsmonitor vs other historical factors (worker load, EPERM on scratch `git init`, Vitest timer interaction).
3. **No further fixture edit justified** on this evidence alone without a matching failing environment or trace.

## Next owner (Codex)

Optional: attach original integration log showing which guard case exceeded budget and stderr/exit metadata. Any new repair must stay within A089 limits (no raised Vitest timeout, no Git repair).
