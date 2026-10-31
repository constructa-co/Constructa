FAIL - source repair is written, but no test, type check or lint ran, so nothing here is verified. A038 stays Partial and the hold stays.

# CQ-2210 A038 photo compatibility

Branch `cq/cq-2210-a038-photo-compatibility`, parent `24b9dcd`. Changes are uncommitted.

## Why FAIL

- Every test invocation was stopped by the session permission gate ("This command requires approval"), which nobody could answer in this non-interactive run. The forms tried were `node node_modules/vitest/vitest.mjs run <files>`, `npx vitest run <files>` and `npm test -- <files>`.
- No workaround was attempted.
- No RED run and no GREEN run exists. The tests were written before the source, but they have never executed.
- `tsc` and ESLint were not run. This worktree's `node_modules` holds only `@vitest`, `vite`, `vite-node` and `vitest`, so neither tool is present here.
- The only check was a hand trace of each new test through the code. That is not evidence of passing.

Commands to run:

```bash
npx vitest run src/lib/case-library/photo-compatibility.test.ts src/lib/case-library/boundary.test.ts src/lib/case-library/library.test.ts src/app/dashboard/settings/case-studies/photo-upload-outcomes.test.tsx src/app/dashboard/settings/case-studies/photo-accessibility.test.tsx src/app/dashboard/settings/case-studies/library-screens.test.ts src/app/dashboard/settings/case-studies/library/library-photo-persistence.test.ts
npx tsc --noEmit
```

For a true RED, run the same Vitest files with the new tests against the source at `24b9dcd`.

## Contract findings (source and migrations only, no live query)

| Route | Durable photo references today? | Evidence |
| --- | --- | --- |
| Older `profiles.case_studies` | Yes. Unvalidated jsonb, written with the contractor's own session to their own row. | `src/app/dashboard/settings/case-studies/actions.ts:49` |
| Upload | Yes. Server-derived `<user id>/case-study/<uuid>.<ext>`, with the first folder enforced as `auth.uid()`. The file type is checked by content bytes. | `src/app/storage/actions.ts:22`, `supabase/migrations/20260930210000_harden_phase1_storage.sql:42` |
| Older entry to proposal | Yes. `selectCaseStudies` keeps safe URLs only, at most three, and the document and PDF render them. | `src/lib/proposal-publication.ts:392`, `src/lib/proposal-document.ts:227` |
| Library `draft` / `approved` | No. `case_library_content_problem` accepts exactly twelve keys, and table CHECKs and both RPCs enforce it. | `supabase/migrations/20261012090000_case_library_foundation.sql:96` |

So the older route is the existing compatibility path and already carries three photos end to end in source. It needed no new wiring, only the repairs below. The older route has no revision lock: a save replaces the whole list. That is the documented, accepted residual and it is unchanged.

## Repairs

1. **Older editor could not take a photo off.** A wrong photo, such as one showing a client's house, could only be replaced, and it would stay in proposals. Each filled slot now has a named Remove button.
   - Only the screen copy changes until the contractor saves.
   - A pick still on its way for that slot is invalidated, so it cannot put a picture back. Handling for other slots, removed rows and latest pick is untouched.
   - The storage object is not deleted.
2. **False promise.** The library list and guided capture said photos could be added on the full form, but the full form says they are not available. Both now use `libraryPhotoHint()`, which follows `caseLibraryDraftPhotosOnWire()`, so the wording corrects itself when that switch is flipped. The refusal message also says where photos can go today.
3. **Silent picture loss at proposal.** Ticking a new version instead of its older job sent no pictures, and nothing said so. The review screen now shows a note with the job title, the older job's usable photo count and what to do. It does not block sending and does not change the snapshot. The same note appears in the pricing-experience notes.
4. **Start a new version** now says pictures aren't copied and stay on the older one.

## Deliberately not done

- `CASE_LIBRARY_DRAFT_PHOTOS_ON_WIRE` stays `false`; validators and migrations are unchanged; enhancement stays off.
- No borrowing of an older job's photos through `legacy_index` at publish. The approval check says "No pictures are shown for this job", and approval binds to exactly what was shown, so pictures added at publish would break that. They could also change after approval.
- No storing of library photos in another column, in text fields or by storage-folder convention. That would need new assumptions and would sit outside approval.

## Schema boundary

A library case study cannot hold a photo until the strict twelve-key `case_library_content_problem` on the applied database accepts `photos`. That is `supabase/migrations/20261028120000_case_library_photos.sql`, which is unapplied. No source change can cross this without weakening the validator.

After that migration is applied, source still needs work:

- flip the wire constant and send `photos` instead of `toLegacyWireContent`;
- make `approvedValue` keep photos. It drops them today while the SQL copy keeps whatever the draft holds, so `sameApprovedCopy` and `changesSinceApproval` would disagree with stored rows.

## Limitations

- Keyboard focus falls to the page after Remove, because the button unmounts. The status line does announce "Changes not saved."
- Removed photos remain as public objects in storage, reachable by anyone holding the URL. Any contractor-facing deletion claim would need separate work.
- A caption with no URL sent directly to the library action is dropped on the wire. The screens cannot produce this, because caption boxes are hidden while the switch is false.
- Mocks and source reading only. Real hosted three-photo upload, save, publish and PDF is not proven, and nothing here confirms which migrations are applied on the host.

## Files

Changed:
- `src/app/dashboard/settings/case-studies/case-studies-client.tsx`
- `src/app/dashboard/settings/case-studies/library-panel.tsx`
- `src/app/dashboard/settings/case-studies/library/guided-capture.tsx`
- `src/lib/case-library/messages.ts`
- `src/lib/case-library/past-jobs.ts`

Tests:
- `src/lib/case-library/photo-compatibility.test.ts` (new)
- `src/app/dashboard/settings/case-studies/photo-upload-outcomes.test.tsx`
- `src/app/dashboard/settings/case-studies/photo-accessibility.test.tsx`
- `src/app/dashboard/settings/case-studies/library-screens.test.ts`

No uploads, storage writes, live queries, provider calls, SQL, settings, credentials, deploys or commits.
