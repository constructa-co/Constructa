# Stage 2G.3.1 repair: source binding of interview drafts

- Finding: Codex, against frozen head `4f54d54b14f0a129474927f376999635401fac7d`
- Base of this repair: that exact head. The original branch and worktree are untouched.
- Branch: `claude/stage2g3-source-binding-repair`, own worktree `constructa-stage2g3-source-binding`
- Repair commit: `7f9dfb7f5af3c9110172f7d30c7733e269f8b435`. This report is the commit after it.
- Patch, the two commits on top of `4f54d54`: `/Users/robertsmith/.codex/worktrees/stage2g-onboarding/stage2g3-source-binding-repair.patch`
- Local only. Not pushed. No hosted migration, provider call, deploy or production change.

This is a repaired candidate for review. It is not a claim of acceptance:
Kimi's review of the original head was still running when this was written,
and may add findings this repair does not address.

## The defect, confirmed

`buildDraft` read the answers, built the text and facts, then called
`company_narrative_save_draft`, which took the answers fingerprint at insert
time. The advisory lock inside the function did not cover the earlier read.
An answer saved in that gap left **old text stored under the new
fingerprint**, and approval, comparing fingerprints, accepted it.

Reproduced before any fix, two ways:

1. **Service, with a deterministic barrier.** The fake database gained
   `beforeNext(name, run)`, which runs something once just before the next
   call to a function reaches it. `source-binding.test.ts` was written
   against the unfixed service: **11 of 12 tests failed** (the one that passed
   checks the unrelated saved-introduction conflict).
2. **Real SQL, original migration, throwaway Postgres.** Save answer
   revision 1; save revision 2; call `save_draft` with text written from
   revision 1; approve. Output:

   ```
   draft fingerprint equals CURRENT answers fingerprint: true
   approval of the stale text: applied
   profile now says: Alpha Builders specialises in kitchen fitting.   (saved answer is: Roofing only)
   ```

## The second question: the business name

Also confirmed. The introduction embeds `company_name`; `based_on` recorded
only that the field was used; approval compared `capability_statement` and
nothing else. A name changed on the Profile form during or after drafting
would have been saved into the introduction as if current.

## The fix

**1. The sources are stated and compared before anything is written.**
`company_narrative_save_draft` takes a new required
`p_expected_fingerprint`: the fingerprint of the sources the text was
written from. Under the contractor's advisory lock, and with their profile
row locked `FOR UPDATE`, it recomputes the fingerprint from its own tables.
If they differ it returns `stale-source` **before** retiring or inserting
anything. If they match, the draft is stamped with that same value. A draft
can no longer carry a fingerprint other than the one its text was written
from.

**2. The business name is part of the sources.**
`company_interview_fingerprint` now covers every answer's revision and skip
state **and** the saved business name. A changed name therefore makes a
draft stale exactly as a changed answer does: the screen shows it as out of
date, approval returns `stale-answers`, and the service rebuilds with the
current name.

**3. Approval holds the profile row.** `company_narrative_approve` locks the
profile row before the source check, so the name cannot change between the
check and the write.

**4. Bounded retry in the service.** On `stale-source` the service reads
again and rewrites, at most three attempts (`DRAFT_ATTEMPTS`). If the
sources are still moving it saves nothing and says so.

**5. Two checks, kept distinct.**

| Check | Question | Where | On mismatch |
| --- | --- | --- | --- |
| Source binding | Was this text written from the answers and business name as they are now? | `save_draft` and `approve`, by fingerprint | `stale-source` / `stale-answers`; rebuild |
| Replacement baseline | Does the profile still hold the introduction (or fact) the contractor was shown beside the draft? | `approve`, by `p_expected_existing` | `conflict`; show the newer value |

The saved introduction is not a source: changing it does not make a draft
stale, it makes the approval a conflict. A test asserts both halves.

**6. Who derives the fingerprint.** The server derives it from the rows it
read (`sourceFingerprint` in `service.ts`); the database derives it again
from its own tables. No server action accepts one from the browser, and the
browser roles cannot execute the functions. A test passes forged values in
the request and shows they are ignored.

## Files

| File | Change |
| --- | --- |
| `supabase/migrations/20261008090000_company_interview.sql` | Fingerprint covers the business name; `save_draft` takes and checks the expected fingerprint, locks the profile row, returns `{outcome, draft}`; `approve` locks the profile row. Edited in place: never applied anywhere |
| `src/lib/company-interview/service.ts` | `sourceFingerprint` replaces `answersFingerprint`; `buildDraft` states its sources and retries, bounded |
| `src/lib/company-interview/__fixtures__/fake-db.ts` | Mirrors the SQL; `beforeNext` barrier |
| `src/lib/company-interview/source-binding.test.ts` (new) | 12 tests |
| `src/lib/company-interview/service.test.ts` | One test updated for the renamed function |
| `scripts/test-company-interview-sql.sh` | Source-binding regressions and two real two-session races |
| `e2e/import-fixture/app/interview/actions.ts`, `interview.fixture.ts` | Race and business-name scenarios |

No screen, action, question, template, AI or profile-rewrite code changed.
The only contractor-visible change is the wording of the stale message,
which now mentions the business name.

## Evidence

| Required | Proof |
| --- | --- |
| Narrative answer changed during generation | `source-binding.test.ts` case 1; SQL "an answer in the narrative changed"; browser spec |
| Offered-fact answer changed | Case 2 (memberships) and case 3 (year behind years trading); SQL |
| Answer skipped / new answer during generation | Cases 4 and 5; SQL |
| Same answer saved again concurrently | "the same answer saved again…": new revision, same words, still refused and rebuilt; SQL |
| No insert or supersede on stale rejection | SQL helper compares the contractor's whole draft table before and after each refused save; service test "rejects the stale save outright" |
| Bounded | Same test: exactly three attempts, then failure with nothing stored |
| Fresh retry succeeds | "a fresh attempt after the sources settle…"; SQL "a save written from the current sources succeeds" |
| Approval and publication carry no stale content | Each service case approves everything, then builds a snapshot with the real `buildProposalPublicationSnapshot`; SQL approves and checks the profile |
| Business name during and after drafting | Service case 6 and "the business name is a source too"; SQL; browser spec |
| Baseline kept distinct from source binding | "the saved introduction being replaced is a separate check…"; SQL "the saved introduction is not one of the sources" |
| Fingerprint not browser-authoritative | "the fingerprint is the server's"; SQL: missing or non-fingerprint value raises, a made-up one matches nothing, browser roles denied |
| Real concurrency | SQL `race`: session A changes a source inside an open transaction; session B's save, written from the earlier read, must wait and is then refused with nothing stored. Run for an answer save (advisory lock) and a business-name change (profile row lock) |

## Checks

On commit `7f9dfb7f5af3c9110172f7d30c7733e269f8b435`, on this machine.

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | Pass |
| `npx vitest run` | 67 files; 1075 passed, 4 skipped, 0 failed (1063 before; 12 new) |
| `npx eslint .` | 0 errors |
| `npx next build` (no harness present) | Pass |
| `npm run test:company-interview-sql` | Pass, throwaway local PostgreSQL 14 |
| `npm run test:company-import-sql` | Pass |
| `npm run e2e:import-fixture` | 9 passed: interview and both import scenarios on desktop, phone, keyboard |

Browser spec additions: an answer is changed in the instant the draft is
being built (two saves reach the database, one refused, one accepted, and
the only stored draft has the newer answer); and the business name is
changed after the draft is shown (nothing saved, draft rebuilt with the new
name). Nine checkpoints, zero layout or accessibility findings; screenshot
`07-interview-business-name-changed` is new and later ones are renumbered.

Not proved here, as before: nothing ran against a hosted database, the
full migration chain, the pinned Supabase image, or a real provider.

## Notes and remaining risks

- **`node_modules`.** A symlink to the existing worktree's dependencies was
  tried first, as asked. The Next build refuses it ("Symlink
  node_modules is invalid, it points out of the filesystem root"). This
  worktree therefore uses an APFS copy-on-write clone of the same folder:
  no install, and no additional disk blocks until something changes.
- **Any business-name change stales a draft**, including a draft that does
  not name the business (no `work` answer). That is deliberately coarse: a
  rebuild is cheap and the alternative is tracking which sources each
  sentence used.
- **Other profile fields are not sources.** The template reads only the
  business name from the profile. Offered facts compare against the profile
  for display and at approval (the baseline check), but are written from
  answers alone.
- **The SQL race test relies on timing** (a 1.5 s open transaction, a 0.5 s
  head start). A slow machine could start session B before session A holds
  its lock; B would then save and the test would fail, not falsely pass.
- **The column is still named `answers_fingerprint`** though it now covers
  the business name. Renaming was left out to keep the change small.
- **The fake database mirrors the SQL by hand**; the SQL test is the
  authority.
- The original `BUILDER-REPORT.md` is unchanged and describes `4f54d54`.
  Where it says the fingerprint is "taken inside `save_draft`", this
  document supersedes it.
