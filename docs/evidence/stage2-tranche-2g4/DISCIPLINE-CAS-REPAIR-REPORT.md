# Stage 2G.4 foundation: discipline revision repair

A scoped repair to the inactive foundation after its review. Two defects, one found by the reviewer and one found while reproducing. The schema is still unused by the application; nothing hosted, no provider, no dependency, no screen. Candidate for final exact review; not pushed, merged or deployed.

Written 8 October 2026 by the primary builder (Claude).

## 1. Pins

| | |
| --- | --- |
| Worktree | `/Users/robertsmith/Documents/GitHub/constructa-stage2g4-discipline-cas` |
| Branch | `claude/stage2g4-discipline-cas` (local only) |
| Base | `3e7c242f8c0231f80d3a3c6a436fd69850f453eb` (the first foundation candidate, unchanged in its own worktree) |
| Commit | the single commit that adds this file |
| Patch | `/Users/robertsmith/.codex/worktrees/stage2g-onboarding/stage2g4-discipline-cas.patch` |

## 2. Reproduced on the first candidate

One script, run against the migration as it was at `3e7c242`, then against the repaired one. It is not committed. Its output is below, complete except that a generated id is removed from one line.

Before:

```
shown to the contractor at revision 2: tags would be approved in the order Kitchens, Tiling
after the move, case study revision is 2
approval naming revision 2: {"outcome": "approved", "revision": 2}
approved label order: ["Tiling", "Kitchens"]
second stale rename: {"outcome": "saved"}
label now: Floor tiling
```

After:

```
shown to the contractor at revision 2: tags would be approved in the order Kitchens, Tiling
after the move, case study revision is 3
approval naming revision 2: {"outcome": "conflict", "revision": 3}
approved label order: (nothing approved)
second stale rename: {"outcome": "conflict", "revision": 2}
label now: Wall tiling
```

Two defects, both real:

1. **A move reordered what was approved.** Labels are approved in list order. Moving a discipline did not move the tagged case study's revision, so an approval naming the revision the contractor was shown went through and captured an order they had not been shown.
2. **A stale rename overwrote.** Two callers that had both loaded a discipline could each rename it; the second silently replaced the first. This is the reviewer's P2.

## 3. What changed

Only the migration (still unapplied anywhere, so edited in place) and its SQL suite, plus a note at the top of the earlier report.

- `contractor_disciplines.revision integer NOT NULL DEFAULT 1`, checked to be at least 1.
- `case_library_discipline_save(p_user_id, p_id, p_expected_revision, p_label, p_position)` and `case_library_discipline_archive(p_user_id, p_id, p_expected_revision, p_archived)`. The earlier forms do not exist: the suite asserts each name exists once with exactly these arguments, and that a call without a revision cannot be made.
- **Changing an existing discipline** must name the revision the caller was shown. A missing revision, `0`, or any other value is a **conflict**, returned with the current revision; nothing is changed. The check is made under the contractor's lock, after the row is found and before anything else about it is relied on (before the duplicate and limit checks).
- **Adding** is said twice and both must agree: `p_id` NULL and `p_expected_revision` `0`. No id with a missing or non-zero revision is `invalid`. Nothing is guessed.
- A new discipline is revision 1. A change that really alters the label, the position or the archived state moves the discipline's revision by one and returns it.
- **No-op rule, the same for both functions:** asking for what is already saved succeeds, returns the unchanged revision, and moves no revision anywhere. The revision is still checked first, so a stale caller asking for the current state is told it is stale.
- **Position now counts.** A move raises the revision of every case study tagged with that discipline, as a rename and an archive already did. It does so for every tagged study, including ones where the order of their own tags does not in fact change: the simple, safe rule.
- Another contractor's id is `not-found` whatever revision is named; the revision is not disclosed.

Unchanged: the three tables' other columns, constraints and access; the five case-study writers; the lock; limits; the content contract and its vectors; every TypeScript file. No revision types exist on the TypeScript side, so no vector or helper was added. `profiles`, grants, storage, freeze: untouched.

## 4. Verification actually run

| Check | Result |
| --- | --- |
| `npm run test:case-library-sql` | pass (171 assertions in the script, up from 132, plus the shell-level race checks) |
| The five other SQL suites, unmodified | pass |
| `bash scripts/test-replay-bootstrap.sh` | pass |
| `npx vitest run` | 80 files, 1,558 passed, 4 skipped. Unchanged from the first candidate: no TypeScript changed |
| `npx tsc --noEmit` | 0 errors |
| `npx eslint .` | 0 errors, 487 warnings, as before |

New in the SQL suite:

- **Signatures.** Each discipline writer exists once, in the versioned form; the unversioned calls fail and create nothing.
- **Serial.** Adding without `0`, or with a revision, is refused. A change with no revision, with `0`, or with a wrong one is a conflict reporting the current revision. First rename saved as revision 2; second, stale, refused; stale archive and stale move refused; the first rename stands. No-ops succeed without moving anything; a stale no-op is a conflict. Each real change moves the revision by one. A refused label or a duplicate at the right revision moves nothing. Another contractor gets `not-found` at any revision.
- **Order and approval.** Moving a tag moves the tagged case study's revision and no other study's. Approval of the order shown is refused; nothing is approved. Approval of the current revision captures the new order. A later move leaves the approved order as approved.
- **Parallel.** Six simultaneous changes naming one discipline revision (two renames, two moves, two archives): one saved, five conflicts, the revision moved once, and exactly one kind of change is stored.
- **Both orders, forced.** A move and an approval queued behind a held lock. Move first: move saved, approval refused, approved copy untouched. Approval first: approved at the revision shown in the order saved then; the move then saved and shows as a change since.
- The earlier assertion that a move does **not** move a case study's revision was wrong and is replaced.

**The suite bites.** Removing the revision check from the save function failed "a change that names no revision is a conflict". Restoring the old rule that only a rename moves tagged studies failed "moving a tag moves the revision of a case study tagged with it". The migration was restored byte for byte after each.

In this run the free-running tag-change and approval race landed tag-first in 3 rounds and approval-first in 9. It varies by run; the forced tests do not.

## 5. Limits and notes

- Moving a discipline marks every case study tagged with it as changed since approval, even when that study's own tag order is the same. Narrowing it would mean comparing orders per study; not done.
- Repositioning several disciplines is several calls, each naming its own revision. There is no bulk reorder.
- Limits of 12, 50 and 6 remain bounds I chose.
- **Mixed older-and-library selections over six:** the resolver reports the fact and is unchanged here. How a screen explains which are over, and by how many, belongs to the later client wiring. Today's silent cut for older-only selections is unchanged on purpose.
- **Freeze:** not built, not changed. `current_user = 'service_role'` is not adopted and is not a settled prescription; the role matrix still shows a `SECURITY DEFINER` path presents the owner.
- No hosted run. The hosted journey remains configuration-blocked for the earlier reason.

## 6. Not done

No push, PR, merge or deploy. No application code, screen, grant, policy, storage, freeze or AI change. No hosted read or write, secret, provider call or dependency. No new owner decision. The first candidate at `3e7c242` and every other frozen worktree are unchanged.
