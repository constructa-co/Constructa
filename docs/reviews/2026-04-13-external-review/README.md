# External AI Council Review — 13 April 2026

This folder contains the complete handoff package for the second-round independent AI review of Constructa, ahead of closed beta with 3-5 real contractors.

## Who reviews what

| Reviewer | Via | Focus | Prompt file |
|----------|-----|-------|-------------|
| **ChatGPT** | Atlas (agentic browser) | First-time-contractor UX walkthrough | [`01-chatgpt-atlas-prompt.md`](./01-chatgpt-atlas-prompt.md) |
| **Gemini** | Antigravity (agentic browser) | Data correctness + UK construction domain accuracy | [`02-gemini-antigravity-prompt.md`](./02-gemini-antigravity-prompt.md) |
| **Grok** | Code-only (cannot browse) | Code-level audit + structural weaknesses | [`03-grok-code-audit-prompt.md`](./03-grok-code-audit-prompt.md) |
| **Perplexity** | Live app + repo | Follow-up on 11 Apr review + Sprint 59 check | [`04-perplexity-walkthrough-prompt.md`](./04-perplexity-walkthrough-prompt.md) |

## Background — read this first

[`00-project-report.md`](./00-project-report.md) — comprehensive project status report covering:
- Executive summary
- Pre-Claude origin (Sprints 1-13)
- Sprint-by-sprint register (Sprints 14-59)
- Current codebase stats
- Known non-issues (test data)
- What's deliberately out of scope

## Workflow

1. Owner shares credentials privately with each reviewer.
2. Each reviewer receives ONE of the 4 prompts above + the project report.
3. Reviewers return structured Markdown reports matching the template in their prompt.
4. Owner consolidates findings into an action list.
5. Claude (or another AI) works the action list before beta launch.

## Previous reviews (for Perplexity context)

- [`../2026-04-11/perplexity-live-app-review.md`](../2026-04-11/perplexity-live-app-review.md)
- [`../2026-04-11/perplexity-codebase-analysis.md`](../2026-04-11/perplexity-codebase-analysis.md)
- [`../2026-04-11/grok-red-team-notes.md`](../2026-04-11/grok-red-team-notes.md)
- [`../2026-04-11/claude-response.md`](../2026-04-11/claude-response.md)
