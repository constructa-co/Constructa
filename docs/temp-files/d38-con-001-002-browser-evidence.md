# D38 CON-001 / CON-002 browser evidence

**Branch:** `cursor/constructa-d38-con-001-002-browser-reproduction-bd36`
**Parent:** `8624f49` · post-hardening head — see latest `git rev-parse HEAD`
**Merged `origin/main`:** yes (PR #170 brief smoke SQL preserved)
**Date:** 2026-11-15

## Results

| Layer | Command / artefact | Result | Notes |
|-------|-------------------|--------|-------|
| Shell guards | `npm run test:ephemeral-replay-guards` | **GREEN** | Workflow + parser + loopback guards |
| TypeScript | `npx tsc --noEmit` | **GREEN** | |
| Unit tests | `npm test` | See commit receipt | Includes loopback-on-preview guard |
| SQL smoke (#170) | `scripts/verify-phase1-smoke.sql` | **GREEN** on migration-replay job (existing workflow) | Brief RPC block unchanged |
| Hosted browser | `npm run e2e:d38-con-brief-persistence` | **NOT_RUN** | Policy: no protected hosted QA credentials |
| Ephemeral orchestrator | `bash scripts/ephemeral-replay/d38-ephemeral-browser.sh` | **NOT_RUN** | **BLOCKER:** `docker: command not found` on agent VM |
| Ephemeral Playwright (no stack) | `npm run e2e:d38-ephemeral-replay` | **GREEN** (fail-closed, exit 1 at config) | Exits before browser without loopback keys |
| Orchestrator (no Docker) | `d38-ephemeral-browser.sh` | **NOT_RUN** (exit 2) | `BLOCKER: docker is not available` |
| CI ephemeral browser | `.github/workflows/d38-con-browser-replay.yml` | **NOT_RUN** here | Plan: `docs/temp-files/d38-ephemeral-ci-execution-plan.md` |

## Expected green path (Docker available)

1. `bash scripts/ephemeral-replay/d38-ephemeral-browser.sh`
2. Expect Playwright **GREEN** for CON-001 create + CON-002 brief save + reload + service-role read-back.

## Feature head

Record `git rev-parse HEAD` from the branch after push.
