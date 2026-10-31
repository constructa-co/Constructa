# Phase 1A current-source coverage handoff (A079 / A080 scope)

**Date:** 2026-10-29  
**Branch for this artifact:** `codex/phase1b-a079-current-source-manifest-20261029`  
**Accepted source head (manager):** `d86dca62643fac61dda89a05916d99b966193c79` on
`backup/welcome-first-slice-20261018`

## What was missing

`a079-recovery-runbook.md` section 1 still pointed at app commit **679** (112 migrations)
and programme **3cd4bf**. That remains valid **history** but did not document the
**currently accepted** Phase 1A tree after parent **b5** and A059-night integration (**d86**).

## What this job added

1. **`phase1a-source-coverage-20261029.json`** — pins, 20-path b5→d86 blob inventory,
   migration delta since 679, A059 v2 SQL content SHA `809c218c…`, OFF-readiness sample
   (`APPROVED_GENERATION` all null), and explicit **held** rows for DB/Auth/Storage/refs.
2. **Runbook §1.1–1.2** — separates historical 679 table from current coverage without
   deleting prior records.

## What is still open (A079 Partial)

| Component | Status |
| --- | --- |
| Git source at d86 on named backup branch | **Covered** (this manifest) |
| Authored SQL in repo (116 migrations) | **Covered** (not applied) |
| Production/QA DB export | **Held** — operator |
| Auth provider secrets / config boundary files | **Held** — operator |
| Storage bucket bytes | **Held** — operator |
| All refs, LFS, private unsaved work | **Held** — §6 reconciliation |
| `constructa-ops` export | **Held** — historically skipped |
| Independent restore + read-back | **Held** — §8–9 |

## Commands used (read-only Git)

```bash
git fetch origin backup/welcome-first-slice-20261018 d86dca62643fac61dda89a05916d99b966193c79
git rev-parse d86dca62643fac61dda89a05916d99b966193c79^{tree}
git ls-tree -r --name-only d86dca62643fac61dda89a05916d99b966193c79 supabase/migrations | wc -l
git diff --name-only b5f513896eb07834e055e260536584ee7d0b708e..d86dca62643fac61dda89a05916d99b966193c79
sha256sum supabase/migrations/20261029103000_project_working_pattern_v2.sql
```

**Not run:** `recovery-manifest-check.mjs` on a fake export (would require placeholders or
waivers for every category); existing `.test.mjs` duplicate-ref suite; practice/SQL apply;
export/restore/copy; Node ROOT build gate.

## Next real blocker

An authorised operator must still produce a real `EXPORT_DEST` manifest passing
`node scripts/recovery-manifest-check.mjs … --root …` with section 8 reconciliation —
source documentation alone cannot complete A079.
