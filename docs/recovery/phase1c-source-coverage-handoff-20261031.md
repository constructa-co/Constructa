# Phase 1C current SOURCE inventory handoff (A079 scope)

**Date:** 2026-10-31  
**Worktree branch:** `cq/cq-0710-a079-current-coverage`  
**Recovery SOURCE pin:** `7900d5ef8e010d4935f510bddd5f47937641e8ff`  
**Parent:** `b27539067fdc5882bbc617c58ad0af3508242772`

## What was wrong

`phase1a-source-coverage-20261029.json` (artifact commit `60970ff…`) correctly documented
**d86** with **116** migrations. Current backed ROOT at **7900** (ROB0425 NET eight on **b275**)
was not inventoried: **117** migrations (+ grant SQL) and eleven tracked paths on the
b275→7900 commit delta.

## What this job added

1. **`phase1c-source-coverage-20261031.json`** — pin/parent/tree, 117-file migration digest,
   ROB0425 eight product/test blobs (+ delivery/register collateral), grant SQL content SHA,
   QA apply-once / photo-not-applied qualifications, held export/restore categories unchanged.
2. **Preserved Phase 1A** — `phase1a-source-coverage-20261029.json` and handoff copied byte-identical
   from `60970ff47a92ce2da01e6e9306f608fa23e55d58` via `git show`.
3. **`a079-recovery-runbook.md`** — §1.1–1.3 (historical 679, Phase 1A superseded pin, Phase 1C
   current pin); §3 dump block labelled **DO_NOT_EXECUTE** (credential-argv unsafe pattern retained
   as explicit warning only).
4. **`phase1c-source-coverage-verification-20261031.json`** — read-only Git checks and checker test
   record for this worktree.

## Covered vs excluded (SOURCE only)

| Component | Phase 1C status |
| --- | --- |
| Git SOURCE at 7900 (117 migrations in repo) | **Covered** |
| ROB0425 NET eight product/tests (+ commit collateral) | **Covered** (git blobs) |
| Phase 1A d86/116 artifact | **Preserved** (historical, superseded for current pin) |
| QA DB apply state (except manager-named paths) | **Excluded** — not inferred |
| Production/QA DB export | **Held** — operator; run **41000587127** failed, needs Rob retry **yes** |
| Auth / Storage bytes / all refs / LFS / private work | **Held** — runbook §4–6 |
| `constructa-ops` export | **Held** — historically skipped |
| Independent restore + read-back | **Held** — §8–9 |
| A079 Complete | **Not claimed** |

## Commands used (read-only Git + local checker)

See `phase1c-source-coverage-verification-20261031.json`. **Not run:** export, restore, SQL apply,
remote fetch/push, build gate, manifest on fake EXPORT_DEST, credential reads.

## Next blocker

Authorised operator export with real `EXPORT_DEST` and `node scripts/recovery-manifest-check.mjs … --root …`
plus §8–9 read-back. Source inventory alone does not complete A079.
