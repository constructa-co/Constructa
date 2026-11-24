# D110 — Claude/Kimi reassignment — 24 November 2026

**Base:** `ae746fc9ff04015828bbae87349137337f84aa38` (verified main). **Not** a relaunch of D109 gated skips.

## JOB Claude — A038 → A055 → A063

| ID | One-line open on `main` | Result | Owner / evidence |
| --- | --- | --- | --- |
| **A038** | Three-photo + CON-061 behaviour ships; **Partial** for `CASE_LIBRARY_DRAFT_PHOTOS_ON_WIRE` (`src/lib/case-library/content.ts` = `false`), photos migration hold, hosted storage, `CASE_STUDY_TEXT_ENHANCE_ENABLED` | **SKIP** | Rob release/settings; D106 `d106-job1-handoff.md`; register `evidence20261120` |
| **A055** | Job-aware assistant + #259 scope parity on `main`; Partial = provider/runtime/readiness ledger caps | **SKIP** (A038 gated — no demonstrated nongated defect) | D105 changelog; PR **#259** `fcdcc2f5` |
| **A063** | Planning conversation v2 (milestones/procurement/client decisions) in `src/lib/planning-conversation.ts`, `planning-conversation-panel.tsx`, job-assistant prompts | **SKIP** (ships; activation/hosted Partial only) | `planning-conversation.test.ts`, `job-assistant-request.test.ts`; no new questionnaire |

**Branch:** none — no `codex/d110-a038-*` source repair.

## JOB Kimi — A102 / A103 / A101

| Item | Result | Evidence |
| --- | --- | --- |
| A102 social + Medium drafts | **Adequate** (no new articles) | `docs/marketing/drafts/*-2026-11-24.md`, D105 Job 3 |
| A103 pilot + plan | **Adequate** (no new metrics) | `pilot-review-plan-2026-11-24.md`, pilot articles D105/#260–262 |
| A101 live preview | **Ships** on `main`; alts for Rob only | `newsletter-signup.tsx`; D108 `2da5be77` |
| Consolidated review sheet | **Delivered** | `docs/marketing/drafts/d110-customer-copy-review-sheet-2026-11-24.md` |

**Branch:** `codex/d110-customer-copy-review-20261124` — docs only; R1 grades value; worker did not open PR.

## Worker constraints honoured

No force push, amend, rebase, `git add -A`, main push, PR merge, SQL, settings, credentials, or public copy changes.