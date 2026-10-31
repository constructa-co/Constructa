FAIL: the source repair is written, but its checks did not run. The permission layer refused `bash -n`, the hash commands and `node -e`, and vitest was not run. Postgres behaviour is unexecuted. Treat this as a review candidate, not a verified result.

# CQ-2310 A038: photo migration source repair

Base commit: `ba736c6a7aa537689816b0cc3b397ff0274424c6`. Branch: `cq/cq-2310-a038-photo-migration-source`. Changes are uncommitted.

## Defects confirmed by reading the source

1. **No transition.** `case_studies_draft` and `case_studies_approved` are CHECKs, so they run on every UPDATE of a row. That includes the revision moves in `case_library_discipline_save` and `_archive`, and the write in `case_study_approve`. Under the thirteen-key rule, every twelve-key row would fail those writes.
2. **Writer race.** Without a lock, a twelve-key row committed during the migration would be left behind permanently.
3. **Missing privileges.** `case_library_photo_slot_ok` and `case_library_photos_ok` had no REVOKE or GRANT, so they stayed executable by PUBLIC, and by `anon` and `authenticated`. Every other rule function refuses browser roles, and the script's existing assertion would have failed on this.
4. **Unsafe validation order.** `AND` chains do not promise evaluation order in front of `jsonb_object_keys` and `jsonb_array_length`, which raise on wrong types. `photos_ok(NULL)` returned NULL, and `WHERE NOT slot_ok(...)` would treat a NULL as acceptable.
5. **Stale test script.** It applied only the foundation migration and used twelve-key drafts. Its content-vector count was 48, but the fixture has 49.

## Changes

### `supabase/migrations/20261028120000_case_library_photos.sql`

- Added `LOCK TABLE public.case_studies IN SHARE ROW EXCLUSIVE MODE` as the first step. It blocks writers, not readers.
- Rewrote `photo_slot_ok` and `photos_ok` with `CASE`. They now always return true or false, never NULL and never a jsonb error. The `case_library_content_problem` rule order and the thirteen-key list are unchanged.
- Added REVOKE from PUBLIC, `anon` and `authenticated`, and GRANT EXECUTE to `service_role`, for the two new functions. No other privilege changed.
- Added one UPDATE that gives `draft` and `approved` three empty slots.
  - It only adds the key.
  - It does not set `revision`, `approved_revision`, `approved_at`, `updated_at` or `user_id`.
  - It skips rows that already have the key, so a rerun changes no row.
- Added a closing check that aborts the transaction if any row fails the new rules. The error message names no row and quotes no content.
- Added a header comment covering the order and the release requirement.

### `scripts/test-case-library-sql.sh`

- Shared vectors run on the foundation first, which is the twelve-key contract they describe. They run again after the photo migration with empty slots added. The two vectors that already carry `photos` now expect `photos` instead of `keys`.
- Seeds through the foundation's real functions under a fifth contractor: never approved, approved and current, approved then edited, approved and archived, adopted from an older entry that has a picture.
- New assertions:
  - exact draft and approved values, plus unchanged owner, revisions and dates;
  - hidden client and figure stay out of the approved copy;
  - no older picture is borrowed;
  - tags, disciplines and profiles are unchanged;
  - a row that cannot be carried aborts the whole migration, with nothing half done;
  - an uncommitted twelve-key INSERT is carried, not left behind;
  - a second run changes nothing;
  - 34 photo vectors, plus character limits and NULL and scalar inputs, are answered without a jsonb error;
  - a discipline rename, tenant refusals, stale approval, and save and approve with a real picture all behave correctly on carried rows.
- Existing assertions changed:
  - content vectors 48 to 49, and functions 15 to 17;
  - the "created nothing" discipline count 0 to 1, because of the seed;
  - the unknown-key check now uses `assets`, and a new check refuses `photos: []`;
  - `:draft` and `DRAFT` now carry slots;
  - `fail()` moved to the top of the script.

  None was deleted, skipped or weakened.

### `src/lib/case-library/photo-migration-source.test.ts` (new)

A static test that reads the source only. It checks the step order, that the UPDATE leaves other columns alone, the privileges, that the empty-slot literal equals `emptyPhotoSlots()`, and the seed position. It also runs the script's 34 vectors through `storedPhotoSlotsProblem`.

Not changed: application code, the `content.ts` flag, other migrations, root, other worktrees.

## Commands and exits

| Command | Result |
| --- | --- |
| `grep -c '^ \["' scripts/test-case-library-sql.sh` | Exit 0, output 34 |
| `grep -n 'fail()\|= 49\|= 17\|= 34' scripts/test-case-library-sql.sh` | Exit 0, one `fail()`, counts as expected |
| `git status --short` | Exit 0, two modified files and one new file before this report |
| `git rev-parse HEAD` | Exit 0 |
| `bash -n scripts/test-case-library-sql.sh` | **Not run**, refused by the permission layer |
| `node -e` vector count | **Not run**, refused. The 49 comes from `grep -n` section positions |
| `shasum -a 256`, `git hash-object` | **Not run**, refused |
| `vitest` on the new test | **Not run**, because the instruction excluded a fresh test runner and `node -e` had already been refused |

**Hashes: none recorded**, because both hash commands were refused. The runner should record them when it commits.

No SQL, psql, docker, database, hosted or provider command was run. There is no RED or GREEN result. Everything in this report about Postgres behaviour comes from reading the source.

## Remaining runtime and human scope

- **First run:** run `bash -n` on the script, then the new focused test. Then run `scripts/test-case-library-sql.sh` on a disposable local Postgres. That run is the first real evidence for the transition, and new assertions may need adjusting.
- **Timing:** the in-flight writer test relies on a 0.4s and 1.5s sleep, the same pattern the script already uses.
- **Coordinated release (human decision):** the current build has `CASE_LIBRARY_DRAFT_PHOTOS_ON_WIRE = false`, so it writes twelve keys and cannot ship against this schema.
  - After the migration, its create and save calls are refused with `keys`.
  - Its approval check compares a copy without `photos` against one that has them.
  - The migration and a build that sends thirteen keys must be released together. Until then, keep the migration unapplied.
  - Between the two, library writes are refused and no data is damaged.
- **Known SQL and TS difference, not changed:** SQL accepts some urls the application refuses, such as `https://` alone or a url with credentials. The application checks first, but a direct service-role write would be accepted.
- **Size limit:** three maximum-length photo slots filled with four-byte characters could approach the 65536-byte CHECK. A draft just under the limit could then fail at approval, because the approved copy adds the labels. This was found by reading the source and has not been tested.
- **Independent check:** the Cursor check and the human apply decision are still outstanding.
