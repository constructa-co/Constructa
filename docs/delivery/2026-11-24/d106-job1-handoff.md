# D106 Job 1 — A038 / A001 — 24 November 2026

## ACK (09:20 UAE batch)

- **Runs:** Job 1 → `codex/d106-job1-a038-a001-20261124` (this cloud checkout). Jobs 2–4 pending sequential on own branches.
- **Main base:** `2888fcafc7f057b296cb1cbb6df896f8587d812c` (post #263).
- **Disk (cloud agent):** ~244 GiB free on `/`; no rejected `8a83` mobile-palette worktree present in this VM. Untouched: root PDF/temp-files (~120 KiB) — not Mac `~/qf-queue` / QuantFund paths.

## A038 — SKIP (Partial, gated)

**One-line Partial:** Legacy three-photo + save refusal + CON-061 behaviour ship on main; register stays Partial for `CASE_LIBRARY_DRAFT_PHOTOS_ON_WIRE`, photos migration apply, hosted storage evidence, and `CASE_STUDY_TEXT_ENHANCE_ENABLED` — operator/release, not ungated source.

**Evidence:** `walkthrough-action-register.json` A038; `src/lib/case-library/content.ts`; `library-photo-persistence.test.ts`; migration `20261028120000_case_library_photos.sql` (hold).

**Owner:** Rob for explicit release/settings authority; R1 for subsequent authorised implementation and evidence. #238 remains separately held; this photo migration is not asserted to be part of the D101 ordered database-release stack.

## A001 — source repair (hero chrome)

**One-line Partial (unchanged overall):** Marketing site + intentional semantic blues remain; dashboard chrome still rolling — this commit aligns shared **project picker** decorative hero with programme sage pattern; status pills blues preserved.

| File | Change |
| --- | --- |
| `src/components/project-picker.tsx` | Header icon tile `emerald-500/10` (was decorative `blue-600/20`) |
| `src/components/a001-workflow-standalone-controls-brand.test.ts` | Hero sage + preserved `sent` status blue |

Checks: `vitest run src/components/a001-workflow-standalone-controls-brand.test.ts`; `npx tsc --noEmit`.

No PR by worker — R1 draft + workflow inspect.