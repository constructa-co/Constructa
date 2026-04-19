# Constructa Log — 19 April 2026

## Pre-Beta Hardening Pass (Codex brief)

**Status:** Code-side complete. Automated verification green. Owner manual walkthrough pending.

Driver document: `docs/2026-04-19-claude-hardening-brief.md` (Codex synthesis). Executed stage-by-stage with explicit approval between stages.

### Commits

| Stage | Commit | Summary |
|-------|--------|---------|
| 2 | `5d1a7fd` | Gate Intelligence + Mobile Hub (redirect + nav removed); repair Reporting schema drift (invoices/expenses/staff columns aligned; lowercase "paid" → canonical "Paid"); repair Contract Admin AI context inputs (drop dead `schedule_items` query, derive `programmeDates` from live `programme_phases`) |
| 3 | `9c14b0b` | Public proposal acceptance flow — contractor-auth email lookup now uses `createAdminClient()` (service-role) wrapped in try/catch. Previously called `auth.admin.getUserById()` on the cookie-based anon client, which silently dropped the notification or bubbled up as an acceptance failure |
| 4 | `ca89ece` | New `requireProjectAccess(projectId)` helper. Applied across 7 action files (communications / contracts / final-account / billing / programme / schedule / p-and-l) + the public proposal token-write. Row-level UPDATE/DELETE anchored by `(id, project_id)`. `updateDependencyAction` additionally verifies the predecessor estimate belongs to the owned project (the `estimate_dependencies` table has no RLS) |
| 5 | `79da034` | Canonical status + financial truth. `isActiveProject` replaces a lowercase-only check in Management Accounts; `computeContractSumValue` replaces five hand-rolled contract-value functions across Home / Reporting (×2) / Archive / Management Accounts. Fixed two silent-wrongness bugs: Home was hard-coding 5% risk, Reporting was omitting Preliminaries |
| 6 | `cdfdd3b` | Beta gating — deleted 7 dead / unreachable files (−1,906 LoC): `billing/valuation-form.tsx` + `billing/pdf-application.tsx`; full unreachable additive-markup `foundations/pdf-generator.tsx` + its 4 orphaned imports. `foundations/page.tsx` redirect and live `vision-takeoff.tsx` retained |
| 5 follow-up | `5a5d111` | `/dashboard/live/page.tsx` inline `computeContractValue` swapped for the canonical helper. Live delivery-stage view now shares code path with every other surface |

### Major decisions (per-stage, approved by owner review)

**Stage 2**
- Intelligence gated (two backing tables don't exist, contract_value column missing)
- Mobile Hub gated (filter by nonexistent `user_id` column on expenses + variations silently emptied lists)
- Reporting repaired in place; staff query repointed to `resource_allocations` (Sprint 51) with embedded staff record
- Contract Admin repaired in place; dead `schedule_items` replaced by real derived `programmeDates` from `programme_phases + start_date`

**Stage 3**
- Admin-client swap only where admin privilege is needed; wrapped in try/catch so lookup failure cannot break acceptance
- No shared helper extraction (two call sites is below the DRY threshold)
- await-vs-fire-and-forget asymmetry preserved: accept action awaits `Promise.all`, viewed render uses fire-and-forget

**Stage 4**
- `requireProjectAccess` runs alongside RLS, not in place of it
- Row-level mutation anchors on every UPDATE/DELETE to close spoofed-projectId loophole
- Three actions without `projectId` in their signature use fetch-and-check (avoid caller ripple): `deleteCostAction`, p-and-l `updateInvoiceStatusAction`, `updateDependencyAction`
- `updateDependencyAction` patched mid-review to verify both successor AND predecessor estimates belong to the same owned project (estimate_dependencies has no RLS)
- Public proposal token-write hardened: `.select().single()` after the update, abort with user-facing error if the row did not flip

**Stage 5**
- Two review-patch iterations — first pass passed `[]` to `computeContractSumValue` which double-counted Preliminaries because `estimates.total_cost` already includes prelims line totals. Fixed by fetching `estimate_lines(trade_section, line_total)` and feeding real lines in Archive + Management Accounts (Home + Reporting already did this in the first pass)
- Hand-rolled 5% risk in Home was a real bug, now fixed via canonical helper
- Reporting omitted Preliminaries summand, now fixed via canonical helper

**Stage 6**
- Foundations was already gated via a redirect in `page.tsx`; the deletion work removed the orphaned additive-markup files so the bug is gone from the repo, not just gated
- Stage 5 follow-up on `/dashboard/live` deliberately chose canonicalise over gate because the surface renders real data and is revalidated from server actions

### Verification — automated

- `npx tsc --noEmit` — **pass** (0 errors)
- `npx vitest run` — **pass** (142 / 142 across 7 test files, ~1s)
- `npx next build` — **pass** (clean production build; gated redirect routes compile to 192 B stubs)

### Verification — manual (owner-led, pending)

Walkthrough checklist lives in the Stage 7 report. Key cross-cutting things to watch for:

1. Contract values agree across Home, Reporting, Management Accounts, Proposal, Billing, Archive
2. Management Accounts status pill colours canonical-`Active`/`Won`/legacy-`active` all blue consistently
3. `/dashboard/intelligence` + `/dashboard/mobile` both redirect to `/dashboard/home`
4. `/dashboard/foundations` redirects; Vision Takeoff still works inside Estimating
5. Proposal acceptance emails still arrive (contractor + client)
6. No "Unauthorized project access." errors on the happy path for any mutation

### Deferred items (explicit — not blocking beta)

- **Out-of-band schema** — live columns not in committed migrations. Reconciliation migration deferred to post-beta infra-hygiene pass.
- **`estimate_dependencies` RLS** — add policy in the same reconciliation pass. Stage 4 server-side check stands until then.
- **`/dashboard/data/{labor,plant,materials}`** — nav-less routes superseded by `/dashboard/resources/*` + `/dashboard/library`. Triage later.
- **`src/app/dashboard/projects/final-account/page 2.tsx`** — stray pre-existing duplicate file, untracked. Delete in housekeeping.
- **Playwright / E2E suite** — deferred to feature-complete per owner testing strategy.

### Repo state at sign-off

- Branch: `main` — clean working tree
- HEAD: `5a5d111 harden(stage-5-followup): canonicalise /dashboard/live contract-value math`
- Synced with `origin/main`
- Vercel: auto-deployed each stage commit
- Untracked files (pre-existing): user-owned dated log `.docx` / `.pdf` files, review archive zip, `final-account/page 2.tsx`

### What future agents / future Robert should know

1. This pass was **subtractive and defensive**. 1,906 lines of dead code removed, one new helper added (`requireProjectAccess`), and five surfaces converged onto shared helpers. No new features.
2. If you're about to edit a project-scoped server action, **use `requireProjectAccess(projectId)`** from `src/lib/supabase/auth-utils.ts`, not raw `requireAuth()`. The helper returns `{ user, supabase, project }` exactly like a destructured auth check.
3. If you're about to compute a contract value, **call `computeContractSumValue(estimate, estimate_lines)`** from `src/lib/financial.ts`. Pass real `estimate_lines(trade_section, line_total)` whenever you have them — passing `[]` makes the helper treat `total_cost` as direct cost and re-apply prelims via `prelims_pct`, which double-counts if the estimate has explicit Preliminaries lines.
4. If you're about to filter by project status, **call `isActiveProject(p)` / `isPipelineProject(p)` / `isClosedProject(p)`** from `src/lib/project-helpers.ts`. They handle canonical mixed-case AND legacy lowercase rows.
5. If a surface is showing wrong or empty data on the beta path, the Stage 2 approach was **gate first, repair second**. A narrower trustworthy beta beats a broad uncertain beta.
