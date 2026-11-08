# ROB2250 — Cursor Composer 2.5 — A069 packaging fix (F1/F2 only)

**Review basis:** `rob2242-claude-a069-review-20261030.log` — test **SCOPED_NNF** unchanged; whole `ROB2233` patch `2ec14132…` not packageable.  
**Scope:** Public patch + changelog prose only. **No** test bytes changed. **No** commit/push/SQL/build/rerun.

## Branch / base

| Item | Value |
| --- | --- |
| Worktree | `/Users/robertsmith/dev/constructa-fresh-20261025/.cq-wt/a069-prefill` |
| Branch | `cq/a069-prefill` |
| Base commit | `4c66969e92372d26d7136c1c5ce34f40512891c1` |

## Deliverables

Copy these three files to `/Users/robertsmith/dev/constructa-private-20261027/` (same bytes as worktree `PRIVATE/`):

| Artifact | Worktree path | SHA256 |
| --- | --- | --- |
| PUBLIC patch | `PRIVATE/ROB2250-CURSOR-A069-PUBLIC.patch` | `887959c9893a2c0a467d71f821c202653ad120fed222c68b73b1ec612df7dddd` |
| DOC-DELTA patch | `PRIVATE/ROB2250-CURSOR-A069-DOC-DELTA.patch` | `32b3b57897dbafadaea82aa0e00caded4b86573ee3051967e917f163c6950667` |
| RETURN | `PRIVATE/ROB2250-CURSOR-A069-RETURN.md` | (this file) |

## F1 — public package contents

**`ROB2250-CURSOR-A069-PUBLIC.patch`** applies against `4c66969` with **only**:

1. `src/app/dashboard/projects/proposal/a069-closing-editor-journey.test.tsx` (new)
2. `docs/delivery/2026-10-28/changelog.md` (ROB2233 entry, ROB2250-corrected prose)

**Excluded:** `PRIVATE/vitest.a069.mts`, `PRIVATE/ROB2233-CURSOR-A069-RETURN.md`, `PRIVATE/ROB2233-CURSOR-A069-RETURN.patch`, and any other PRIVATE paths. Original ROB2233 PRIVATE artifacts in the worktree are **unchanged** (not deleted, not reset).

**Do not** `git commit -a` on this branch without staging only the two public paths — unstaged PRIVATE files would otherwise ship on a careless `-a`.

## F2 — changelog corrections (DOC-DELTA)

**`ROB2250-CURSOR-A069-DOC-DELTA.patch`** replaces the first (incorrect) ROB2233 changelog bullets with:

- **Simulated vs real:** RPC row shape and `closing_statement` null after clear are **fixture/simulated** outcomes (fake Supabase + hand-set row under mocked save), not PostgreSQL or runtime DB proof.
- **Real handlers:** Unmocked `createBlankProjectAction`; real `ReviewSendClient`, reducer, `saveDraft`, `buildProposalPayload`, `reviewSaveStatus`.
- **Focused command:** `npx vitest run src/app/dashboard/projects/proposal/a069-closing-editor-journey.test.tsx` — **no** `PRIVATE/vitest.a069.mts` in public docs.
- **QA metadata:** Closing migration **already applied once on QA (29 Oct)**; this slice is tests-only (no SQL reapply). Prior `42501` on `valid_programme_working_pattern` addressed by parent narrow grant (authenticated EXECUTE; anon false) — **programme/create browser QA in progress, not PASS**. Parent owns UI/session proof.

Also logged in worktree `docs/cursor-change-log.md` (ROB2250 prose-only row); not part of PUBLIC patch.

## Test bytes (unchanged — independent grade anchor)

| Path | SHA256 |
| --- | --- |
| `src/app/dashboard/projects/proposal/a069-closing-editor-journey.test.tsx` | **`d3b6f9a7aefb1124b0461ae023b7d460b58ddf2113cf69edf020fca5758074b8`** |

| Path | SHA256 (after prose fix) |
| --- | --- |
| `docs/delivery/2026-10-28/changelog.md` (worktree) | `425adca175e1dfebb0a30d0e5cda1183c18e76fce023298f52104e1c7efd2646` |

## Prior patch (superseded for packaging, retained for history)

| Artifact | SHA256 |
| --- | --- |
| `PRIVATE/ROB2233-CURSOR-A069-RETURN.patch` (worktree, **unchanged**) | `2ec14132a9821c36ec07e6b647882ef0961f995fbf752255719cf555c2e80c3e` |

Use **`ROB2250-CURSOR-A069-PUBLIC.patch`** for integrate/commit staging, not the whole ROB2233 patch.

## Commands (reference — not rerun this slice)

```bash
npx vitest run src/app/dashboard/projects/proposal/a069-closing-editor-journey.test.tsx
```

ROB2233 author run used disposable `PRIVATE/vitest.a069.mts` for a worktree without local `node_modules`; base CI does not require it.

## Authority boundaries

No product delta, no SQL apply/reapply, no grant duplication, no commit/push/main/PR, no full suite/build, no test rerun for prose-only ROB2250. **A069 not Complete.** Independent reviewer may grade **DOC-DELTA / changelog hunk only**.
