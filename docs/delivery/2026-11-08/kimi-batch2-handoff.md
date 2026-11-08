# Kimi batch 2 handoff — 2026-11-08

**Status: complete for this batch. All items DRAFT — ROB REVIEW REQUIRED.**
Branch: `kimi/marketing-drafts-20261108-1020` (base 790fabb). Tool: Kimi Code CLI. Window: 12:00 UAE, bounded ≤90 min; actual wall time well under that.

## What was delivered (this commit)

Two feasibility/design drafts plus this handoff, in `docs/delivery/2026-11-08/`:

1. `kimi-a022-import-feasibility.md` — A022 review. Key conclusions:
   - Website import **already exists** on this branch (`src/lib/company-import/`: net-policy, robots gate, deterministic extraction, human-in-loop draft expiry). Register "Partial" is consistent.
   - LinkedIn/Facebook auto-import: **not feasible** under current rules — both sites' robots.txt banners prohibit automated collection without permission (verified by read-only `curl` 2026-11-08), the existing robots gate would refuse them, and official APIs require account connection (out of scope). Recommended shape: website import as-is + optional manual "paste your public About text" (option A), or defer social (option B). No scraping, no account connection performed.
2. `kimi-a074-cover-imagery.md` — A074 policy draft. Cover today is logo+text only (`proposal-brochure.ts:792`). Tier rules: real own-work photos preferred (from case-library upload, never hotlinked); renders/before-after allowed only with fixed, PDF-text-layer labels; stock/AI-as-real never. Includes acceptance tests for whenever the feature is built.

No overlap with the earlier A006/A101/A103 drafts; no other agents' files touched.

## Commands and results (exact)

| Command | Result |
| --- | --- |
| `git branch --show-current` / `rev-parse HEAD` | `kimi/marketing-drafts-20261108-1020` @ 790fabb364c4d05dac292d6f3f9c4ddd325ad81b |
| `df -h /` | 18 GiB free (≥16 threshold; checked before test groups) |
| `curl -s --max-time 15 https://www.linkedin.com/robots.txt` (head -30) | Banner: automated access prohibited without express permission; paths Disallow for general agents |
| `curl -s --max-time 15 https://www.facebook.com/robots.txt` (head -40) | Banner: automated data collection prohibited without express written permission |
| `vitest run src/lib/company-import/` (via live-repo node_modules, read-only) | 6 files, **99 passed**, 2.1 s |
| `vitest run src/lib/pdf/proposal-brochure.test.ts` | 1 file, **38 passed**, 0.9 s |

Source inspection: `src/lib/company-import/{net-policy,extract,draft}.ts`, `src/app/dashboard/settings/profile/import/`, `src/lib/pdf/proposal-brochure.ts`, `src/app/dashboard/settings/case-studies/library/case-study-editor.tsx`.

## Not done / boundaries kept

- No full build, no install, no new node_modules (worktree has none; live repo's used read-only), no dev server, no deploy, no merge, no push to anything but this branch, no PR, no SQL, no settings change, no real signup/posting, no credential or `.env` reads, no subagents.
- No canonical register/dashboard mutation.
- Everything is offline evidence: no real-email/hosted/human/DB acceptance claims. robots.txt observations cover only the banner/first paths — full per-path matrices not exhaustively parsed (marked unverified in the doc).

## Status at handoff

- Tests: targeted vitest groups green (99 + 38). No full suite run (out of scope for this batch).
- Commit: this branch only, no force. Push: same branch, non-force, no PR — to be done in the same action as this handoff write.
- Next: Rob reviews the three drafts; A022/A074 stay DRAFT until his decision. If option A for A022 is approved, a follow-up batch can spec the paste flow and its tests.
