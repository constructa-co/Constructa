# Constructa Log — 17 April 2026

## Phase 3 — AI Council Pre-Beta Hardening (COMPLETE)

Eight items from Perplexity's consolidated implementation brief, all shipped and pushed to `main`. Vercel auto-deployed each commit.

### Commits

| # | ID | Commit | Summary |
|---|----|--------|---------|
| 1 | P2-7 | `2a297c4` | **bulkAddMoMItemsAction N+1 fix** — depth-batched upserts; ~400 queries → ~4 for a 100-item 3-level MoM import. |
| 2 | P1-2 | `bf61173` | **FIDIC 42-day detailed claim** — new `fromAware` flag on `EventStep`; cl. 20.1 detailed-claim step anchored to `dateAware`, not prior notice date. Fixes silent deadline drift when contractor raises event late. FIDIC 2017 inherits. |
| 3 | P2-3 | `abf6911` | **Sign-up UX** — separate `signin`/`signup` modes, separate emerald-success vs red-error banners (was rendering success as error), confirm-password field, ≥8-char client-side check. |
| 4 | P2-4 | `ad43c52` | **Landing copy consistency** — dual email addresses collapsed to `hello@constructa.co` `mailto:`; "Live Chat / 9am–5pm GMT" replaced with realistic "Response Time / Within 1 working day". |
| 5 | P2-5 | `210b8a1` | **Win Rate min-dataset guard** — `MIN_SAMPLE_WIN_RATE = 3`; below threshold shows `—` with "Need N more proposals" subtitle instead of misleading 0% or 100% from a single proposal. `winRateSampleSize` threaded server → client. |
| 6 | P2-8 | `63475a7` | **+41 Vitest tests** — 14 in `project-helpers.test.ts` (partition invariant: every status classified into exactly one of active/pipeline/closed), 27 in `contracts-config.test.ts` (NEC4 56d, FIDIC 28d + 42d, `fromAware` anchoring, aiGuidance coverage for 10 critical events, obligationRag traffic light). 101 → 142 tests. |
| 7 | P2-2 | `d47d0d4` | **Home `loading.tsx` skeleton** — header row, 2×4 KPI grid, active + pipeline panels animating via `animate-pulse`. Next.js streams immediately on navigation while the 700-line HomeClient hydrates. Pragmatic ~80% win vs full Suspense-per-panel refactor. |
| 8 | P2-6 | `3cc4661` | **contract-admin monolith decomposed** — new `contract-admin/components/` subdirectory: `types.ts` (9 shared interfaces), `badges.tsx` (`fmt`/`RagBadge`/`StatusBadge`), `SupervisorInvite.tsx` (145 lines), `DelayAnalysisTab.tsx` (325 lines + 4 result-table renderers). Main file 1,598 → 1,138 lines (−29%). Pure move, no behaviour change. |
| — | docs | `e86ed0c` | Handover doc updated with Phase 3 completion table. |

### Verification

- `tsc --noEmit` — 0 errors
- `vitest run` — **142/142 passing** (was 101 at end of Phase 2)
- `next build` — clean
- Vercel — deployed from `main` after each push

### Cumulative position

- Phases 1 + 1.5 + 2 + 3: **27 commits / 27 verified AI Council findings shipped**
- Every accepted item from the 5-reviewer Council (ChatGPT/Atlas, Gemini, Antigravity, Grok, Perplexity) is now live
- Product is structurally ready for real beta contractors: canonical financial math, observable errors on every mutating action, no Radix violations, DST-safe date math, 142-test safety net on core helpers

### Sprint 59 reconciliation (end of day)

On audit, the three items listed as "pending" in `~/.claude/plans/partitioned-knitting-pizza.md` had all been shipped in earlier commits before the AI Council hardening even began. The plan file was stale. Verified live:

| Item | Commit | Evidence |
|------|--------|----------|
| FIDIC engineer_instruction aiGuidance (cl. 13.1, 13.3, 20.1 / 20.2.1) | `e2ce91d` | `src/lib/contracts-config.ts:667` (Red 1999 body) + `:755` (Red 2017 override, 2017 editions inherit) |
| Supervisor / sub-contractor portal | `2bca4d2` | `src/app/supervisor/[token]/{page.tsx,actions.ts,supervisor-portal-client.tsx}` live; `/supervisor/[token]` rendered in Next build at 2.8 kB / 100 kB; `supervisor_tokens` migration applied |
| SCL Delay Analysis Protocol | `d167cb7` | `src/lib/delay-analysis.ts` with 12 Vitest tests passing; `runDelayAnalysisAction` + `draftDelayNarrativeAction` in contract-admin actions; `delay_analyses` migration applied |

**Sprint 59 is fully CLOSED.** 6 commits total: `e149cfa` → `0593fc9` → `bde2fce` → `e2ce91d` → `2bca4d2` → `d167cb7`.

### Sprint 51 reconciliation (second stale-plan catch)

Before starting "Sprint 51", audited first. Already shipped 10 Apr 2026 — 1,423 LoC across `src/app/dashboard/resources/portfolio/`, migration `20260410000000_sprint51_resource_planning.sql` applied, all 3 tabs live (Portfolio Timeline CSS Gantt, Manage Allocations CRUD, Demand vs Supply). Sprint plan table at bottom of handover was dated 10 Apr 2026 and missed Sprints 51 / 58 / 59 / AI Council entirely.

Reconciled in commit `56a30d1` — table now shows all four as complete and flags Sprint 57 (structured pre-launch QA) as the real next branch.

### Sprint 57 — Polish, Testing & Pre-Launch QA (deferred to next working day)

Owner's call: this sprint requires a guided manual walkthrough of the full site. Can't be run autonomously. Deferred to the next working session. Owner will lead step-by-step; assistant will fix on findings.

Scope anchors (from handover Strategic Decisions Log, lines 1874–1880):
1. Full workflow test: new project → estimate → programme → proposal → live project → billing → P&L → final account → handover → lessons learned, with real numbers that can be manually verified
2. Financial logic deep-check: contract value, invoice netting, retention, P&L margin
3. Known bugs resolved before any contractor is given access

### What's left of the original backlog

| Sprint | Status |
|--------|--------|
| 52 LemonSqueezy Billing | Deferred — UAE freezone company + bank account + merchant account required first |
| 53 Xero Activation | Code already shipped in Sprint 44; waiting on env vars only |
| 54 QuickBooks / Sage | Deferred — external dependency |
| 55 CAD / BIM / Drawing Viewer | Strategic moat, long horizon |
| 56 Bank Reconciliation | Deferred until post-billing launch |
| 57 Polish, Testing & Pre-Launch QA | **NEXT — owner-guided manual session** |

### Today's commits (9)

```
56a30d1 docs(sprint-plan): reconcile table — 51/58/59/AI-Council all shipped, 57 is next
6ff2743 docs(sprint59): reconcile — confirm all 3 'pending' items already shipped
e86ed0c docs(handover): Phase 3 complete — 8 items, 142/142 tests passing
3cc4661 refactor(contract-admin): P2-6 decompose 1,598-line monolith
d47d0d4 perf(home): P2-2 loading.tsx skeleton streams immediately on navigation
63475a7 test(core): P2-8 — 41 tests for project-helpers + contracts-config
210b8a1 fix(kpi): P2-5 min-dataset guard on Win Rate KPI
ad43c52 fix(landing): P2-4 copy consistency — single email address, realistic response
abf6911 fix(auth): P2-3 sign-up UX — separate success vs error, confirm password
bf61173 feat(fidic): P1-2 detailed-claim deadline anchored to dateAware
2a297c4 perf(library): P2-7 bulkAddMoMItemsAction — batch by depth, not per-item
```

(11 actually — Phase 3's 8 items + 2 reconciliation + this log commit.)

### Repo state at sign-off

- Branch: `main` — clean working tree (excluding untracked user log files in `docs/`)
- HEAD: `56a30d1 docs(sprint-plan): reconcile table — 51/58/59/AI-Council all shipped, 57 is next`
- Synced: `origin/main` is level with HEAD
- Vercel: auto-deployed on each push
- Verification: `tsc --noEmit` clean · `vitest run` 142/142 · `next build` clean
- Untracked: user-owned dated log `.docx`/`.pdf` files, review archive zip, stray `page 2.tsx` in final-account (pre-existing — unrelated to today's work)
