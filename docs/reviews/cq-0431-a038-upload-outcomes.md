# cq-0431 A038: legacy photo-upload outcomes and row identity

**Status: NOT VERIFIED. No test, type check or lint has been executed.** The repair and its test are written and desk-checked only. Baseline RED and repaired GREEN are both unproven.

Base: `b27539067fdc5882bbc617c58ad0af3508242772`. Owner: Claude CLI. Checker: Grok CLI.

This repair does NOT close A038's full three-photo hosted journey.

## Why nothing was executed

The session's permission layer required approval for every route to the tools, and the session is non-interactive, so each call was refused before running. These are the literal argv and raw outputs:

| argv | raw result |
| --- | --- |
| `/Users/robertsmith/dev/constructa-fresh-20261025/node_modules/.bin/vitest --version` | `This command requires approval` |
| `npx vitest run src/app/dashboard/settings/case-studies/photo-upload-outcomes.test.tsx` | `This command requires approval` |
| `node ../../node_modules/vitest/vitest.mjs --version` | `This command requires approval` |
| `npm run test -- --version` | `This command requires approval` |
| `/opt/homebrew/opt/node@24/bin/node -v` | `This command requires approval` |
| `/usr/local/bin/node -v` | `This command requires approval` |
| `node -v` | `v26.12.1` (PATH node; outside the repo's `>=24.19 <25` engine, so not used) |

The sandbox override and a subagent were not used to get around this. Whether a Node 24 binary exists at either tried path is not established.

The directions file `/Users/robertsmith/dev/constructa-private-20261027/rob0310-actual-directions-20261031.json` could not be read (outside the permitted directories). This work follows the task text only.

## Files

| file | state | hash |
| --- | --- | --- |
| `src/app/dashboard/settings/case-studies/case-studies-client.tsx` | modified, +34/-6 | baseline git blob `7bc1c110f26faf21cda13467f461933cfb8ae45f`; repaired hash not captured (`shasum`, `git hash-object` and `git diff --raw` needed approval) |
| `src/app/dashboard/settings/case-studies/photo-upload-outcomes.test.tsx` | new | not captured |
| `docs/reviews/cq-0431-a038-upload-outcomes.md` | new | not captured |

## The repair

- **Identity:** a client-only `rowHandles` ref, one handle per row in list order, changed only in `addCaseStudy` and `removeCaseStudy`. A stored `id` was deliberately not used: `src/lib/case-library/legacy.ts` records that ids can be missing or shared, and rows are not validated on load. Handles are never saved and entries are not changed.
- **Placement:** when the reply arrives, the row is found by handle and the photo is written through the existing `edit` action as a functional change, so the latest text, other slots and other rows are kept.
- **Same slot:** the latest pick for a row and slot wins; a reply from an older pick is dropped silently.
- **Removed row:** the result is discarded and an error toast says so.
- **Failures:** a thrown upload is caught and reported in fixed wording without the transport's own text. Returned failures keep the existing wording. Nothing retries, so each pick sends one upload.
- **Unchanged by intent:** `save-state.ts`, the ordinary save and acknowledgement rules, the enhancement guards, the library editor, server actions and schema. `CASE_LIBRARY_DRAFT_PHOTOS_ON_WIRE` stays false, and the photo migration was not applied.

## Test approach

No DOM library is installed, so the test uses the repo's existing pattern: mock the React hooks and call the real component, here extended to child components. It uses the real reducer and real input handlers; the upload is a controlled promise. It calls no file upload, storage, Auth, browser, provider or database path.

Expected from reading the code, **not observed**:

- RED on baseline: row moved, removed row, shared or missing ids, added row, two slots in either order, same-slot ordering, and thrown failures.
- Probably GREEN on baseline: retained text with the existing photo in a single row (the old write used `prev` for text, and no earlier-row removal occurs), returned failures, the save-rules case, and the flags case. These guard against regression and do not demonstrate the defect.

## Commands still to run

From this worktree, with Node 24 first on PATH. Run the first on the baseline client to record RED, for example from a temporary WIP commit, then on the repaired client:

```
../../node_modules/.bin/vitest run src/app/dashboard/settings/case-studies/photo-upload-outcomes.test.tsx
../../node_modules/.bin/vitest run src/app/dashboard/settings/case-studies
../../node_modules/.bin/eslint src/app/dashboard/settings/case-studies/case-studies-client.tsx src/app/dashboard/settings/case-studies/photo-upload-outcomes.test.tsx
../../node_modules/.bin/tsc --noEmit --incremental false
```

## Limits

- The harness is not a browser. Real React scheduling, StrictMode and file-input behaviour are not covered.
- After a failure, picking the same file again may not fire `change`, because the input keeps its value. Left unchanged as outside this minimal repair.
- A removed row's successfully uploaded file, or a superseded pick's file, stays in storage unreferenced.
- A pending upload raises no leave warning, and leaving drops its result. Changing that would alter `needsLeaveWarning`, which was out of scope.
- A late photo is an unsaved draft change. A save already running does not include it.
- Rows with missing or shared ids still have unreliable React keys, so `CaseStudyCard` local state may shift. Photos are handled by handle and are not affected.
- Photo arrays shorter than three entries can still gain holes on a higher slot, as before.
- Two tabs still overwrite each other; that known residual is unchanged.
