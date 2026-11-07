# Stage 2G.4 (G4A2): approval read repair

A bounded repair to the client candidate after the integrator reproduced an approval-read race. No schema, SQL, grant, storage, AI or hosted change; the migration and SQL scripts are byte-for-byte as at the candidate. Fixture and unit evidence only. Not pushed, merged or deployed. For final delta review; I am not approving it.

Written 8 October 2026 by the primary builder (Claude).

## 1. Pins

| | |
| --- | --- |
| Worktree | `/Users/robertsmith/Documents/GitHub/constructa-stage2g4-approval-read-repair` |
| Branch | `claude/stage2g4-approval-read-repair` (local only) |
| Base | `e049b4a71837fe6e196e313a49f9f5f189d55781` (the client candidate, unchanged in its own worktree) |
| Commit | the single commit that adds this file |
| Patch | `/Users/robertsmith/.codex/worktrees/stage2g-onboarding/stage2g4-approval-read-repair.patch` |

## 2. The defect

The approval check read the case-study row, its tags and the contractor's kinds of work as separate reads started together. Each sees the database at its own moment. If a kind of work was renamed (or archived, or moved, or the tags replaced) between them, the check could show the **old** labels beside the **new** revision number. The approval then named that new revision, the database accepted it, and stored the **new** labels. The contractor approved something they were not shown.

My candidate's revision check did not catch this because the revision it named was already the new one. The fault was mine: I treated side-by-side reads as one picture.

The same mixed read fed the save (`saveStudy`) and the edit page's first load, where it could have led to "already saved" being said against the wrong tags, or to a wording-only save putting back tags that had been changed elsewhere.

## 3. Reproduction, before and after

**Before**, the integrator's script `G4A2-APPROVAL-READ-RACE-REPRO.cjs`, run unmodified against the frozen candidate (read only; that worktree is still clean):

```
displayedRevision 3 · displayedLabels ["Old label"] · approvedStatus "approved"
displayed copy disciplines ["Old label"] · actually approved disciplines ["New label"] · mismatch true
```

**After**, two runs against this head:

1. The same script, pointed at this worktree, now stops at its own assertion that the approval succeeded: the approval returns `conflict`.
2. `G4A2-APPROVAL-READ-RACE-REPRO-AFTER.cjs` (beside the original; same forced stand-in, but sending back what the check showed, as the repaired screen does):

```
displayedRevision 3 · displayedLabels ["Old label"] · approvalStatus "conflict"
"This changed after you opened this check. Nothing was approved. Look at the latest below and check it again."
databaseApprovalCalls 0 · storedApprovedCopy null · staleVersionApproved false
```

Both are deterministic in-memory interleavings, not a hosted race.

One thing about that stand-in should be said plainly. It answers the label read with pre-rename labels even when that read is made after another read has already seen the rename. With every read going to one database, that ordering cannot happen once the reads are bracketed (section 4a). So on its own the bracket would not have changed the script's outcome, and I did not want a repair that only held under an assumption. The second binding (section 4b) is what makes the script's scenario fail, whatever order the reads come back in.

## 4. The repair: two bindings

### 4a. One revision, by a bracketed read

`readStudyAtOneRevision` in `src/lib/case-library/store.ts`, used by the approval check, the save, the read before approving, the follow-up reads after a lost answer, and the edit page's first load:

1. read the case study's revision, and wait for the answer;
2. only then read the row, its tags and the kinds of work;
3. only when those have all answered, read the revision again.

**Why this is sound.** Every change an approval would capture (the draft, the tags, a tag's label, place or archived state) raises the case study's revision in the same database transaction, and a revision only goes up. That is the accepted SQL, unchanged. So if the revision at step 3 equals the one at step 1, and the row read in between shows that same revision, no such change was committed between steps 1 and 3, and everything read in step 2 is as it stood at that revision.

**Bounded.** If they differ it reads again, at most 3 times (at most 12 reader calls, 15 queries). If it never settles it returns "changing" and nothing else. Any failed read returns "unavailable". There is no loop without a limit.

**After the bracket.** A change that lands after step 3 is not seen by the read. It is caught when the contractor acts, because every write names the revision.

**What "changing" does.** The approval check shows nothing and says the case study is being changed elsewhere. A save writes nothing and says the same, with the typed wording kept. The edit page asks the contractor to open it again. A follow-up read after a lost answer that cannot settle is reported as not known.

### 4b. Approval is held to what was shown

The approve action now requires the approved copy the check screen displayed to be sent back with the revision. Before any write, the server reads the saved copy again (bracketed), works out the copy an approval would make, and refuses unless:

- the revision is the one named, and
- that copy is identical to what was shown: every field a client would see, and the tag labels in order.

Only then is the database asked, and it still approves only if the revision has not moved. A missing or malformed "shown" is refused before anything is read. After a successful approval, if the stored approved copy can be read and is not what was shown, the answer says so instead of a plain "Approved".

This is why the integrator's scenario now fails: the check showed "Old label", the server's own read gives "New label", they are not identical, and the database is never asked.

### 4c. Save and other consumers

- `saveStudy` compares against the bracketed read only. "Already saved" needs the wording and the tags from one revision to match. A wording-only save from a stale screen is a conflict; it never writes tags.
- The edit page now starts the editor from a bracketed read, so the revision and tags it holds belong together.
- Not changed, and why: the library list reads everything side by side for display. Its status line could be momentarily out of step; the only action from it that names a revision is archive, which does not depend on tags and is still checked by the database. The proposal read takes approved copies, each a complete value in one row, so it cannot be mixed.

Unchanged throughout: sign-in then switch then validation before the privileged client; own-session reads; publication guards and hashes; older-only parity; the editor keeping typed text; the default-off switch and the single A+B candidate.

## 5. Changed files

`src/lib/case-library/store.ts` (the revision read and the bracketed read), `service.ts` (uses it; approval holds to the shown copy), `messages.ts` (three messages), `__fixtures__/fake-library.ts` (the revision read); `library-actions.ts` and `library/case-study-editor.tsx` (pass the shown copy); `library/[id]/page.tsx` (bracketed first load); the fixture harness action file and spec; tests: new `coherent-read.test.ts`, and additions to `store.test.ts`, `service.test.ts`, `boundary.test.ts`, `library-actions.test.ts`. Evidence: one new pair of screenshots, six renumbered.

`supabase/` and `scripts/` have no changes.

## 6. Verification actually run

| Command | Result |
| --- | --- |
| `npx vitest run` | 89 files, 1,854 passed, 4 skipped (1,770 at the candidate) |
| `npx tsc --noEmit` | 0 errors |
| `npx eslint .` | 0 errors, 487 warnings, unchanged |
| `npm run test:case-library-sql` | pass, script unmodified |
| `npm run e2e:import-fixture` | 21 of 21 across desktop, phone and keyboard, including the production build |
| Integrator's reproducer on the frozen candidate | reproduces (section 3) |
| Same, and the after variant, on this head | approval refused, nothing stored |

**New permanent tests** (`coherent-read.test.ts`, 69). Reads are held and released by the test, and a read sees the library as it is when released, so a change can be committed between any two reads in any order the code allows.

- The old pattern, started side by side, does pair old labels with the new revision; and the database, asked by revision alone, does then store the other labels. That mixture is now refused when sent back.
- The bracketed read cannot be driven into that order: no label read is waiting until the revision read has answered. Its order is asserted.
- For each of five changes (a tag renamed, archived, reordered; the tags replaced; the wording edited) and each of seven places in the read sequence, including both orders of the row and label reads: what is approved equals what was shown, or the approval is refused and nothing is stored. 35 cases.
- A case study that never holds still: "changing" after exactly 12 reader calls; the check is refused; a save writes nothing.
- Each of the four reads failing: "unavailable", nothing shown.
- Save: tags replaced elsewhere at four points during its read, and after it: always a conflict, the other change kept, no tags written. "Already saved" not said when the tags no longer match.
- Shown-copy binding: stale labels at the current revision refused; five malformed "shown" values refused before any read; six altered copies (a label, the order, one fewer, wording, client, price) refused; the unaltered copy approved and stored exactly; a change after the server's read refused by the database; an unsettled read before approving approves nothing.

**The real queries** (`store.test.ts`, 11 new). The actual `sessionReader`, over a stand-in that answers each query from tables as they are at that moment, with a change committed before any chosen query:

- the five queries of one attempt are asked in order: revision; row; tags; kinds of work; revision;
- a rename, an archive and a tag replacement, committed before each of the first ten queries: the result is always entirely before or entirely after, never old labels with the new revision; and it is "after" exactly when the change fell inside the first attempt;
- the row-and-tags read on its own is shown to mix (old revision, new tags), which is why it is no longer used alone;
- a case study changing in every attempt: "changing" after exactly 15 queries;
- each of the five queries failing: "unavailable".

**Browser fixture.** One new step on the real editor: with the check open, a kind of work is renamed elsewhere; the tick and Approve are refused with "This changed after you opened this check. Nothing was approved."; the check reloads showing the new label with the tick cleared; nothing is stored. Renamed back, it is refused once more, then approved.

**The tests bite.** With the bracket's revision comparison removed, 28 tests fail. With the shown-copy comparison removed, 9 fail. Both files were restored byte for byte.

## 7. Residuals

- **The bracket assumes one database.** Its argument needs each later read to see everything committed before an earlier read answered. That holds when all reads go to the same database. If reads were ever spread across replicas that lag, the bracket alone would not be enough; the shown-copy binding would still refuse a mismatch between the check and the server's read before approving, and if both were stale the same way, the approval would go through and the answer would say the approved copy differs. That last case is reported, not prevented. Whether the hosted data API reads from one database was not checked.
- **One read strategy was considered and not used.** Reading the row, tags and labels in a single query would be one picture by construction. I could not verify the data API's nested-select behaviour for these tables without a hosted or local API, so I did not rely on it.
- The library list's status line can be briefly out of step, as described in 4c.
- An approval now costs one extra bracketed read before the database is asked.
- A direct caller of the approve action must send the shown copy. The screen does.
- All earlier residuals stand: the older editor's whole-list save, direct writes to the older list, positional identity, two-call saves, no hosted run.
- Nothing here is hosted evidence. No hosted project was contacted.

## 8. Not done

No push, PR, merge or deploy. No schema, SQL, grant, storage, AI or dependency change. No hosted read or write, secret or provider. Frozen worktrees, including `e049b4a` and `63ca10f`, are unchanged. The after-variant reproducer was written to the hand-off directory beside the original, outside the repository.
