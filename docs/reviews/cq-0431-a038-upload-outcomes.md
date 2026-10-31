# cq-0431 A038: legacy photo-upload outcomes and row identity

**Status: Cursor author-return checks executed on commit `946a25f0a83f3abd9c3d3610be04de5d7e41de2f`.** Repaired-client Vitest GREEN and save-state regression GREEN; ESLint (changed paths) and full `tsc --noEmit` GREEN. **Baseline RED on blob `7bc1c110…` was not executed** (would need a separate harness or temporary client swap; not run here).

Base: `b27539067fdc5882bbc617c58ad0af3508242772`. Owner: Claude CLI. Checker: Grok CLI. **Author-return verification: Cursor Composer 2.5 (31 Oct 2026).**

This repair does NOT close A038's full three-photo hosted journey.

## Prior non-interactive refusals (Claude session; preserved)

The earlier session's permission layer required approval for every route to the tools, and the session is non-interactive, so each call was refused before running:

| argv | raw result |
| --- | --- |
| `/Users/robertsmith/dev/constructa-fresh-20261025/node_modules/.bin/vitest --version` | `This command requires approval` |
| `npx vitest run src/app/dashboard/settings/case-studies/photo-upload-outcomes.test.tsx` | `This command requires approval` |
| `node ../../node_modules/vitest/vitest.mjs --version` | `This command requires approval` |
| `npm run test -- --version` | `This command requires approval` |
| `/opt/homebrew/opt/node@24/bin/node -v` | `This command requires approval` |
| `/usr/local/bin/node -v` | `This command requires approval` |
| `node -v` | `v26.12.1` (PATH node; outside the repo's `>=24.19 <25` engine, so not used) |

## Files (git blob hashes at `946a25f`)

| file | state | hash |
| --- | --- | --- |
| `src/app/dashboard/settings/case-studies/case-studies-client.tsx` | modified vs base | baseline blob `7bc1c110f26faf21cda13467f461933cfb8ae45f`; repaired `bc5b56bf019e6d0096ef46c0b2022980cd7c4800` |
| `src/app/dashboard/settings/case-studies/photo-upload-outcomes.test.tsx` | new | `a36c0f1895c57630e574b890094299a7d556ee0b` |
| `docs/reviews/cq-0431-a038-upload-outcomes.md` | updated this verification | pre-append blob `fb613ecd0b72dc7cad7a150a65b93e9cdf75bcef` |

Commit: `946a25f0a83f3abd9c3d3610be04de5d7e41de2f`.

## The repair

- **Identity:** a client-only `rowHandles` ref, one handle per row in list order, changed only in `addCaseStudy` and `removeCaseStudy`. A stored `id` was deliberately not used: `src/lib/case-library/legacy.ts` records that ids can be missing or shared, and rows are not validated on load. Handles are never saved and entries are not changed.
- **Placement:** when the reply arrives, the row is found by handle and the photo is written through the existing `edit` action as a functional change, so the latest text, other slots and other rows are kept.
- **Same slot:** the latest pick for a row and slot wins; a reply from an older pick is dropped silently.
- **Removed row:** the result is discarded and an error toast says so.
- **Failures:** a thrown upload is caught and reported in fixed wording without the transport's own text. Returned failures keep the existing wording. Nothing retries, so each pick sends one upload.
- **Unchanged by intent:** `save-state.ts`, the ordinary save and acknowledgement rules, the enhancement guards, the library editor, server actions and schema. `CASE_LIBRARY_DRAFT_PHOTOS_ON_WIRE` stays false, and the photo migration was not applied.

## Test approach

No DOM library is installed, so the test uses the repo's existing pattern: mock the React hooks and call the real component, here extended to child components. It uses the real reducer and real input handlers; the upload is a controlled promise. It calls no file upload, storage, Auth, browser, provider or database path.

## Cursor author-return verification (31 Oct 2026)

**Node:** `/usr/local/bin/node` → `v24.19.0`. **ROOT `node_modules`:** `/Users/robertsmith/dev/constructa-fresh-20261025/node_modules` (worktree-local symlinks to `vitest`, `vite`, `vite-node`, `@vitest`; no install). **Not run:** `next build`, full app vitest suite, Playwright, hosted upload/DB/auth.

**Temp/cache:** Requested env `TMPDIR=/Users/robertsmith/constructa-queue/tmp/cq-0442-a038-focused-verification` is not writable from the Cursor sandbox (`Operation not permitted` on mkdir). Vite/Vitest SSR cache used `$WT/.cq-cache-a038-verification` for the run, then removed; no `.tmp-test-run` under the worktree. Leftover (gitignored): `$WT/node_modules/` symlinks + `.vite`/`.vite-temp` from the run.

### Commands (literal argv) and raw stdout

```text
/usr/local/bin/node -v
→ v24.19.0

cd $WT && /usr/local/bin/node ./node_modules/vitest/vitest.mjs run src/app/dashboard/settings/case-studies/photo-upload-outcomes.test.tsx
→ RUN  v5.0.2 …/cq-0431-a038-upload-outcomes
→ Test Files  1 passed (1)
→ Tests  15 passed (15)
→ Duration  321ms
→ exit 0

/usr/local/bin/node ./node_modules/vitest/vitest.mjs run src/app/dashboard/settings/case-studies/save-state.test.ts
→ Test Files  1 passed (1)
→ Tests  41 passed (41)
→ Duration  247ms
→ exit 0

/usr/local/bin/node $ROOT/node_modules/eslint/bin/eslint.js src/app/dashboard/settings/case-studies/case-studies-client.tsx src/app/dashboard/settings/case-studies/photo-upload-outcomes.test.tsx
→ 4 warnings (@typescript-eslint/no-unused-vars: MapPin, Calendar, PoundSterling, userId in case-studies-client.tsx)
→ 0 errors
→ exit 0

/usr/local/bin/node $ROOT/node_modules/typescript/bin/tsc --noEmit --incremental false
→ (no output)
→ exit 0
```

**Baseline RED:** Not reproduced. Restoring blob `7bc1c110…` into a task-local copy under `$TMPDIR` without a minimal Vitest project would not prove counterexample without editing tracked source; skipped per task limits.

## Independent reviewer notes (for Claude grade of this doc + `946a25f` scope)

**Observed GREEN (this run):** 15/15 photo-outcome tests; 41/41 `save-state` tests; TypeScript clean; ESLint clean on changed paths (warnings only, pre-existing unused imports in client).

**Still not proven / out of scope:**

- Baseline client blob `7bc1c110…` failing the new test suite (RED) — desk-checked intent only.
- Browser React scheduling, StrictMode, real file inputs.
- Full three-photo hosted journey, wire flag, migration, storage lifecycle for orphaned uploads.
- Row React keys with missing/shared ids (photo path uses handles; card local state may still shift).

## Limits

- The harness is not a browser. Real React scheduling, StrictMode and file-input behaviour are not covered.
- After a failure, picking the same file again may not fire `change`, because the input keeps its value. Left unchanged as outside this minimal repair.
- A removed row's successfully uploaded file, or a superseded pick's file, stays in storage unreferenced.
- A pending upload raises no leave warning, and leaving drops its result. Changing that would alter `needsLeaveWarning`, which was out of scope.
- A late photo is an unsaved draft change. A save already running does not include it.
- Rows with missing or shared ids still have unreliable React keys, so `CaseStudyCard` local state may shift. Photos are handled by handle and are not affected.
- Photo arrays shorter than three entries can still gain holes on a higher slot, as before.
- Two tabs still overwrite each other; that known residual is unchanged.
