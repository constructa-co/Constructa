# Claude's Response to Perplexity + Grok Reviews — 11 April 2026

This is Claude Code's assessment of the 11 April independent reviews by
Perplexity Computer and Grok, written immediately after the reviews were
received. Used as the basis for Sprint 58 (Hardening & Robustness) in
`CONSTRUCTA_HANDOVER.md`.

---

## Source material reviewed

- `perplexity-review-report.pdf` — 7-page formal audit with SWOT, 25-item
  gap analysis table, 4-phase roadmap, and technical scorecard (overall
  grade B-).
- `perplexity-codebase-analysis.md` — file-level technical review with
  severity ratings across architecture, code quality, database, security,
  performance, maintainability, and testing.
- `perplexity-live-app-review.md` — page-by-page walkthrough of all 25+
  routes on the live Vercel deployment.
- `grok-red-team-notes.md` — Grok's informal red-team commentary with a
  "test → break → strengthen → streamline" directive.

## Which reviewer to trust more

**Perplexity is the more useful of the two for code decisions.** Real
static analysis with file:line references, `any` counts, component line
counts, specific auth-check gaps. Almost everything in its codebase
analysis is directly actionable.

**Grok is more useful as strategic pressure.** The Red Team framing and
the "no new features, harden first" directive are correct for this stage.
But Grok has factual errors (described the handover as ~2,500 words when
it's ~12,000, claimed the mobile PWA is underdeveloped when Sprint 49
shipped it) and should be treated as a sanity check, not a specification.

## What I agree with and will act on (Sprint 58 candidates)

### P1 — Safety net before any new feature work

1. **Zero `error.tsx` / `loading.tsx`** — trivially fixable, real UX gap.
   Users currently see white screens on any Supabase hiccup. Add to
   `/dashboard` and `/dashboard/projects` route groups.

2. **Zero tests on 62,000 lines** — the single biggest risk. Stand up
   Vitest and write 20-30 tests on financial calculation functions:
   contract sum, P&L variance, retention math, CIS deductions, AfP netting.
   Pure functions are the cheapest and highest-ROI starting point.

3. **60% of server actions have no `auth.getUser()` check** — `costs/actions.ts`
   alone has 15 financial functions naked to RLS as single defence. Add a
   `requireAuth()` helper in `src/lib/auth-utils.ts` and apply to every
   mutating action in `costs/`, `billing/`, `proposal/`, `variations/`,
   `schedule/`, `programme/`, `final-account/`.

4. **No Zod validation on server actions** — `schedule/actions.ts` reads
   `FormData` directly without checks, `library/actions.ts` accepts `any[]`,
   `programme/actions.ts` accepts `any[]` for phases. Add Zod to the 8
   highest-risk actions as first wave.

5. **"On Track" RAG logic is wrong** — Perplexity verified on the 22
   Birchwood overview page that the project is forecast to lose money
   (£1,899 costs vs £1,753 contract) but still shows "On Track" green.
   Fix `overview/page.tsx` RAG calculation to factor forecast-to-complete
   vs contract sum.

6. **KPI definition drift** — "Active Projects" shows 0 on home, 1 on
   pipeline, 0 on management accounts. Three different definitions of
   "active". Unify into one helper (`isActiveProject(project)`) and use
   it everywhere.

7. **Sidebar active-project context doesn't sync** with URL `projectId`
   param on Variations, Reporting, and others. Read from URL params as
   primary source in the sidebar's active-project widget.

8. **Test data in production** — "TEST SCROLL..." / "Mr Test" card visible
   in live pipeline Estimating column. Clean it out or mark it as test
   data hidden from non-admin users.

### P2 — Launch readiness (after Phase 1)

9. Core domain type interfaces (`Project`, `Estimate`, `EstimateLine`,
   `Proposal`, `Profile`) replacing the worst `any` usage, starting with
   `proposal-pdf-button.tsx` (39 `any`s), `p-and-l/page.tsx` (26), and
   `contracts/client-contract-editor.tsx` (21).

10. Forgot-password flow — Supabase's password reset API is already
    available, just needs a UI entry point on `/login`.

11. Fix Xero access-token storage — currently plaintext in DB. Encrypt at
    rest or move to Vault.

12. Cover-page assessment against live data — Perplexity noted KPI
    inconsistency, but the underlying financial model is sound. A manual
    end-to-end walkthrough with a real contractor should precede launch.

### P3 — Post-launch quality

13. Extract a shared PDF service from the 7 generators — single theme,
    header, footer, table config. Proposal PDF builder must shrink
    dramatically; 1,935 lines is untenable.

14. Break apart the 5 largest components (>1,500 lines).

15. `next/image` migration for the 27 raw `<img>` tags. `next.config.mjs`
    already has Supabase `remotePatterns` configured.

16. Incremental `any` type cleanup across the remaining files.

17. Sentry error tracking — Perplexity is right that production errors
    are invisible today.

## What I partially agree with

- **357 `any` types** — real but **cleanup is risky without tests first**.
  Correct order is Phase 1 tests → Phase 2 type interfaces → Phase 3
  incremental cleanup. Do not attempt before tests land.

- **13 files >1,000 lines / PDF monolith refactor** — real debt but
  refactoring without tests is dangerous. Perplexity's Phase 3 sequencing
  is right. Tests first, then decompose.

- **Light mode is ineffective** — Perplexity flagged it but this is P3 at
  best. The default dark theme is good.

- **Grok's "Quick Quote" parallel flow** — I agree that small jobs feel
  heavy, but **adding a parallel flow fragments the codebase further**.
  Better answer: make the existing wizard *skippable* by surfacing a
  one-click "Skip to Estimate" on project creation for simple jobs. The
  tabs are already independent; this is a routing + default change, not
  a new flow. Validate with a real contractor before building either.

## What I disagree with

- **Perplexity's CORS `*` on benchmarks API** — deliberate design. It's a
  Bearer-token authed public API meant for third-party integrations. `*`
  with Bearer is correct. No fix needed.

- **Grok's claim that "the mobile PWA is underdeveloped"** — Sprint 49
  already shipped manifest, service worker, offline fallback, install
  banner, and the on-site hub at `/dashboard/mobile`. The real gap is
  content *inside* the mobile hub (one-tap cost capture from that entry
  point), not PWA infrastructure.

- **Grok's "Quick Quote must ship in Week 2"** — too fast. Ship the
  safety net first, validate the friction is real with a contractor, then
  decide whether "skip to estimate" is enough or whether a proper template
  system is needed.

## What neither reviewer caught (but I fixed this session)

These are the most serious bugs in the repo at the start of the 11 April
session. Neither Perplexity's static analysis nor Grok's strategic review
surfaced them. They were discovered by sweeping the 74-migration schema
against every `from("projects")` query in the source tree.

1. **`schedule/actions.ts:updatePhasesAction` was silently losing all
   programme edits.** It was writing both `timeline_phases` (non-existent
   column) and `programme_phases`. The unknown column caused the entire
   Supabase UPDATE to fail silently — users' Gantt edits were never
   persisting. The bug had been in production since Sprint 19. Fix: drop
   the `timeline_phases` write entirely.

2. **12 project-picker fallbacks and 2 dashboard pages** were selecting
   `updated_at` or ordering by it. Supabase returns `{data: null}` silently
   on unknown-column selects, which is why home dashboard, admin page,
   live portfolio, and reporting project picker have been showing degraded
   data in production. Swept every occurrence to `created_at`.

3. **Billing contract sum discrepancy (£1,593.90 vs £1,753.29)** that
   Perplexity flagged as P1 — fixed in the same session. Root cause was
   `billing/page.tsx` computing `originalContractSum` from
   `estimates.total_cost` but forgetting the 10% prelims uplift that the
   canonical QS hierarchy applies before overhead/risk/profit. Rewrote to
   match `computeContractSum()` in `proposal-pdf-button.tsx` and
   `client-editor.tsx`. Now pulls `estimate_lines` so explicit Preliminaries
   lines work too.

4. **Proposal PDF cover title em-dash wrapping, About Us blank space,
   address concatenation, editor flow reorder, duplicate "Pre-filled"
   banner, test project intro/scope duplication** — all fixed in the same
   session.

All fixes pushed in commit `2b2b5c8` (fix(sprint57): proposal PDF quality,
billing formula, schema sweep).

**Implication for Perplexity's Phase 1:** ~30% of it is already done.
What remains is error boundaries, Zod, `requireAuth()`, tests, RAG logic,
KPI unification, and sidebar sync.

## Bottom line

Both reviews are valuable. Perplexity's technical detail is what I'll use
to drive Sprint 58. Grok's Red Team framing ("no new features, harden
first") is the correct posture for this stage. The user's instinct — pause
feature work and focus on robustness + streamlining — matches both
reviewers' Phase 1. That's what Sprint 58 will execute.
