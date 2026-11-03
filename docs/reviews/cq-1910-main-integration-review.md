# cq-1910 Main-Integration Source Review

FAIL (as staged) — the main-only NET is clean and fully resolvable, and 2 of 3 staged paths already carry the exact required resolution, but the staged merged `.gitignore` still contains an auto-merge duplicate that must be resolved to backup blob `bcf434e7` before the candidate is packaged. The single required fix is fully specified below; no new gate is introduced.

Authority (as instructed, not re-derived): Constructa CTO 3 Nov 18:36/18:38 authorises tested backup-to-main integration with `results4Nov12UAE` / `conditionalmerge5Nov` evidence; no deploys, settings, live SQL, signup, keys, build or test actions are part of this review. This is an independent source review of the actual integration, not a repeat whole-backup audit.

## Pins and provenance

- Common base: `9405c2fca87174d51b7d1fb480aec73d2ba3c839` (verified: `git merge-base 6654af7 2d056c3` = 9405c2f).
- Backup (ours / review head): `6654af718d70cc7e2ac536b26b2d38bae11f9b24` = local HEAD of this worktree, branch `backup/welcome-first-slice-20261018` tip.
- Main (theirs): `2d056c335ae14d8391bbe242eaa701e480a45a36` = `MERGE_HEAD` in parent ROOT. Pin confirmed by fresh parent read-only `ls-remote` receipt of 3 Nov 19:04 (per instructions; this review performs no fetching or remote calls).
- Net path scope (verified by `git diff --stat 9405c2f..2d056c3`): exactly 3 paths — `.github/workflows/e2e.yml` (+12), `.gitignore` (+1), `.mcp.json` (−17, deletion). All other backup content is untouched by main; nothing else needs grading.

## Per-path findings

### `.github/workflows/e2e.yml` — PASS

- Base blob `1b1d8b3`, main blob `cb4deb49`, backup blob `cfbd9f30bac1f47f56e96ece5aef72be167ff8ca`.
- Backup blob independently re-verified against the 2 Nov narrower-conflict-scope pin: 4458 bytes, SHA256 `ecb15879aa46fb9e49370788da1b0fa4b4db0d226ddb5baebdcd18a4fdca7a08`. Exact match.
- Main's entire addition is strictly subsumed by backup's: the same `hosted-write-status` job with the same three named review-head conditions (`backup/welcome-first-slice-20261018`, `codex/phase1-integration-review-20261023`, `codex/remove-public-mcp-20261023`) and the same head-ref exclusions in the `phase1` `if`. Backup additionally carries the `draft-pull-request-status` job, the `github.event.pull_request.draft == false` term in the `phase1` `if`, and `E2E_BRIEF_AI_MODE: disabled` with its explanatory comment. `workflow_dispatch` remains an allowed trigger, so there is no fictional global manual-only policy; other branches and CI are unchanged.
- Required minimal resolution: take the backup blob `cfbd9f30` verbatim. Main's only extra delta is a trailing blank line at EOF (cosmetic filler, correctly excluded by the pin).
- Root staged index readback: `.github/workflows/e2e.yml` staged as stage-0 blob `cfbd9f30...` — already the exact required resolution. PASS.

### `.gitignore` — FAIL as staged; one-line-class fix fully specified

- Base blob `49975484`, main blob `12895a63`, backup blob `bcf434e77c6a79ee0bc88bf21ec5d07ac11c1e62`.
- Main's only delta: insert `/.mcp.json` after `.env*`. Backup independently added the same ignore rule with a `# local MCP connection configuration` comment, plus unrelated fixture/worktree entries. Main removes nothing; all yarn-related entries (`yarn-error.log*`, `.yarn/*` allowlist) are retained in every version.
- Raw 3-way merge auto-merges this file but produces a **duplicate** `/.mcp.json`: one bare line (main's insertion) followed by backup's commented rule. This is exactly the "duplicate filler" the review was told not to accept.
- Root staged index readback: `.gitignore` staged as blob `664682fd34c8532fa46f0a1dcdc1370af4f2ada4`, which diff-confirms the duplicate line against backup's `bcf434e7`.
- Required resolution: stage backup blob `bcf434e7` verbatim for `.gitignore`. Backup already retains the main ignore rule; nothing from main is lost.

### `.mcp.json` — PASS (presence/deletion status only; content never read)

- Present at base (`8f086e59` in `git ls-tree` of base — metadata only), deleted on main, deleted on backup. Delete/delete: the merged state is correctly absent. Root index contains no `.mcp.json` entry. Status-only inspection as instructed; content was never printed, read or hashed beyond tree metadata.

## Proposed normal merged state — grade

- Simulated read-only with old-style `git merge-tree 9405c2f 6654af7 2d056c3` (stdout only, no index/worktree/object writes): one conflict region in `e2e.yml` (the guard block — resolved correctly in the staged index to backup's side) and a non-conflicting duplicate insertion in `.gitignore` (still present in the staged index).
- Parent ROOT staged merged index **was inspected** (read-only `status`, `ls-files -s`, `ls-files -u`, index-blob `show`): merge in progress (`MERGE_HEAD = 2d056c3`, HEAD `6654af7`), zero unmerged stages. Grade of the index as staged: PASS on `e2e.yml` and `.mcp.json`, FAIL on `.gitignore` (duplicate `/.mcp.json`).
- Untracked `docs/delivery/2026-11-03/` exists in ROOT (parent Cursor's own material; not part of the merged index and not reviewed here).

## Nonblocking limits

- Main's EOF trailing blank line in `e2e.yml` is dropped by pinning to `cfbd9f30`; cosmetic, no behavioural effect.
- This review grades source only. No build, tests, runtime, hosted runs, or full-source certificate were performed or claimed; the existing ~60 unchanged tests were not rerun.
- Pins for main/backup rely on the authorised 3 Nov 19:04 parent `ls-remote` receipt plus local object identity; no remote services were contacted from this worktree.

## Required actual followthrough (no new gates invented)

1. In ROOT, resolve the staged `.gitignore` to backup blob `bcf434e77c6a79ee0bc88bf21ec5d07ac11c1e62` (removes the duplicate; retains main's ignore rule via backup's commented entry).
2. Complete the parent's no-commit merge packaging per the existing runner flow; keep `e2e.yml` at `cfbd9f30` and `.mcp.json` absent.
3. The existing PRIVATE `backup-accepted.mjs` attestation questions (empty-index/unstaged intake and explicit two-parent attestation, scoped-extension question pending) remain open for the runner — this review creates no reviewer helper and does not waive them.
4. This review grants no preview/production deploy, settings, SQL, signup or key consequences. Main-merge authority per the 3 Nov task does not itself authorise any deployment; the existing pending question stays with Rob. Green source here is not a release.

## Evidence (commands and readbacks)

All in this worktree (`cq/cq-1910-main-integration-review`, HEAD 6654af7) unless noted:

- `git merge-base 6654af7 2d056c3` → `9405c2fca87174d51b7d1fb480aec73d2ba3c839`.
- `git diff --stat 9405c2f..2d056c3` → 3 files: `e2e.yml +12`, `.gitignore +1`, `.mcp.json -17`.
- `git ls-tree` on base/main/backup for the 3 paths; `git rev-parse 6654af7:.github/workflows/e2e.yml` → `cfbd9f30bac1f47f56e96ece5aef72be167ff8ca`.
- `git cat-file blob cfbd9f30 | wc -c` → 4458; `| shasum -a 256` → `ecb15879aa46fb9e49370788da1b0fa4b4db0d226ddb5baebdcd18a4fdca7a08`.
- `git diff 9405c2f..2d056c3 -- .github/workflows/e2e.yml` and `-- .gitignore`; same for backup side; full backup workflow blob read from `cfbd9f30`.
- `git merge-tree 9405c2f 6654af7 2d056c3` (captured to $TMPDIR; conflict markers in `e2e.yml` guard region, duplicate insertion in `.gitignore`).
- ROOT read-only: `git -C /Users/robertsmith/dev/constructa-fresh-20261025 status --porcelain`, `ls-files -s/-u`, `show :.gitignore` → staged `cfbd9f30` (e2e.yml), `664682f` with duplicate (`.gitignore`), no `.mcp.json` entry, `MERGE_HEAD=2d056c3`.

Report left uncommitted for the runner's own cq artifact backup/check. Reviewer is not a source coauthor.
