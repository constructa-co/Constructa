# A079 recovery runbook: database, Auth, Storage, Git and private work

Status: **A079 remains Partial.** This runbook and its offline check
(`scripts/recovery-manifest-check.mjs`) are instructions and a validator. Neither is a
demonstrated recovery. A079 can only move to Complete after an authorised operator has run
sections 3 to 8 against the named inputs and the acceptance evidence in section 9 exists.

Written on branch `codex/a079-recovery-20261027` from base
`679182996680920363187c352ffc78d825bf096d`. Nothing in this file was executed while
writing it: no export, restore, SQL, Auth or Storage read, login, setting or deploy.

## 1. What already exists and what does not

| Item | State | Limit |
| --- | --- | --- |
| App source backup `679182996680920363187c352ffc78d825bf096d` | Accepted for the observed source and docs tree | Not DB, Auth, Storage, all refs or private unsaved work |
| Programme backup `3cd4bf54690d02623df4f7fb6a07f4717f52ad9a` (`constructa-co/constructa-programme`, branch `codex/backup-constructa-programme-20261023`) | Remote confirmed; earlier 47-file gap resolved for the observed tree | Observed working documents only |
| QA project `constructa-e2e-pr79` | Name and ref binding verified; overview shows "LAST BACKUP No backups" | QA only. Says nothing about Production or private exports |
| Production database, Auth and Storage export | **Not done** | Needs the required inputs below |
| Independent restore and read-back | **Not done** | Needs a disposable restore target |
| All Git refs, LFS, assets and private or unsaved work | **Not reconciled** | Section 6 |
| `constructa-ops` recovery export | Reported **skipped** on 25 Oct; no success recorded | Section 7 |

### 1.1 Historical pins (do not treat as current)

The table above records **observed facts at runbook authorship** on branch
`codex/a079-recovery-20261027` from base `679182996680920363187c352ffc78d825bf096d`
(112 migration files at that commit). Those rows remain **history**, not a claim that
679 or 112 migrations still describe the accepted Phase 1A source tree.

### 1.2 Current source coverage (Phase 1A, 2026-10-29)

**Current accepted app source** (manager handoff, source-only): commit
`d86dca62643fac61dda89a05916d99b966193c79` on remote branch
`backup/welcome-first-slice-20261018`, parent `b5f513896eb07834e055e260536584ee7d0b708e`.
Authored SQL at that head: **116** files under `supabase/migrations/` (four migrations
added since the historical 679 pin). Named A059 NET16 pin `f23e4902df3096a2f4481ea3fb78bd663a21dace`
is recorded in the coverage manifest; verify reachability on the authoritative remote.

Machine-readable inventory (paths, git blobs, content SHA for
`20261029103000_project_working_pattern_v2.sql`, held DB/Auth/Storage status):

- `docs/recovery/phase1a-source-coverage-20261029.json`
- Readable handoff: `docs/recovery/phase1a-source-coverage-handoff-20261029.md`

This coverage **does not** move A079 to Complete. It closes the gap where accepted
post-b5 / A059-night source was missing from recovery documentation. Full recovery still
requires operator export, manifest `COMPLETE_SET` with `--root`, and section 9 evidence.

Database export **credential boundary** (safe operator rules, not the historical example):
section 3 below. `EXPORT_DEST`, disposable restore target, retention, and `RECOVERY_OWNER`
remain future operator inputs named in one scoped yes, separate from practice/provider
questions; nothing in this section is executed from the repository.

## 2. Required inputs

These are named by the authorised operator. The runbook never assumes them, and the
manifest check rejects blanks, `TBD` and `<placeholders>`.

| Input | Meaning |
| --- | --- |
| `EXPORT_DEST` | Approved private export location: encrypted, off the app checkout, not a Git repository, not cloud-synced unless approved. Recorded as `destination.location` with `destination.approvedBy`. |
| `SOURCE_PROJECT_REFS` | Every Supabase project being exported (Production, and QA if in scope). Recorded as `source.projectRefs`. |
| `RESTORE_TARGET_REF` | A **new, disposable** Supabase project or local stack, never a source. Recorded as `restoreTarget.projectRef` with `disposable: true`. The check refuses a target that is also a source. |
| `EXPORT_SCOPE` and `RETENTION` | Which projects, schemas and buckets, and how long the export is kept and by whom. |
| Existing authorised access | The operator's existing DB access and dashboard sign-in. This runbook does not create keys, logins or connections and never assumes `service_role` or Production access. |
| `RECOVERY_OWNER`, `RETENTION_OWNER` | People who own failure, rollback and retention decisions (section 10). |

## 3. Database: schema, data, roles, privileges, RLS, migrations

A Supabase database backup (dashboard daily backup or PITR) covers the Postgres database
only. It does **not** contain Storage object bytes, and it does not contain hosted Auth
provider secrets, SMTP settings or API keys. Treat those as separate items (sections 4 and 5).

Export, run by the operator with existing access.

Credential handling:

- A connection URL usually contains the database password.
- A URL passed as a command argument (`--db-url`, `--dbname`) is visible to other local
  processes for as long as the command runs.
- Run exports and restores on an isolated, single-user operator host, with shell tracing
  off (`set +x`) and history disabled.
- Where the installed CLI version documents a handoff that keeps the password out of the
  arguments, use it. For `psql`, use a libpq service file plus a password file with mode 600.
- Never print, `export` into a shared shell, log, screenshot or write a credential into
  `EXPORT_DEST`, the manifest or evidence.

Safe future operator instruction (documentation only; no commands executed from this
repository): use **existing operator-controlled** libpq service names only (for example
`a079_source` for export reads, `a079_restore` for disposable-target loads), each with a
matching mode-`600` password file the operator already maintains. Do **not** create
credentials, URLs, or password files in this job. Do **not** pass database passwords in
process arguments, shared shell exports, shell history, or logs: no credential URLs,
`PGPASSWORD`, `--password` values, `-p` password values, or equivalent. Keep tracing off
(`set +x`) and history disabled on the isolated host. Use the installed Supabase CLI for
`db dump` **only** when that installed version documents a password-off-argv-safe mode
compatible with the operator's handoff; otherwise use existing libpq tools (`psql`, and
vendor-documented dump paths the operator chooses) with the managed-schema exclusion
review at the **existing** gate G1 in section 8 — not a new named DBA gate invented here.
Do **not** claim generic `pg_dump` output is identical to Supabase CLI omissions for
managed schemas; follow the Supabase CLI reference notes below and G1 inventory rules.

**Historical unsafe example - DO NOT EXECUTE. Database password must not appear in process arguments.**

```bash
# Inert example. SOURCE_DB_URL comes from the operator's own secret store (see credential handling).
supabase db dump --db-url "$SOURCE_DB_URL" --role-only   -f "$EXPORT_DEST/db/roles.sql"
supabase db dump --db-url "$SOURCE_DB_URL"               -f "$EXPORT_DEST/db/schema.sql"
supabase db dump --db-url "$SOURCE_DB_URL" --data-only --use-copy -f "$EXPORT_DEST/db/data.sql"
```

Notes:

- According to the Supabase CLI reference for `db dump`, the default schema dump leaves out
  Supabase-managed schemas such as `auth`, `storage` and the extension schemas. So
  `schema.sql` carries the `public` (and other custom) tables, RLS, functions, triggers
  and grants. It does **not** carry customisations made *inside* managed schemas. At base
  679 those include:
  - trigger `on_auth_user_created` on `auth.users`
    (`supabase/migrations/20260117000000_foundations_estimator.sql`);
  - 13 `CREATE POLICY … ON storage.objects` statements across 6 migration files.
- **Managed-schema coverage guard.** Before any restore (section 8, gate G1) the operator
  produces `db/managed-schema-customisations.sql`. It is an operator-reviewed inventory of
  custom policies, triggers and functions in `auth` and `storage`, captured the way the
  official backup and restore guide describes for changes to those schemas, using the
  installed CLI version's documented command. If the inventory is empty, record verified
  absence instead.
  - Compare the inventory with the repository migrations above. Any difference is a finding.
  - Never export or replay the platform's own managed object definitions.
  - Manifest category: a `db-schema` entry, plus `storage-policies` for the storage part.
- Managed-schema *data* (users, identities, `storage.buckets`, `storage.objects` metadata)
  is exported and loaded into a target whose managed schemas come from the platform.
- Confirm `data.sql` holds `COPY` blocks for `auth.users`, `auth.identities`,
  `storage.buckets` and `storage.objects`. If any is absent, dump it explicitly with
  `--data-only --schema auth,storage` into a separate file and add it to the manifest.
- Record `supabase_migrations.schema_migrations` versions into
  `db/migration-history.txt`. Compare with `supabase/migrations/` (112 files at base 679);
  any version in the database but not in the repository, or the reverse, is a finding.
- Category mapping: `db-roles-privileges`, `db-schema`, `db-data`, `db-migration-history`.

## 4. Auth: users, identities and the provider-config boundary

- `auth.users` and `auth.identities` rows travel inside `db/data.sql`. Password hashes are
  in that file, so it is credential material: store it only in `EXPORT_DEST`, never in
  Git, chat, evidence screenshots or logs. Category `auth-users` refers to that file by hash.
- Provider configuration (site URL, redirect URLs, OAuth client IDs and secrets, SMTP
  credentials, JWT secret, email templates) is **not** in any database dump. Record it as a
  non-secret inventory, `auth/config-boundary.md`: which settings exist and where each
  secret is held (Vercel project env, password manager). Never copy secret values.
  Category `auth-config-boundary`.
- Secrets move only through the existing secure handoff (password manager or Vercel env),
  not through this export.
- **Sessions and MFA.** Record in `auth/config-boundary.md` whether sessions, refresh tokens
  and MFA factor data (`auth.sessions`, `auth.refresh_tokens`, `auth.mfa_*` tables in the
  installed Auth version) are in `EXPORT_SCOPE`.
  - If in scope, add them to the `COPY` checklist (section 3) and to the reconciliation
    counts (section 8).
  - If out of scope, the recovery plan must require every user to sign in again and must
    include factor re-enrolment or recovery for any MFA user.
  - Even when exported, tokens signed by the source project's JWT secret cannot be assumed
    to be valid on the target. Never promise users that their sessions are retained.

## 5. Storage: bucket configuration, policies, object metadata and bytes

Buckets the restore must reproduce:

| Bucket | Created by a migration | Read by source |
| --- | --- | --- |
| `logos` | yes (later hardened public, 10 MB, images) | yes |
| `proposal-photos` | yes (public, 10 MB, images) | yes |
| `receipts` | yes (private, 10 MB, PDF and images) | yes |
| `contracts` | **no** | `storage.from("contracts")` |
| `site-photos` | **no** | `storage.from("site-photos")` |

`contracts` and `site-photos` exist only if created by hand, so a migrations-only restore
would miss them. Export their configuration explicitly.

1. **Bucket configuration**: `storage.buckets` rows (id, public, file size limit, allowed MIME
   types) to `storage/buckets.json`. Category `storage-bucket-config`.
2. **Policies**: the `storage.objects` policies live in the managed `storage` schema, so the
   default `schema.sql` does not contain them. Take them from the reviewed
   `db/managed-schema-customisations.sql` (section 3 coverage guard), copy them to
   `storage/policies.sql` and check them against the 13 repository policy statements.
   Category `storage-policies`.
3. **Object metadata**: `storage.objects` (bucket, name, size, mimetype, owner) to
   `storage/objects.json`. Category `storage-object-metadata`.
4. **Object bytes**: download every object with the operator's existing access into
   `storage/objects/<bucket>/<name>`, then hash each file. Category `storage-object-bytes`.
   Every row in the manifest's `storage.objects` names the bytes file, and its `sha256` and
   `bytes` must match that file, and every bytes file must be named by at least one
   `storage.objects` row (the check enforces both directions).
   - This proves only that the declared set agrees with itself. An object missing from both
     the manifest and the export is not detected by the check.
   - Completeness against the source comes from the `storage.objects` row count per bucket,
     taken from the source at export time and reconciled in section 8.
5. **Restored references**: after restore, every `logo_url`, receipt, contract and photo
   path held in database rows must resolve to an object in the restored bucket (section 8).

## 6. Git refs, history, LFS, assets and private or unsaved work

For each deployed repository (app `constructa-co/Constructa`, landing
`constructa-co/constructa-landing`, programme `constructa-co/constructa-programme`):

```bash
# Inert example, run in an existing clone with existing access. No fetch, fsck or repair here.
git for-each-ref --format='%(refname) %(objectname)' > "$EXPORT_DEST/git/<repo>-refs.txt"
git bundle create "$EXPORT_DEST/git/<repo>.bundle" --all
git bundle verify "$EXPORT_DEST/git/<repo>.bundle"
git lfs ls-files --all --long > "$EXPORT_DEST/git/<repo>-lfs.txt"   # empty when LFS is unused
```

- The bundle and refs list are categories `git-bundle` and `git-refs`; LFS objects and
  untracked binary assets (for example `public/`, `docs/evidence/**/*.pdf`) are
  `git-lfs-assets`. The app repository has no LFS filters at base 679, so record the empty
  list rather than waiving it.
- Put every required ref in `git.requiredRefs` with its expected SHA, at least app
  `679182996680920363187c352ffc78d825bf096d` and programme
  `3cd4bf54690d02623df4f7fb6a07f4717f52ad9a`. The check fails if one is missing or moved.
- The manifest check compares the manifest with itself only, and `git bundle verify` is a
  structural check. Neither proves the bundle holds the required refs. For that, compare
  the bundle's own head list with `git.requiredRefs`:

  ```bash
  # Inert example. Every requiredRefs ref must appear with exactly its expected SHA.
  git bundle list-heads "$EXPORT_DEST/git/<repo>.bundle" > "$EXPORT_DEST/git/<repo>-bundle-heads.txt"
  ```

  Record each required ref as expected SHA, bundle SHA and pass or fail.
- **Private and unsaved work**: list every worktree (`git worktree list --porcelain`),
  every dirty or untracked path, and the private evidence folder. For each, record
  "committed at <sha>", "copied to EXPORT_DEST at <hash>" or "deliberately discarded by
  <owner>". Editor buffers that are not on disk cannot be recovered by any export; the
  owner confirms them saved. Category `private-work-reconciliation`.

## 7. Deployment identity, programme backup and constructa-ops

- **Deployment identity** (`deployment/identity.json`, non-secret): for app and landing,
  the Vercel project, production deployment id, source revision and domains. The app
  production revision has been recorded separately from the backup base, so record both
  and state whether the backup contains the deployed revision. Category
  `deployment-identity`.
- **Programme backup**: refer to the existing `3cd4bf5` backup by its ref and SHA; do not
  repeat the inventory. Category `programme-backup`.
- **constructa-ops**: its recovery export was reported skipped on 25 Oct. Either run it into
  `EXPORT_DEST` and record it (category `ops-export`), or record an owned waiver with the
  reason. A waiver keeps the verdict PARTIAL.

## 8. Restore order and read-only reconciliation

Restore only into `RESTORE_TARGET_REF`. Before starting, on the target: disable email
sending and custom SMTP, disable every OAuth provider and sign-up, leave no cron,
webhook or Edge Function active, and do not point any Vercel deployment or local app at
it. No restored user should be able to receive mail or sign in.

Gates. If any gate is not met, stop and escalate to `RECOVERY_OWNER`. Do not improvise.

- **G1, managed-schema coverage.** `db/managed-schema-customisations.sql` (or a verified
  absence record) exists and a named operator or DBA has reviewed it against the target.
  Replaying a `schema.sql` onto a Supabase target without that review is a stop.
- **G2, platform and version compatibility.** Record the source and target Postgres major
  version, the Supabase platform or image version where shown, and the extension versions.
  Proceed only when the official backup and restore guidance supports that pairing.
- **G3, encryption keys.** Record whether Vault or `pgsodium` encrypted values are in use.
  - No migration at base 679 references them; the operator confirms this on the source.
  - A database dump carries only ciphertext. The project root key is separate and is
    handed over, if at all, through the official key handoff.
  - Record only *where* the authorised operator holds that key material and which key
    version it is, never the value.
  - Without the key, encrypted values are recorded as unrecoverable, not as restored.

Order (after the gates):

1. `roles.sql`
2. `schema.sql`, then compare migration history with the repository
3. `data.sql` (including `auth.users`, `auth.identities`, in-scope session or MFA tables,
   `storage.buckets` and `storage.objects` metadata) with triggers suppressed
4. Reviewed `db/managed-schema-customisations.sql`, after the data load so that
   `on_auth_user_created` does not fire for restored users
5. Storage bucket settings for any bucket not created in step 3
6. Object bytes uploaded to the matching bucket and path
7. Read-only reconciliation (below)

```bash
# Inert example. "a079_restore" is a libpq service entry for the disposable target only;
# the password lives in the operator's mode-600 password file, not in the arguments.
psql --single-transaction -v ON_ERROR_STOP=1 --dbname "service=a079_restore" \
  --file "$EXPORT_DEST/db/roles.sql" --file "$EXPORT_DEST/db/schema.sql" \
  --command 'SET session_replication_role = replica' --file "$EXPORT_DEST/db/data.sql"
```

Read-only assertions, each recorded as source value, restored value and pass or fail:

- Row counts per table in `public`, `auth.users`, `auth.identities`, any in-scope session
  or MFA tables, and `storage.objects` per bucket match the source counts taken at export time.
- RLS is enabled on the same tables as the source, and policy names per table match,
  including the `storage.objects` policies and the `on_auth_user_created` trigger from
  the reviewed managed-schema inventory.
- Extension names and versions match; role and grant lists match.
- `schema_migrations` versions match the source list.
- Each restored `storage.objects` row has a byte file whose sha256 equals the manifest
  value, and every storage path referenced from database rows resolves.
- A count of Auth users only. No user records are opened, printed or used to sign in.

## 9. Acceptance evidence

A079 can be proposed as Complete only with all of these:

1. `node scripts/recovery-manifest-check.mjs "$EXPORT_DEST/manifest.json" --root "$EXPORT_DEST"`
   exits `0` with verdict `COMPLETE_SET` (exit `2` is PARTIAL because of a waiver; exit `1` is
   INVALID). The output is paths, counts and messages only. **Exit `0` without `--root`
   (`bytesVerified: false`) checks manifest metadata only and is not acceptance evidence.**
2. The section 8 reconciliation table, with every row passing, and the G1 to G3 gate records.
3. `git bundle verify` output for each repository, plus the `git bundle list-heads`
   comparison showing every requiredRefs entry at its expected SHA.
4. The private-work reconciliation list from section 6, signed off by its owner.
5. The non-secret Auth config boundary and deployment identity files.
6. A record that the restore target was isolated (no mail, providers or sign-up) and
   who retains or deletes it, and when.

## 10. Failure, rollback and retention

- No step writes to a source project, a live deployment or an existing backup branch.
  Rollback of a failed restore is discarding the disposable target, decided by
  `RECOVERY_OWNER`.
- A failed check or failed assertion leaves A079 Partial; record the failure, do not
  overwrite or retry over evidence.
- `RETENTION_OWNER` decides how long `EXPORT_DEST` and the restore target live and confirms
  deletion. The export contains password hashes and customer data; treat it as such.

## Manifest shape

```json
{
  "version": 1,
  "destination": { "location": "<EXPORT_DEST>", "approvedBy": "<owner>" },
  "restoreTarget": { "projectRef": "<RESTORE_TARGET_REF>", "disposable": true },
  "source": { "projectRefs": ["<SOURCE_PROJECT_REF>"] },
  "entries": [{ "path": "db/schema.sql", "category": "db-schema", "sha256": "<64 hex>", "bytes": 0 }],
  "waivers": [{ "category": "ops-export", "reason": "<why>", "owner": "<owner>" }],
  "storage": {
    "buckets": [{ "id": "logos" }, { "id": "proposal-photos" }, { "id": "receipts" }, { "id": "contracts" }, { "id": "site-photos" }],
    "objects": [{ "bucket": "logos", "name": "<object name>", "path": "storage/objects/logos/<name>", "sha256": "<64 hex>", "bytes": 0 }]
  },
  "git": {
    "refs": [{ "repository": "app", "ref": "refs/heads/<branch>", "sha": "<40 hex>" }],
    "requiredRefs": [{ "repository": "app", "ref": "refs/heads/<branch>", "sha": "679182996680920363187c352ffc78d825bf096d" }]
  }
}
```

The placeholders above are rejected by the check on purpose. The manifest must not contain
keys, tokens or connection strings; the check fails closed on credential-shaped values and
on credential file names such as `.env` or `service_role`.

Run the check's own tests with `node --test scripts/recovery-manifest-check.test.mjs`.
