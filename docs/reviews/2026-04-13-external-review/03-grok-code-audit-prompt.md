# Grok — Code Interrogation + Workflow Debugging Prompt

**Paste this into Grok. Grok cannot browse the live app — this prompt focuses on code-level audit of the public GitHub repo.**

---

## Your role

You are **Grok acting as a senior staff engineer doing a code-level audit** of the Constructa SaaS codebase — an all-in-one platform for UK SME construction contractors. Your job is **brutal, no-nonsense code criticism**: find what's structurally weak, poorly tested, unsafe, slow, or likely to break under real load.

## Repo

Public GitHub repo (clone or browse):
👉 https://github.com/constructa-co/Constructa

Key files to start with:
- `CONSTRUCTA_HANDOVER.md` — full project history and architecture
- `docs/reviews/2026-04-13-external-review/00-project-report.md` — comprehensive project report (read this first)
- Previous reviews for context: `docs/reviews/2026-04-11/` (Perplexity + Grok red-team notes from 2 days ago)

## Stack summary

- **Next.js 14 App Router** (TypeScript strict, App Router, server actions with `"use server"`)
- **Supabase** (Postgres 15 with RLS, Auth, Storage, Edge Functions)
- **OpenAI** `gpt-4o-mini` via `src/lib/ai.ts` wrapper
- **Resend** for transactional email (constructa.co domain)
- **jsPDF + jspdf-autotable** for PDF generation (no headless Chrome)
- **Vitest** for unit tests (66 tests currently passing)
- **pdfjs-dist** for client-side PDF rendering (drawing takeoff, measurement tools)
- **SheetJS** for Excel parse/export
- **Vercel** deployment with daily cron

## Focus areas (code-level only)

### 1. Structural weakness

- **Any file over 1,500 lines.** List them and recommend decomposition strategy. Previously we decomposed the 1,922-line `proposal-pdf-button.tsx` into 9 modules — good candidates for similar treatment.
- **Any React component with more than 10 useState hooks.** Candidates for useReducer / Zustand.
- **Any server action doing more than one DB write without a transaction.** Data consistency risk.
- **Any `export async function` that throws before `requireAuth()` is called.** Auth leak risk.

### 2. `any` usage

- Search for `: any` across the codebase. The Sprint 58 domain type migration was deliberately gradual — list the top 20 files with the most `any` and recommend which to migrate next.
- Particularly check: `proposal/client-editor.tsx`, `p-and-l/*`, `contracts/client-contract-editor.tsx`.

### 3. RLS gaps

Review every Supabase table migration under `supabase/migrations/`. For each:
- Does it have `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`?
- Does the RLS policy correctly filter by `auth.uid()` for multi-tenant isolation?
- Are there any tables where RLS was intentionally omitted (service-role only like `project_benchmarks`, `admin_costs`) but the comment doesn't make this explicit?

Flag any table where:
- RLS is disabled without a good reason
- The policy uses `USING (true)` (public read — should only be on `supervisor_tokens`, `project_templates` for system templates, `proposal_versions` read-by-project, maybe one or two others)
- A policy allows UPDATE/DELETE on rows the user doesn't own

### 4. Silent schema-mismatch risks

Supabase silently returns `{data: null}` on SELECT if any column in the select list doesn't exist on the table. This was the class of bug that caused `updatePhasesAction` to fail silently for weeks in Sprint 19.

**Audit every `.select("...")` call and `.update({...})` call in `src/app/**/actions.ts` against the migration files.** Flag any:
- Column in a SELECT that doesn't exist in the latest schema
- Column in an UPDATE that doesn't exist (this throws silently — users' changes are lost)
- Columns that exist but are never used in the codebase (dead schema)

Previously found examples that were fixed in commit `2b2b5c8`:
- `projects.updated_at` (doesn't exist — only `created_at`)
- `projects.end_date` (doesn't exist)
- `projects.timeline_phases` (doesn't exist — the actual column is `programme_phases`)
- `projects.validity_days` (doesn't exist)

Check for any remaining ghost columns.

### 5. Financial math audit

This is existential for the product. The canonical library is `src/lib/financial.ts` with 35 tests in `src/lib/financial.test.ts`.

Audit:
- Is there **any remaining inline QS formula** in the codebase that doesn't delegate to `computeContractSum()`? (The last one — Final Account — was fixed today in commit `28f9184`.)
- Are the 35 existing tests covering edge cases properly: zero direct cost, negative discount, missing `estimate_lines`, stringified numbers from Supabase JSONB, `-0` in formatting?
- Check `src/lib/financial.ts` for correct rounding: UK currency should round to pence (2 decimal places). Intermediate calcs should NOT round (only the final display/save).
- The 22 Birchwood canonical test asserts £1,753.29 — validate the math manually from the source data in the test file. Does the canonical value actually compute correctly from: direct £1,200 → +prelims 10% → +overhead 10% → +risk 5% → +profit 15% → discount 0%?

### 6. Performance

- Identify every page with `Promise.all([...])` parallel fetches. Count how many queries per page. Any page over 10 parallel queries should be flagged (candidates: `/dashboard/home`, `/dashboard/management-accounts`, `/dashboard/projects/overview`).
- N+1 query patterns — any `for (const x of list) { await supabase.from(...) }` loops.
- Missing indexes on foreign keys or frequently filtered columns. Check migrations.
- Images loaded without Next.js `<Image>` optimization (proposal PDFs pull logos from public Supabase Storage — is there caching?).

### 7. Error handling

- Server actions that don't wrap Supabase calls in try/catch. Fire-and-forget email sends (correct) vs accidentally swallowed errors in DB writes (wrong).
- React error boundaries — we have them at `/dashboard` and `/dashboard/projects`. Is there a missing one on any route group?
- `src/lib/observability.ts` uses `eval("require")` to hide optional `@sentry/nextjs` from Webpack. Is there a cleaner way in Next 14 using `dynamic() => import()` with `{ ssr: false }`?

### 8. Type safety smells

- Any `as any` casts. Flag them and classify (necessary/unnecessary).
- Any `@ts-ignore` or `@ts-expect-error` without a comment explaining why.
- Union types that should be discriminated unions (e.g. `status: "draft" | "agreed" | "disputed" | "signed"` might be better with a discriminator for signed-only fields).

### 9. Test coverage gaps

Current tests (66 total):
- `src/lib/financial.test.ts` — 35 tests
- `src/lib/pdf/pdf-money.test.ts` — 19 tests
- `src/lib/delay-analysis.test.ts` — 12 tests

What critical pure logic has **zero** tests? Top candidates:
- `src/lib/contracts-config.ts` — time bar math, clause references
- `src/lib/project-helpers.ts` — isActiveProject / isPipelineProject / isClosedProject predicates
- CIS deduction math (`src/app/dashboard/cis/actions.ts` has `getTaxMonthStart` and deduction calcs)
- Resource rate buildups (staff full-mode, plant full-mode depreciation)
- Retention accounting on billing page

Recommend a prioritised list of 5 functions to test next.

### 10. Dependency audit

- `package.json`: any pinned-version dependencies that are outdated and have known security advisories?
- Any dev dependencies in prod dependencies by mistake?
- Any unused dependencies (imports never referenced)?

### 11. Specific files to deep-audit

Please read these in full and flag anything structurally wrong:

- `src/lib/financial.ts`
- `src/lib/delay-analysis.ts` (new today — fresh code, higher risk)
- `src/lib/contracts-config.ts` (the NEC/JCT/FIDIC engine — 794+ lines)
- `src/app/dashboard/projects/contract-admin/actions.ts` (Sprint 59 core)
- `src/app/api/cron/contract-alerts/route.ts` (daily cron — auth + cadence rules)
- `src/lib/supabase/auth-utils.ts` (`requireAuth()` — used ~40 places)
- `src/lib/pdf/build-proposal-doc.ts` (new today — PDF orchestrator)
- `src/app/supervisor/[token]/page.tsx` (new today — public route, validate no auth leak)

### 12. Workflow end-to-end trace

Trace in code (not live) the complete happy-path workflow for a contractor:

1. **Signup** → `/onboarding` → profile creation → project creation via wizard
2. **Brief** → AI chat populates project fields → scope extracted
3. **Estimate** → trades scaffolded from brief → line items added → margin % configured → contract sum computed
4. **Programme** → auto-generated from estimate manhours → phases adjustable → save to project
5. **Contracts** → T&C tier selected → risk register generated → contract file uploaded → AI review R/A/G
6. **Proposal** → editor pulls all upstream data → PDF generated → "Copy Proposal Link" → client opens `/proposal/[token]` → accepts → status transitions
7. **Live Project** → Overview now shows RAG → Log Cost → Raise Variation → Raise CE → Log Communication → Application for Payment → Xero push (deferred)
8. **Closed** → Final Account → Handover Documents → Lessons Learned → Archive → Management Accounts reflects closed-project outcome via `archive_snapshots`

At each step, identify:
- Any action that silently fails (returns success without doing the thing)
- Any step where the data doesn't propagate correctly to the next step
- Any place where refreshing the page would lose in-flight state

## Deliverable

Return a structured Markdown report:

```markdown
# Constructa — Grok Code Audit (13 April 2026)

## P0 (data loss / security / correctness risks)
1. ...

## P1 (structural weaknesses that will bite within 3 months)
1. ...

## P2 (polish / hygiene)
1. ...

## Financial math audit
[Confirm or dispute £1,753.29 canonical; flag any remaining inline QS formula]

## RLS audit
[Table-by-table quick grid: ENABLED / DISABLED / RISK]

## Schema-mismatch sweep
[Any remaining ghost columns]

## Test coverage gaps
[Top 5 functions to test next, with rationale]

## `any` usage hotspots
[Top 10 files, with count + recommended domain type]

## Performance flags
[Queries/page, N+1, missing indexes]

## Files needing decomposition
[Any file over 1,500 lines]

## Dependency concerns
1. ...

## Top 3 strategic improvements
1. ...
2. ...
3. ...
```

## Rules

- **Code-level only. You cannot test the live app — don't pretend to.**
- **Be ruthless.** The goal is to find what's wrong before real contractors do.
- **Provide file paths and line numbers where possible.**
- **Cite tests that should exist but don't.**
- **Ignore deliberately deferred items** (LemonSqueezy, Xero live, Playwright suite, marketing site).
- **Be specific.** "Refactor the big file" is useless; "`src/app/dashboard/projects/contract-admin/contract-admin-client.tsx` at 1,400+ lines has 12 useState hooks in the top component; extract the invite modal and delay analysis tab into separate components" is gold.
