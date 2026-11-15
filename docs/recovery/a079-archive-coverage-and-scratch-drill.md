# A079 archive coverage and scratch recovery drill

Companion to [the recovery runbook](a079-recovery-runbook.md) and [the staged Git bundle procedure](a079-next-action-20261112.md). **This draft has no recovery execution receipt.** Follow the runbook for step-by-step commands, manifest shape, restore order and acceptance tables; this file only names what to record and which runbook sections apply.

## Named inputs (runbook §2 — must be filled before any export or drill)

The operator names every value; the manifest check rejects blanks and placeholders.

| Input | Record in manifest / receipt |
| --- | --- |
| `EXPORT_DEST` | `destination.location`, `destination.approvedBy` |
| `SOURCE_PROJECT_REFS` | `source.projectRefs` (Production and QA if in scope) |
| `RESTORE_TARGET_REF` | `restoreTarget.projectRef`, `disposable: true` (never a source ref) |
| `EXPORT_SCOPE`, `RETENTION` | Scope note + `RETENTION_OWNER` |
| `RECOVERY_OWNER`, `RETENTION_OWNER` | Receipt header and failure decisions |

Credential values stay in the operator secret store only — not in this repo, the manifest or chat.

## Archive coverage checklist

| Coverage area | Runbook | Operator records |
| --- | --- | --- |
| **App Git** | §6 | Bundle per `constructa-co/Constructa`: `git-bundle`, `git-refs`, `git-lfs-assets` (empty list if no LFS); `git.requiredRefs` with expected SHAs; `git bundle list-heads` vs required refs |
| **Landing Git** | §6 | Same pattern for standalone landing repository and refs |
| **Programme Git** | §6, §7 | Existing programme backup ref (`3cd4bf54…`); do not duplicate full inventory — cite ref + SHA |
| **Private / unsaved work** | §6 | Worktrees, dirty paths, private evidence folder: committed SHA, copied hash, or deliberate discard with owner |
| **Deployment identity** | §7 | Non-secret `deployment/identity.json` for app and landing (Vercel project, deployment id, source revision, domains) |
| **constructa-ops** | §7 | Export into `EXPORT_DEST` as `ops-export` **or** owned waiver with reason (waiver keeps A079 Partial) |
| **Database** | §3 | Categories: `db-roles-privileges`, `db-schema`, `db-data`, `db-migration-history`, `db/managed-schema-customisations.sql` (G1 inventory) |
| **Auth users/data** | §3–4 | Rows in scoped `data.sql`; **`auth/config-boundary.md`** inventory only (provider/SMTP/JWT *names* and where secrets live — no values) |
| **Storage** | §5 | `storage-bucket-config`, `storage-policies`, `storage-object-metadata`, `storage-object-bytes` for all five buckets including `contracts` and `site-photos` |
| **Non-Git assets** | §6 | Manifest entries for untracked binaries (e.g. evidence PDFs) where required |

Merge bundle fragments from `scripts/recovery-git-bundle.mjs` into `manifest.json`. Validate with `node scripts/recovery-manifest-check.mjs` (see §9 below).

## Isolated scratch drill (no production writes)

**Stop conditions:** scratch ref missing, equals a production ref, or connection cannot be verified as disposable-only (runbook §8 preamble).

### 1. Git-only scratch (runbook §6; [next action](a079-next-action-20261112.md))

Empty scratch directory on an approved host. Verify archive checksums. Import Git from **local archive only** for each in-scope repo. Compare `git.requiredRefs` to `git bundle list-heads` output. Reconcile non-Git assets listed in the manifest. **Does not** prove database or Storage recovery.

### 2. Pre-restore gates (runbook §8 — record before any DB/Storage load)

| Gate | Pass criterion (detail in runbook) |
| --- | --- |
| **G1** | `db/managed-schema-customisations.sql` reviewed (or verified absence) for `auth` / `storage` customisations |
| **G2** | Source/target Postgres major version and Supabase pairing recorded and supported |
| **G3** | Vault / `pgsodium` use confirmed; key handoff location recorded if ciphertext is in scope |

On the disposable target before load: disable email and custom SMTP, OAuth providers and sign-up; no cron, webhooks or Edge Functions; no Vercel app pointed at the target (runbook §8).

### 3. DB / Storage scratch restore (runbook §8 order)

Execute restore **only** into `RESTORE_TARGET_REF` using approved test data. After load, run read-only reconciliation (counts, RLS policy names, triggers, migration versions, storage object hashes vs manifest) as runbook §8 asserts.

Offline comparison when inventories exist:

```bash
node scripts/recovery-reconcile.mjs --source source.json --restored restored.json \
  --migrations-dir supabase/migrations --manifest "$EXPORT_DEST/manifest.json"
```

Exit `0` = RECONCILED for that comparison file pair only (not a substitute for the gates above).

### 4. Acceptance for this drill (runbook §9 — cite outcomes, do not re-run here)

Record private receipt with: checksums, expected/observed refs, scope, scratch target verification, per-check pass/fail, elapsed time, unresolved gaps. Mark **independent recoverability verified** only for categories actually restored and compared.

| Check | Pass when |
| --- | --- |
| Manifest | `node scripts/recovery-manifest-check.mjs "$EXPORT_DEST/manifest.json" --root "$EXPORT_DEST"` exit `0` (`COMPLETE_SET`; `--root` required for byte verification) |
| Reconcile | `recovery-reconcile.mjs` exit `0` on export-time vs restored inventories |
| Git bundles | `git bundle verify` + every `git.requiredRefs` entry matches bundle heads |
| Private work | §6 reconciliation list signed by owner |
| Isolation | Record that target had no mail/providers/sign-up and retention decision |

A failed check leaves **A079 Partial**; do not overwrite evidence (runbook §10).

---

Current source and deployment readbacks live in the private preservation inventory. Independent archive coverage and recovery remain open until an authorised operator completes the checks above and stores the §9 evidence.