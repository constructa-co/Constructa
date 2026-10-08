# Stage 2G.4 foundation (G4A1): builder report

An **inactive** schema and pure-domain foundation for the case-study library. It is not a case-study workflow. No screen, action, navigation, proposal path, grant, policy, storage or AI setting is changed, and nothing in the application reads or writes what this adds. No hosted project was contacted, no provider called, no dependency added. Candidate for independent review; not pushed, merged or deployed.

Written 8 October 2026 by the primary builder (Claude). The final design text is a separate document, `STAGE2G4-CLAUDE-DESIGN-FINAL.md`, outside this repository.

> **Superseded in two places by `DISCIPLINE-CAS-REPAIR-REPORT.md`.** After review, the two discipline writers now take an expected revision, and moving a tag in the list now moves the revision of case studies tagged with it. Where this report describes those functions' arguments or says which changes move a revision, the repair report is the current statement. The test counts below are those of the first candidate.

## 1. Pins

| | |
| --- | --- |
| Worktree | `/Users/robertsmith/Documents/GitHub/constructa-stage2g4-foundation` |
| Branch | `claude/stage2g4-foundation` (local only) |
| Base | `c6084a1cb06f6ed66e8f6e52102e8df9c3735724` (accepted F1a, unchanged) |
| Commit | the single commit that adds this file |
| Patch | `/Users/robertsmith/.codex/worktrees/stage2g-onboarding/stage2g4-foundation.patch` |

## 2. What was added

| File | What it is |
| --- | --- |
| `supabase/migrations/20261012090000_case_library_foundation.sql` | One forward migration. The 110th; no version collision |
| `src/lib/case-library/content.ts` | Content rules, approved copy, safe defaults |
| `src/lib/case-library/labels.ts` | Label key, suggestions from the setup answer, exact tag grouping |
| `src/lib/case-library/legacy.ts` | Reader for the older `profiles.case_studies` entries, as the product treats them today |
| `src/lib/case-library/resolve.ts` | The shared selection resolver |
| `src/lib/case-library/__fixtures__/contract-vectors.json` | 93 synthetic vectors run through both the TypeScript and the SQL rules |
| `src/lib/case-library/contract.test.ts`, `library.test.ts` | 102 and 49 unit tests |
| `scripts/test-case-library-sql.sh` | SQL suite on a throwaway local Postgres |
| `package.json`, `.github/workflows/ci.yml` | One script and one CI step for that suite |

No existing source file is edited. `selectCaseStudies`, the Case Studies page, the profile action and the proposal path are byte-for-byte as accepted.

### The migration

Three tables: `contractor_disciplines`, `case_studies`, `case_study_disciplines`. No asset table.

- **Tenant boundary by constraint.** `UNIQUE (id, user_id)` on the first two; the link table's foreign keys are over `(case_study_id, user_id)` and `(discipline_id, user_id)`. The SQL suite shows the service role itself cannot link across contractors by writing the table directly.
- **Access.** Row-level security on all three. `authenticated` may `SELECT` its own rows and nothing else. `anon` and `PUBLIC` have nothing. `service_role` has the tables.
- **Functions.** Fifteen: seven rule functions and a lock helper used by the tables' checks and the writers, and seven writers: `case_library_discipline_save`, `case_library_discipline_archive`, `case_study_create`, `case_study_save_draft`, `case_study_set_disciplines`, `case_study_approve`, `case_study_archive`. **None is `SECURITY DEFINER`.** They run with the caller's privileges, and only `service_role` may execute them, so there is no privilege to borrow. All have an empty search path and fully qualified names. `EXECUTE` is revoked from `PUBLIC`, `anon` and `authenticated` explicitly.
- **Why each writer exists.** Create, save and approve are the minimum for a draft that becomes approved. Set-disciplines and the two discipline functions are the minimum for tags that an approval can capture by value. Archive exists because rows that a sent proposal was built from must be retirable without deletion.
- **Locking.** Every writer takes one per-contractor advisory lock first, before reading anything it relies on, then the case-study row, then any discipline rows. One lock per contractor means all of a contractor's writers are serial. No loops; every list is checked for size before it is unpacked.
- **Limits.** 12 active disciplines, 50 unarchived case studies, 6 tags per study, one live adoption per older entry (also a unique index).
- **Revision.** Moves on a draft save, a tag change, a tag rename, a tag archive or return, and a study archive or return. Approval names a revision, re-reads the draft and active labels under the lock, and stores one complete copy.
- **Approved copy.** The draft plus the labels as strings. A hidden client's name and an unshown figure are blanked. A table check refuses an approved copy that still carries either. Approval does not change the draft, the client choice, any project or any selection.
- **Adoption, smallest form.** `case_study_create` may be told the place of an older entry. The database reads `profiles.case_studies` itself, refuses a place that is not an object, and stores the place and `md5` of what it read. The caller is not trusted to describe the entry and the entry is not changed. Hiding an older entry is deferred.

`profiles` is not touched: the suite compares its rows, privileges, policies and triggers before and after.

### The content contract

Exactly twelve keys, all present. **An unknown key is refused on both sides, not dropped.** A separate helper, `contentFromInput`, builds clean content from loose input by reading known fields only. Lengths are counted in characters as the database counts them, so 200 emoji is 200. Line breaks and tabs are allowed only in the two long text fields. Labels compare by A to Z only, on purpose: `lower()` gives different answers for other letters depending on how a database was created, and the application and every database must agree.

### The resolver

- A library tick is `lib:<uuid>`. Every other saved value, including a bare uuid, is an older tick and goes unchanged to today's `selectCaseStudies`.
- With no library ticks the result equals today's exactly, whatever library rows exist.
- A library tick that is malformed, missing, archived, unapproved or has a malformed approved copy makes the result unsendable with a reason and no case studies.
- A row for another contractor is refused outright.
- An older entry whose own id is literally a library tick keeps today's meaning unless a library row also answers to it; then it is ambiguous and unsendable.

## 3. Verification actually run

| Check | Result |
| --- | --- |
| `npx vitest run src/lib/case-library` | 151 pass (102 contract, 49 library) |
| `npx vitest run` | 80 files, 1,558 passed, 4 skipped (pre-existing skips) |
| `npx tsc --noEmit` | 0 errors |
| `npx eslint .` | 0 errors, 487 warnings, none in the new folder |
| `npm run test:case-library-sql` | pass |
| The five existing SQL suites, unmodified | pass |
| `bash scripts/test-replay-bootstrap.sh` | pass |
| Migration versions | 110 files, no duplicate version |

No browser fixture was run: there is no new screen, so there is nothing for one to show.

**Unit tests cover:** all 93 vectors on the TypeScript side; every rule code; defaults; loose input rebuilt from known fields only; the older-entry reader including empty ids, untitled entries, shared ids and an id that is another entry's place, each checked against what `selectCaseStudies` really does; drafts from older entries hide the client, show no figure and take no pictures; suggestions bounded; exact tag grouping with realistic mismatched vocabulary, including that a framing case study is never put forward for a kitchen job; chips working with free-text disciplines; resolver parity over 18 selections and 5 malformed stored lists, with and without library rows; a bare uuid never hijacked; every unsendable reason; the ambiguity case; the six-study limit; that nothing outside the folder imports it, names the new tables or functions, and that the folder reaches no database or network.

**The SQL suite proves**, against the real migration:

- Nothing existing changed, and no existing case study was copied.
- The SQL rules give the listed answer for all 93 vectors, including the approved copy being equal to the application's.
- Functions: fifteen, none `SECURITY DEFINER`, all with an empty search path, none executable by a browser role or `PUBLIC`.
- Browser boundary: a contractor reads their own rows; cannot insert, update or delete any of the three tables; cannot call any writer, the lock, or a rule function; another contractor sees none of it; a signed-out visitor can read nothing.
- Limits and duplicates, in sequence and with eight writers at once: exactly one fits.
- Six simultaneous saves of one revision: one wins.
- Six simultaneous adoptions of one older entry: one wins.
- Approval: needs confirmation; refused for a moved revision and for another contractor; holds labels by value; blanks a hidden client and unshown figure; leaves the draft, the profile and the older entries unchanged.
- After approval, a draft edit, a tag change, a tag rename and a tag archive each move the revision and leave the approved copy as it was. An approval naming the earlier revision is refused. Re-approval captures the new words and omits the archived tag.
- A tag change and an approval naming the same revision, simultaneously, twelve rounds: always consistent. In this run the approval landed first every time, so each order was also forced once by holding the contractor's lock while both queued; both outcomes are asserted.
- A rolled-back transaction leaves nothing.
- Adoption: fingerprint equals `md5` of the stored entry computed independently; bad places refused; the older entry unchanged.

**I checked that the suite bites** by breaking the migration three times and restoring it. Without the contractor lock, eight simultaneous disciplines at the limit gave three saved instead of one. Without the revision move on a tag change, the stale-tab test failed. Without blanking the hidden client, the approved-copy vector test failed.

## 4. Role matrix for a possible later freeze

No trigger is installed. The suite ends by recording what a trigger could see, from a login role that may act as either the browser role or the service role.

| Path | `current_user` in an ordinary trigger function | Role setting |
| --- | --- | --- |
| Browser role, direct or via an ordinary function | `authenticated` | `authenticated` |
| Service role, direct or via an ordinary function | `service_role` | `service_role` |
| Browser role via a `SECURITY DEFINER` function | the function's owner | `authenticated` |
| Service role via a `SECURITY DEFINER` function | the function's owner | `service_role` |

Also observed: a `SECURITY DEFINER` trigger function sees only its own owner on every path; `session_user` is the login role on every path; the claim setting can be set by the session itself; and SQL in such a session can switch its own role.

So `current_user = 'service_role'` would refuse browser writes and allow direct service-role writes, but would also refuse a service-role write made through a `SECURITY DEFINER` function, and cannot tell that from a browser write through the same function. It is not adopted. The final design lists what a freeze design must contain before one is built.

Limits of this matrix: it is a local Postgres with roles set up as the hosted data API is documented to use them. Whether the hosted project matches was not checked.

## 5. What this is not

- **Not a workflow.** A contractor cannot see, create, tag or approve anything. There is no page.
- **Not wired.** The review screen and publication still read only the older list. The resolver exists and is tested, and nothing calls it.
- **Not a freeze.** The older JSON is still writable by the Case Studies page and by a signed-in session directly. Positional ticks can still drift.
- **Not a migration of data.** No older case study is copied, changed or removed.
- **No pictures.** No asset table, no upload change, no image treatment.
- **Not verified hosted.** The hosted journey remains configuration-blocked for the earlier reason. Applying this migration anywhere is a separate, owner-gated step, and would change no behaviour.

## 6. Known limits

- Limits of 12, 50 and 6 are bounds I chose, not product decisions.
- Label comparison folds A to Z only. "Élan" and "élan" are different labels.
- A draft made from an older entry cuts over-long older text to what a draft can hold.
- The resolver's "older ticks that matched nothing" list is informational and approximate; it does not affect what is sent.
- `revision` moves when a study is archived. That is deliberate, so a stale tab cannot approve an archived study, but it means archiving shows as "changes since approval".
- Approval does not require the draft to differ from the approved copy; approving twice at one revision is harmless and rewrites the same value.
- The free-running approval race landed one way in all twelve rounds on this machine. The other order is covered only by the forced test.

## 7. Decisions still held for the owner

How and when the older JSON is frozen; whether unreviewed older case studies stay selectable; whether approving a successor switches in-progress proposals; client hidden by default; image treatment; mutable public pictures in sent proposals; the limits. The foundation assumes none of them beyond safe defaults that can be changed before anything is live.

## 8. Not done

No push, PR, merge or deploy. No hosted read or write. No secret read or requested. No provider call. No dependency. No change to any accepted source file, to `src/app/(marketing)/`, or to any frozen worktree.
