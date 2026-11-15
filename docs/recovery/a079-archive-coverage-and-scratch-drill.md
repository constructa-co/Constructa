# A079 archive coverage and scratch recovery drill

Use this checklist with [the recovery runbook](a079-recovery-runbook.md) and [the staged Git bundle procedure](a079-next-action-20261112.md). This draft has no recovery execution receipt.

## Archive coverage

- Record the full source revision and deployment receipt for the app and standalone landing site. Identify the exact refs that recovery must preserve. Record programme and ops coverage under their separate runbook categories.
- For each independent archive, record the approved location, owner, creation date, checksum, required refs and a manifest for LFS, submodules and separate assets where applicable. Keep the receipts private.
- Compare the archive refs to each release pin with `git bundle list-heads`. A matching tree needs the exact commit and reachable objects. Record missing refs or assets and reuse intact copies.
- Record managed database and Storage coverage separately. Include the operator-approved scope for schema, RLS, Auth, Storage objects and bytes. Keep credential values, connection URLs and private keys in the operator's secret store.

## Isolated drill

1. Allocate an empty scratch directory on an approved host. Verify the archive checksum and inspect bundle heads before importing. Restore Git objects into an empty repository using the local archive as the only source. Compare required ref SHAs, connectivity, tree and asset checksums. Check any non-Git assets against the manifest.
2. A database or Storage drill requires the operator to record the approved disposable project ref and the production refs before opening a connection. Stop if the scratch ref is absent, matches any production ref, or the connection cannot be verified against the approved scratch ref. Keep scratch isolated from deployed apps, email, signup, providers, webhooks, and scheduled jobs.
3. Use the existing recovery runbook for the separately approved scratch restore. Compare schema and policy inventory, representative Auth scope, bucket metadata and object counts and hashes. Use only the approved scratch project and approved test data. Stop on any mismatch and record the failed check.
4. Save a private receipt with archive checksums, expected and observed refs, scope, scratch target verification, per-check results, elapsed time and unresolved gaps. Mark independent recoverability verified only for the items actually recovered and compared.

Current source and deployment readbacks are recorded in the private preservation inventory. Independent archive coverage and recovery remain open.
