# ROB2335 — Cost library policy draft rework (queue FAIL remediation)

**Status:** Uncommitted working-tree delta on branch `cq/cq-costlib-policy-draft`. **No commit, push, SQL apply, or checker-file edits.**

Private copies: `/Users/robertsmith/dev/constructa-private-20261027/PRIVATE/ROB2335-POLICY-DRAFT-REWORK-RETURN.md`, `.../ROB2335-POLICY-DRAFT-REWORK.patch`, archival `.../PRIVATE/evidence/cq-costlib-policy-draft/20261030120000_cost_library_public_read_system_only.sql.pre-rework`.

## Worktree

| Item | Value |
| --- | --- |
| ROOT (owned) | `/Users/robertsmith/dev/constructa-fresh-20261025/.cq-wt/cq-costlib-policy-draft` |
| Branch | `cq/cq-costlib-policy-draft` |
| HEAD (unchanged) | `e90f24360b26c60c5dc95dec470718fab1367622` |
| NET base `4c66969` | `4c66969e92372d26d7136c1c5ce34f40512891c1` |

## Checker failure addressed

Source: `/Users/robertsmith/constructa-queue/checks/cq-costlib-policy-draft.FAIL` (historical, not edited).

**Cause:** Executable draft SQL under `supabase/migrations/20261030120000_cost_library_public_read_system_only.sql` — apply path for `supabase db push` / CI replay.

**Remediation:** Remove from `supabase/migrations/`; inert `docs/reviews/drafts/*.sql.txt`; fix privilege/containment comments; update review doc paths only.

## Pre-rework archival proof

| Artifact | SHA256 |
| --- | --- |
| `docs/reviews/drafts/20261030120000_cost_library_public_read_system_only.sql.pre-rework-archival` | `5ecf3a34ad9c06ab5c686cc7dd3d4b69df2462bcc1becd128cf97d2cb521393d` |
| `git show e90f243:supabase/migrations/20261030120000_cost_library_public_read_system_only.sql` | `5ecf3a34ad9c06ab5c686cc7dd3d4b69df2462bcc1becd128cf97d2cb521393d` |

## No active migration path

Working tree: `supabase/migrations/20261030120000_cost_library_public_read_system_only.sql` **absent** (`test ! -f` → OK).

NET from `4c66969` (working tree, no new migrations-path SQL): only `docs/reviews/**` additions/edits.

## NET path list (`4c66969` → working tree)

- `docs/reviews/cq-costlib-policy-draft.md` (modified)
- `docs/reviews/drafts/20261030120000_cost_library_public_read_system_only.sql.txt` (new, untracked)
- `docs/reviews/drafts/20261030120000_cost_library_public_read_system_only.sql.pre-rework-archival` (new, untracked)
- `docs/reviews/drafts/ROB2335-POLICY-DRAFT-REWORK-RETURN.md` (this file)
- `docs/reviews/drafts/ROB2335-POLICY-DRAFT-REWORK.patch` (companion)
- **Not present:** `supabase/migrations/20261030120000_cost_library_public_read_system_only.sql`

## Post-rework hashes

| File | SHA256 |
| --- | --- |
| `docs/reviews/drafts/20261030120000_cost_library_public_read_system_only.sql.txt` | `b7cbb5a6caf0832667948ae87928b8cee53f693d067fc6a7f14320a267007a80` |
| `docs/reviews/cq-costlib-policy-draft.md` | `74b79062526383553374e44183736e5f34242721d9a90eb87c8c4eba67ade414` |

## Cursor change log

| File | Intent |
| --- | --- |
| `docs/reviews/cq-costlib-policy-draft.md` | Inert paths, FAIL cause, residual `"Users Manage Own Resources"` disclosure, 17:30 RLS note (no re-probe) |
| `docs/reviews/drafts/*.sql.txt` | Inert proposal + wrapper |
| `docs/reviews/drafts/*.pre-rework-archival` | Byte preservation before relocation |
| `supabase/migrations/20261030120000_*.sql` | Removed from apply path (WT only) |
