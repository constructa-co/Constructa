FAIL - source and tests are written up to the OFF switch, but no test, type check or lint ran, so nothing here is verified. A038 stays Partial. The switch stays false.

# CQ-2222 A038 library photo wire preparation

Branch `cq/cq-2222-a038-library-wire-prep`, parent `319ce9d`. Changes are uncommitted.

## Why FAIL

Command execution needs CLI approval, which nobody can answer in this non-interactive run. These two were refused with "This command requires approval":

```bash
/usr/local/bin/node -v
/usr/local/bin/node node_modules/vitest/vitest.mjs run src/lib/case-library/content-wire.test.ts
```

- No other launcher was tried.
- There is no RED run and no GREEN run. The counterexamples below come from reading the code and were not executed.
- `tsc` and ESLint were not run.
- The only check was a hand trace of each new test through the code. That is not evidence of passing.
- This worktree's `node_modules` links only `@vitest`, `vite`, `vite-node` and `vitest`. The runner needs its own links for the rest (react, typescript and so on).

## Commands for the runner

GREEN, new and materially affected tests only:

```bash
node node_modules/vitest/vitest.mjs run \
  src/lib/case-library/wire-photos-on.test.ts \
  src/lib/case-library/content-wire.test.ts \
  src/lib/case-library/contract.test.ts \
  src/lib/case-library/photos.test.ts \
  src/lib/case-library/photo-compatibility.test.ts \
  src/lib/case-library/service.test.ts \
  src/lib/case-library/library.test.ts \
  src/lib/case-library/coherent-read.test.ts \
  src/lib/case-library/boundary.test.ts \
  src/lib/case-library/guided-state.test.ts \
  src/app/dashboard/settings/case-studies/library-screens.test.ts \
  src/app/dashboard/settings/case-studies/case-study-photo-journey.test.ts \
  src/app/dashboard/settings/case-studies/library/library-photo-persistence.test.ts
npx tsc --noEmit
```

RED, in a scratch copy only: in `service.ts` put `toLegacyWireContent` back at the three write calls, and drop the `onWire` branch in `approvedValue`. `wire-photos-on.test.ts` should then fail with `outcome: invalid, problem: keys` from the stand-in.

## What was wrong, and what changed

The two named defects:

| Defect at `319ce9d` | Counterexample (traced, not run) | Repair |
| --- | --- | --- |
| `service.ts` always sent `toLegacyWireContent` | Flag true: every create, save and start-from-older sends 12 keys, and the migration refuses with `keys` | One `toWireContent`: exactly 12 keys when false, normalised 13 keys when true. Used at all three write calls |
| `approvedValue` always dropped photos | Flag true: the screen shows no pictures, SQL `p_content \|\| ...` stores them, and approval reports `approvedDiffers` | `approvedValue` builds on `toWireContent`, so it keeps exactly the stored slots when true and has no `photos` key when false |

Defects found while tracing the enabled contract:

| Defect | Counterexample | Repair |
| --- | --- | --- |
| `changesSinceApproval` compared raw JSON | Flag true: a 12-key approved copy has `undefined` against three empty slots, so every older approval shows "the pictures" changed | Compares normalised slots |
| `approvedProblem` rebuilt the value before checking it | A copy with photos and an unknown key, four slots or bare strings passed, was accepted as `shown`, and a stored one resolved | New `contentProblemWithPhotos` and `storedPhotoSlotsProblem` read it as stored, with exact keys and exactly three slots |
| Tidying cut pictures without a word | Flag true: a fourth picture was dropped and a 2,001-character url was saved as a different, shorter url | `photoInputWouldBeCut`: refused as `photos` before any call. Only applied when true |
| TS accepted urls SQL refuses | `HTTPS://x`, `https:/x` and `http://localhost?x` parse, but the migration's case-sensitive regex refuses them | `photoSlotsProblem` applies the same regex |
| `ApprovedPreview` drew no pictures | Flag true: the contractor approves pictures they never saw | Renders the resolver's urls. Renders nothing when there are none |
| False wording when true | "Pictures can't be saved to the library yet" on a link error; "library case studies can't hold them yet" in review notes | Both words now follow the switch. False wording is byte-identical |

Start from older: `draftFromLegacy` already gives empty slots, so `startFromOlder` needed only the wire change. The older pictures are not copied, and the older entry is not changed. There is no `legacy_index` borrowing at approval or publish. Pictures added to the new version go through normal save and approval. When the new version has none, the review note says that and points to the older one. The existing panel wording ("Pictures aren't copied. They stay on the older one.") is true in both states.

## Seam

- `toWireContent` and `approvedValue` take `onWire = caseLibraryDraftPhotosOnWire()`, the same idiom as `libraryPhotoHint`.
- `boundary.test.ts` pins the literal `approvedValue(saved.content, labels)`, so the call sites did not change.
- `wire-photos-on.test.ts` mocks `caseLibraryDraftPhotosOnWire` and binds those two exports to `true`.
- The real service, status, resolver and past-jobs run against that mock.
- The mock does not change the constant, so the true path has never run with the real constant flipped. Do that once at flip time.
- `fake-library.ts` now validates per flag and writes out `case_library_approved_value` itself, so it cannot agree with `approvedValue` by calling it.

## False contract

The constant is still `false` at `content.ts:70`. With it false:

- Writes send exactly 12 keys.
- The approved copy has no `photos` key.
- A chosen url is refused with the same status, field and message.
- A four-slot list with no url is still accepted.

Three shared rules did tighten, and none is reachable with false on the applied schema:

- A url the regex refuses now fails in `contentProblem`, one step earlier, with the same result.
- `approvedProblem` is stricter only for copies that carry a `photos` key.
- Empty slots in a stored copy no longer count as a picture change.

## Remaining SQL and hosted boundary

`supabase/migrations/20261028120000_case_library_photos.sql` is unchanged and unapplied. Applying it as it stands will break live library rows. All of these come from reading the source:

1. **No backfill.** It replaces `case_library_content_problem` with a 13-key rule that also feeds `case_library_approval_problem` and `case_library_approved_problem`. The `case_studies_draft` and `case_studies_approved` CHECKs re-run on any UPDATE of a row. So any 12-key row raises on save, set-tags, approve or archive, and so does a discipline change that bumps tagged studies. The service reports those raises as "unknown". A companion migration must add three empty slots to `draft` and to non-null `approved`, in the same transaction.
2. **Not separable from the flip.** After the migration, a false build's 12-key create and save are refused with `keys`. A true build before it is refused too. The migration and the constant must go out as one release step.
3. **Its own proofs are missing.**
   - `scripts/test-case-library-sql.sh:229` expects `photos: []` to be refused as `keys`, but it will return `photos`.
   - `contract-vectors.json` has no valid-photo vectors, despite what the migration's header says.
   - Rule parity is proved only against this repo's stand-in, not real Postgres.
4. **Hosted unknowns.** Which migrations are applied on the host has not been checked. Real upload, save, approve, publish and PDF with three photos are unproven. No uploads, data writes or Send happened here.

## Limitations

- A photo edit that is undone still shows "Changes not saved", because `sameWording` compares the array by reference. Saving then returns "Already saved".
- Captions are stored and bound by approval, but proposals carry urls only.
- A draft that is too large is still reported in generic words (`too-large`).
- Removed photos stay as public storage objects.
- Guided capture has no photos question, so a refused photo there has no question to point at. Its slots are carried through saves untouched.

## Grading

The whole `319ce9d..final` diff needs a source grade before integration. Blob hashes at handover:

| File | Blob |
| --- | --- |
| `src/app/dashboard/settings/case-studies/library-screens.test.ts` | `23855e280e2c7d36c8163cc1548795c8202d88d4` |
| `src/app/dashboard/settings/case-studies/library/case-study-editor.tsx` | `079167abfa7bcfb924e309e7fce70e9f6da4bb6f` |
| `src/lib/case-library/__fixtures__/fake-library.ts` | `e2f9885c7db482a54bc46639a84d6318e09c54fd` |
| `src/lib/case-library/content-wire.test.ts` | `91621ac388ae02139549dd033a3600f9b8600a02` |
| `src/lib/case-library/content.ts` | `751b75bd6153ff484846edab995a66cef800fc73` |
| `src/lib/case-library/messages.ts` | `d1a026c7147d9509a680e58dc24a975d5840cff3` |
| `src/lib/case-library/past-jobs.ts` | `a20bca4233f779b573c60eb7e5d2a9acc524ef15` |
| `src/lib/case-library/photos.ts` | `10fc9134499ec92843e4d4eb21d1be1cce735224` |
| `src/lib/case-library/service.ts` | `34a2aa78c470620b218e754528b79d8d4074fd16` |
| `src/lib/case-library/status.ts` | `2a9ad4006b8a23af19cb47c924a3e0b1c9660e1c` |

`src/lib/case-library/wire-photos-on.test.ts` is new and untracked. Its hash was not taken, because `git hash-object` also needs approval.
