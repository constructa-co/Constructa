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

### Next candidate

Sprint 51 — Resource Planning & Staff Allocation. Marked "START HERE" in the sprint table of the handover doc. Greenfield: schema + allocation engine + calendar UI + conflict detection. Owner to confirm direction.

### Repo state at sign-off

- Branch: `main` (clean, synced with `origin/main`)
- Head: `e86ed0c docs(handover): Phase 3 complete — 8 items, 142/142 tests passing`
- Untracked: dated log files in `docs/`, `docs/reviews/.../Archive.zip`, stray `page 2.tsx` dupe in final-account (pre-existing, not introduced today)
