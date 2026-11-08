# Kimi batch 4 handoff — 2026-11-08

**Status: DRAFT - ROB REVIEW REQUIRED**
Tool: Kimi (KimiCode CLI). Branch: `kimi/marketing-drafts-20261108-1020` (batch-4 commit follows; non-force push only). Timebox: started ~16:11 UAE, hard stop 17:45 UAE. Hourly ceiling ~0.5 points — paced, docs-only.

## Deliverables (all marked DRAFT - ROB REVIEW REQUIRED in-file)

1. `docs/delivery/2026-11-08/kimi-a006-trades-research.md` — batch-4 research brief for A006. Adds fresh dated sources not in the batch-2 draft: FMB/CIOB State of Trade H2 2025 (skills shortages ~72%, material costs ~75%, 48% positive outlook — second-hand, flagged), ONS output Dec 2025 (−2.1%) and Q3 2025 (+0.1%, R&M outperforming new work), conflicting firm-count figures with a reconciliation rule. Every statistic carries a citation + "unverified" flag; nothing invented; explicitly not an RC feature commitment.
2. `docs/delivery/2026-11-08/kimi-a101-newsletter-plan.md` — batch-4 plan for A101. Adds UK regulatory grounding (PECR reg. 22 individual-consent rule, corporate-subscriber exception, soft opt-in, Data (Use and Access) Act 2025 penalty increase from 5 Feb 2026 — all secondary sources, flagged as not legal advice), a 5-phase gated implementation outline, and 4 open decisions for Rob. No forms/emails/imports/DNS/activation.
3. `docs/delivery/2026-11-08/kimi-a103-content-pilot.md` — batch-4 outline for A103. Focuses on the expert-review plan (per-article reviewer profiles, hard drop rule for the CIS article) and a measurement plan that works with acquisition measurement still disabled (manual checks; honest "not measurable" state; no ranking/traffic promises).

## Relationship to earlier drafts (no duplication)

Batch 2 already produced `kimi-a006-uk-trades-research.md` (taxonomy/vocabulary), `kimi-a101-newsletter-design.md` (consent model/provider comparison/acceptance tests), `kimi-a103-content-pilot.md` (4 article briefs/SEO rules). The batch-4 files cross-reference those and add only the new angles above. Excluded per instructions: A001/A022/A074/A084/A102 drafts and the cohort welcome pack (already delivered in batches 2–3).

## Evidence and method

- Public web research only (read-only), 3 targeted searches: FMB/CIOB State of Trade 2025; ICO/PECR email-marketing rules; ONS UK construction output/business counts. Sources cited inline with URLs and publication dates; all stats flagged single-source/unverified.
- Offline source verification on this branch: confirmed `src/lib/marketing-guides.ts`, `src/components/marketing/guide-article-view.tsx`, `src/app/guides/[slug]/`, `src/lib/email.ts`, `src/lib/platform-signup-action.ts`, `src/lib/deployment/review-policy.test.ts` all exist (so cross-references in the docs are truthful), and commit 0642440 "truthful Guides attribution" exists.
- Commands of note: `git branch --show-current` / `git log --oneline -1` (branch + head 0dc435d confirmed); `df -g` (41 GiB free — above the 16 GiB floor); `ls` on the referenced source paths; `git log --grep='truthful'`.

## Tests

No tests run and none needed: docs-only change, no source edits. (Standard build/test suite deliberately not run per batch-4 constraints — no full build allowed.)

## Boundaries honoured

No build/install/dev server/deploy/merge; no touch of main, `cursor/rc-integration-20261108`, or other worktrees; no .env or credential reads; no canonical register/dashboard mutation; no subagents; no emails/forms/imports/DNS/publishing; no invented statistics. Commit + non-force push to this branch only.

## For Rob

Review the three batch-4 docs plus their batch-2 companions as a set. Key open decisions sit in `kimi-a101-newsletter-plan.md` §3 (provider, list scope, A101↔A103 coupling, legal reviewer).
