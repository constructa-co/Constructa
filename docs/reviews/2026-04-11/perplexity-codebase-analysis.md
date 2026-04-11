# Constructa Platform — Comprehensive Code Quality & Architecture Review

**Date:** 2026-04-11
**Codebase:** ~62,300 lines across ~245 TypeScript/TSX files
**Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Supabase, OpenAI, jsPDF

---

## Executive Summary

Constructa is a well-structured Next.js 14 SaaS application for construction project management. The architecture follows App Router conventions competently — server components for data fetching, client components for interactivity, server actions for mutations — with a clean three-tier Supabase client pattern. However, the codebase has accumulated significant technical debt typical of a fast-moving startup: zero test coverage, 357+ uses of `any` types, 13 components over 1,000 lines, inconsistent authorisation patterns in server actions, and no error/loading boundaries.

**Overall Grade: B-** — Solid architecture, rapid feature delivery, but growing quality and security gaps that will compound if not addressed.

### Top 5 Actions (If You Do Nothing Else)

1. **Add `error.tsx` and `loading.tsx`** to `/dashboard` and `/dashboard/projects` — users currently see white screens on failures
2. **Add Zod validation** to server actions accepting `FormData` or `any[]` — this is a security gap
3. **Start a test suite** — even 20 integration tests on the highest-risk flows (billing, proposals, auth) would be transformative
4. **Type the 10 worst `any`-heavy files** — especially `proposal-pdf-button.tsx` (39 `any` uses) and `p-and-l/page.tsx` (26)
5. **Extract a shared PDF service** — 7 PDF generators with duplicated logic; the proposal one alone is 1,935 lines

---

## 1. Architecture Quality

### 1.1 App Router Structure — Good

The route structure under `src/app/` is logical and well-organised:

```
src/app/
├── (public)    about/, contact/, features/, pricing/, landing/, product/
├── (auth)      login/, auth/callback, auth/confirm, auth/reset-password
├── onboarding/ Company onboarding wizard
├── dashboard/  Protected SaaS application
│   ├── home/
│   ├── projects/        (26 sub-modules — largest feature area)
│   │   ├── billing/     costs/ contracts/ proposal/ schedule/ etc.
│   ├── accounting/      Bank reconciliation
│   ├── library/         MoM cost library
│   ├── resources/       Staff, plant, portfolio
│   ├── reporting/       Analytics
│   └── settings/        Profile, API keys, integrations
├── admin/      Internal analytics (protected by ADMIN_EMAIL check)
├── proposal/[token]/  Public proposal acceptance (token-based)
└── api/        REST endpoints (benchmarks, theme, xero callback)
```

**Verdict:** Clean, predictable structure. The 26 sub-modules under `projects/` are well-scoped.

### 1.2 Server/Client Component Split — Good with Gaps

| Pattern | Count | Assessment |
|---------|-------|------------|
| `"use client"` directives | 112 files | Heavy client-side footprint |
| `"use server"` directives | 42 files | Clean action isolation |
| API routes (`route.ts`) | 3 files | Minimal REST surface |
| Layout components | 5 files | Proper nested layouts |

**Positive:** Each feature module follows a consistent `page.tsx` (server) → `*-client.tsx` (client) → `actions.ts` (server) pattern. The dashboard layout (`src/app/dashboard/layout.tsx:13`) properly uses `Promise.all` for parallel data fetching.

**Gap:** Some pages that are primarily static render entirely as client components when they could push interactivity down to leaf components. The landing page and login page are examples where server rendering could reduce JavaScript bundle size.

| Severity | Finding |
|----------|---------|
| Low | `src/app/landing/page.tsx` — entire page is client-rendered; static content could be server-rendered with interactive parts extracted |
| Low | `src/app/login/page.tsx` — mostly static form, could be a server component with a client form island |

### 1.3 Separation of Concerns — Good

The `actions.ts` pattern is consistently applied. Server actions handle:
- Database mutations via Supabase
- File processing (PDF generation triggers, CSV imports)
- Third-party API calls (OpenAI, Resend email, Xero)
- Path revalidation

Client components handle:
- User interaction, forms, state management
- PDF generation (client-side via jsPDF)
- File uploads
- UI rendering

### 1.4 Supabase Client Pattern — Excellent

Three-tier client strategy in `src/lib/supabase/`:

| File | Key | Purpose | Security |
|------|-----|---------|----------|
| `client.ts` | Anon key | Browser components | RLS enforced |
| `server.ts` | Anon key + cookies | Server components/actions | RLS enforced, session-aware |
| `admin.ts` | Service role key | Admin-only operations | Bypasses RLS, server-only |

**`admin.ts:1-31`** — Well-documented with explicit warnings against client-side use. Validates env vars with descriptive errors. Only imported in `api/v1/benchmarks/route.ts` and `admin/actions.ts`.

**`server.ts:18-31`** — Follows Supabase SSR best practices. The `set`/`remove` cookie methods correctly swallow errors in Server Components (standard pattern when middleware handles session refresh).

**`auth-utils.ts:7-46`** — `getActiveOrganizationId()` provides organisation-scoped data isolation with a sensible fallback (auto-selects first membership if no active org). Small typo on line 17: "organicaton" → "organization".

### 1.5 Middleware — Good with Minor Issues

**`src/middleware.ts`**

| Line | Feature | Assessment |
|------|---------|------------|
| 72-74 | Dashboard route protection | Correct |
| 77-79 | Admin route protection | Correct (layout adds email check) |
| 83-93 | Onboarding redirect | Correct but adds a DB query per request |
| 97-109 | Country capture | Fire-and-forget, won't block response |

| Severity | Finding |
|----------|---------|
| Medium | **Line 84-88:** Profile query runs on *every* dashboard request to check `company_name`. After onboarding is complete this is wasted I/O. Consider caching in a cookie or session claim. |
| Low | **Line 108:** `.then(() => {})` is an unusual fire-and-forget pattern. Works but could use `void supabase.from(...)` for clarity. |

### 1.6 Circular Dependencies / Tight Coupling

No circular import issues detected. The dependency graph is clean:
- `lib/supabase/*` → imported by actions and pages
- `lib/ai.ts` → imported by specific server actions
- `components/*` → imported by page-level client components
- No cross-module imports between feature modules

**Verdict: Architecture is solid.** The main structural risk is the sheer size of individual files rather than the dependency graph.

---

## 2. Code Quality Issues

### 2.1 TypeScript Strictness — Significant Gaps

**`tsconfig.json` has `"strict": true`** — which is good. But the codebase works around it heavily.

**Total `: any` occurrences: 357+ across 64 files**

| File | `any` Count | Severity |
|------|-------------|----------|
| `projects/proposal/proposal-pdf-button.tsx` | 39 | Critical |
| `projects/p-and-l/page.tsx` | 26 | High |
| `projects/contracts/client-contract-editor.tsx` | 21 | High |
| `projects/overview/page.tsx` | 20 | High |
| `dashboard/live/page.tsx` | 19 | High |
| `projects/p-and-l/log-cost-sheet.tsx` | 15+ | High |

**Total `as any` type assertions: 59 across 20 files**

The worst offender is `proposal-pdf-button.tsx` with 28 `as any` casts, mostly for jsPDF's `autoTable` plugin which has weak TypeScript typings. The `(doc as any).lastAutoTable.finalY` pattern appears 11+ times across PDF files.

| Severity | Finding | Recommendation |
|----------|---------|----------------|
| Critical | `proposal-pdf-button.tsx:12-15` — All component props typed as `any[]` / `any` | Create proper interfaces for `Estimate`, `Project`, `Profile` |
| High | `schedule/actions.ts:77,84,89` — Supabase query results cast to `any` in loops | Type the Supabase table returns |
| High | `programme/actions.ts:12` — `saveAsBuiltPhasesAction` accepts `phases: any[]` | Create `Phase` type and validate |
| Medium | `library/actions.ts:70` — `bulkAddMoMItemsAction` accepts `items: any[]` | Define `MoMImportItem` interface |

**No `@ts-ignore` or `@ts-nocheck` found** — this is positive; developers are using `any` rather than suppressing the compiler entirely.

### 2.2 Error Handling — Mixed

**Pattern observed:** Most server actions use `console.error` + continue, rather than throwing or returning structured errors.

| Severity | Finding | File:Line |
|----------|---------|-----------|
| High | Empty catch block silently swallows error | `dashboard/library/page.tsx:11` |
| High | `error` caught but only logged, function continues with undefined data | `costs/actions.ts:22` — `createEstimateAction` logs error but returns `data` which may be null |
| Medium | 11 catch blocks use `catch (error: any)` instead of typed error handling | Multiple files |
| Medium | `costs/actions.ts:59` — `updateEstimateMarginsAction` logs error but doesn't return it to the caller; client has no way to know the update failed | |
| Low | 67 instances of `console.error`/`console.warn` — appropriate for server-side logging but no structured error tracking (Sentry, etc.) | |

**Positive:** The `accounting/actions.ts` shows a better pattern — functions return `{ error: string }` or `{ success: true }`, giving clients actionable feedback.

### 2.3 Loading & Error Boundaries — MISSING

| Severity | Finding |
|----------|---------|
| **Critical** | **Zero `loading.tsx` files** in the entire application |
| **Critical** | **Zero `error.tsx` files** in the entire application |

This means:
- Users see no loading indicator while server components fetch data
- Unhandled errors in any page crash the entire layout with no recovery option
- No graceful degradation on network failures

**Recommendation:** At minimum, add:
- `src/app/dashboard/loading.tsx` — skeleton/spinner for all dashboard routes
- `src/app/dashboard/error.tsx` — error boundary with retry for dashboard
- `src/app/dashboard/projects/loading.tsx` — for the heaviest route group

### 2.4 Code Duplication — PDF Generators

Seven PDF generation files with significant duplication:

| File | Lines | Pattern |
|------|-------|---------|
| `proposal/proposal-pdf-button.tsx` | 1,935 | Custom, massive |
| `p-and-l/log-cost-sheet.tsx` | 1,705 | Inline PDF logic |
| `final-account/final-account-pdf-button.tsx` | 517 | Custom |
| `billing/invoice-pdf-button.tsx` | ~400 | Custom |
| `billing/pdf-application.tsx` | ~350 | Uses `pdf-utils` |
| `contracts/contract-pdf-button.tsx` | ~300 | Uses `pdf-utils` |
| `foundations/pdf-generator.tsx` | ~250 | Uses `pdf-utils` |
| `variations/variation-pdf-button.tsx` | ~200 | Uses shared pattern |

**Duplicated patterns across these files:**
- Theme colour definitions (repeated in each file)
- Company logo/header rendering
- Footer with page numbers
- Table styling configuration
- `(doc as any).lastAutoTable.finalY` positioning hack

**A shared `lib/pdf/` already exists** (`pdf-utils.ts`) but only 3 of 7 generators use it. The proposal PDF is the worst offender — it's a 1,935-line monolith.

| Severity | Recommendation |
|----------|----------------|
| High | Extract shared PDF theme, header, footer, and table styling into `lib/pdf/pdf-theme.ts` |
| High | Break `proposal-pdf-button.tsx` into sections: cover page, scope, pricing, terms, appendices |
| Medium | Standardise all PDF generators to use the shared utils |

### 2.5 Console Statements in Production

| Severity | Finding | File |
|----------|---------|------|
| Low | 1 `console.log` in production code | `projects/contracts/actions.ts` |
| Acceptable | 67 `console.error`/`console.warn` instances | Proper error logging |

### 2.6 ESLint Disables

18 `eslint-disable` comments found — all justified:
- 8x `@next/next/no-img-element` (using raw `<img>` for Supabase storage URLs)
- 5x `react-hooks/exhaustive-deps` (intentional effect triggers)
- 2x `@typescript-eslint/no-explicit-any` (API boundaries)

---

## 3. Database & Data Layer

### 3.1 Supabase Query Patterns — Generally Good

Queries use the Supabase SDK properly with `.from().select().eq()` chains. No raw SQL. The `api/v1/benchmarks/route.ts` uses `.rpc()` for atomic counter increments (good).

**Good pattern — `dashboard/layout.tsx:13`:**
```typescript
const [{ data: projects }, { data: profile }] = await Promise.all([
    supabase.from('projects').select('id, name, client_name')...
    supabase.from('profiles').select('company_name, theme_preference')...
]);
```

28 files use `Promise.all` for parallel queries — strong pattern.

### 3.2 N+1 Query Patterns — Two Critical Issues

| Severity | Location | Issue |
|----------|----------|-------|
| **Critical** | `library/actions.ts:76-116` — `bulkAddMoMItemsAction` | Nested loop: for each item, iterates through category levels calling `.upsert()` individually. Importing 100 items with 3-level categories = ~400 separate DB queries. Should batch upserts. |
| **High** | `accounting/actions.ts:177-220` — `autoMatchTransactionsAction` | Nested loop iterating all unreconciled transactions × all unpaid invoices. While matching is in-memory (no per-iteration queries), the O(n²) complexity will degrade with scale. |

**`library/actions.ts:76-101` in detail:**
```typescript
for (const item of items) {                    // N items
    for (let i = 0; i < levels.length; i++) {  // ~3 levels each
        await supabase.from("mom_categories").upsert({...})  // DB call per level
    }
    await supabase.from("mom_items").upsert({...})           // DB call per item
}
// Total: N × (levels + 1) queries
```

**Recommendation:** Batch category upserts with `supabase.from("mom_categories").upsert(allCategories)` then batch item inserts.

### 3.3 Migration Quality — Good

89 migration files in `supabase/migrations/`, well-named with dates and feature descriptions:
- `20260117000000_foundations_estimator.sql`
- `20260312000000_organization_model.sql`
- `20260324000006_fix_org_member_rls.sql`
- `20260410160000_sprint59_contract_admin.sql`

Migrations include comprehensive RLS policies, proper foreign keys, and index creation.

### 3.4 RLS Policies — Comprehensive

Core policies cover all CRUD operations on user data:
- `select_own_projects`, `insert_own_projects`, `update_own_projects`, `delete_own_projects`
- Similar full coverage for estimates, estimate_lines, assemblies, assembly_items
- Organisation-scoped policies using `auth.uid()` and membership checks
- Fixed circular dependency in org member RLS (`20260324000006`)

**Notable:** A circular dependency in the original org_members RLS (which used `get_my_organizations()` which itself queried `org_members`) was caught and fixed with a direct `user_id = auth.uid()` check.

### 3.5 Error Handling on DB Operations — Inconsistent

| Pattern | Files | Assessment |
|---------|-------|------------|
| `if (error) throw new Error(error.message)` | ~10 | Good — propagates to client |
| `if (error) console.error(...)` (no return) | ~15 | Bad — silent failure |
| `if (error) return { error: error.message }` | ~8 | Good — structured response |
| No error check at all | ~5 | Bad — ignores failures |

| Severity | Finding | File:Line |
|----------|---------|-----------|
| High | `deleteRateOverrideAction` — no error check on delete operation | `library/actions.ts:160-164` |
| High | `updateEstimateMarginsAction` — error logged but not returned | `costs/actions.ts:49-60` |
| Medium | `updateDependencyAction` — no error check on any of 3 sequential operations | `schedule/actions.ts:13-26` |

---

## 4. Security Review

### 4.1 Authentication Flow — Good

**Middleware (`middleware.ts`):**
- `/dashboard/*` routes redirect unauthenticated users to `/login`
- `/admin/*` routes redirect unauthenticated users to `/login`
- Admin layout adds email verification against `ADMIN_EMAIL` env var

**Auth callback (`auth/callback/route.ts`):**
- Handles PKCE code exchange (OAuth standard) ✓
- Handles `token_hash` flow for email links ✓
- Safe redirect pattern — uses `origin` from request URL ✓
- Type-safe OTP verification ✓

### 4.2 Exposed Secrets — None Found

- `.gitignore` properly excludes `.env*` files ✓
- `env.local.example` has placeholder values only ✓
- No committed `.env` files in git history ✓
- OpenAI key accessed server-side only (`lib/ai.ts`) ✓
- Supabase service role key used only in `admin.ts` ✓

### 4.3 Server Action Authorisation — INCONSISTENT (Critical)

This is the most significant security finding. Server actions have an inconsistent authorisation pattern:

| Pattern | % of Actions | Risk |
|---------|-------------|------|
| Explicit `auth.getUser()` check | ~40% | Low — double-layered security |
| Relies solely on Supabase RLS | ~60% | Medium — single layer of defence |

**Actions with NO explicit auth check (rely on RLS alone):**

| File | Functions Without Auth Check |
|------|------------------------------|
| `costs/actions.ts` | ALL 15 functions (createEstimate, addLineItem, deleteEstimate, etc.) |
| `schedule/actions.ts` | ALL 6 functions |
| `programme/actions.ts` | `saveAsBuiltPhasesAction` |
| `variations/actions.ts` | ALL functions |
| `final-account/actions.ts` | ALL functions |

**Actions WITH explicit auth check:**

| File | Functions With Auth Check |
|------|--------------------------|
| `accounting/actions.ts` | All functions check `auth.getUser()` |
| `archive/actions.ts` | All functions check `auth.getUser()` |
| `proposal/actions.ts` | All 13 functions check `auth.getUser()` |
| `change-management/actions.ts` | `createChangeEventAction` (but not update/delete) |

**Why this matters:** RLS is a strong defence, but defence-in-depth is essential. If a RLS policy has a bug (which has happened — see the circular dependency fix in migration `20260324000006`), the entire set of unguarded server actions becomes exploitable. The `costs/actions.ts` file manages financial data (estimates, line items, margins) and has zero application-level auth checks.

| Severity | Recommendation |
|----------|----------------|
| **Critical** | Add `auth.getUser()` check to all mutating server actions as defence-in-depth |
| High | Create a shared `requireAuth()` helper to reduce boilerplate |
| High | Prioritise `costs/actions.ts` and `billing/actions.ts` — financial data |

### 4.4 Input Validation — Weak

**No schema validation library (Zod, Yup, etc.) is used anywhere in the codebase.**

All validation is manual and inconsistent:

| Severity | Finding | File:Line |
|----------|---------|-----------|
| **Critical** | `updateDependencyAction` — FormData values used directly in queries with no validation | `schedule/actions.ts:9-11` |
| **Critical** | `bulkAddMoMItemsAction` — accepts `any[]` with no shape validation | `library/actions.ts:70` |
| **Critical** | `saveAsBuiltPhasesAction` — accepts `any[]` with no validation | `programme/actions.ts:12` |
| High | `createProjectFromTemplateAction` — no email format validation on `clientEmail`, no phone validation | `new/actions.ts:13-28` |
| High | `uploadPhotoAction` — file extension extracted but no whitelist; no file size limit at application level | `proposal/actions.ts:530-535` |
| Medium | `updateDependencyAction` — `parseInt(duration)` without range check (negative/extreme values possible) | `schedule/actions.ts:14` |
| Medium | Multiple JSON parse attempts with silent catch blocks | `proposal/actions.ts:161-184` |
| Low | `upsertRateOverrideAction` — good example of manual validation (NaN check, >= 0 check) | `library/actions.ts:133` |

**Recommendation:** Adopt Zod for server action input validation. Example pattern:
```typescript
const CreateProjectSchema = z.object({
    name: z.string().min(1).max(200),
    clientEmail: z.string().email().optional(),
    potentialValue: z.number().min(0).max(100_000_000).optional(),
});
```

### 4.5 XSS Vectors — Low Risk

| Finding | File | Risk |
|---------|------|------|
| `dangerouslySetInnerHTML` — used for JSON-LD schema markup only | `about/page.tsx:29` | Very Low — structured data, not user input |
| No user-generated HTML rendered without sanitisation | — | Good |

### 4.6 CORS — One Issue

| Severity | Finding | File:Line |
|----------|---------|-----------|
| Medium | `Access-Control-Allow-Origin: "*"` on public benchmarks API | `api/v1/benchmarks/route.ts:170,179` |

The API is protected by Bearer token auth, so the risk is moderate. If this API is intended for backend-to-backend use only, restrict CORS to known origins. If it's a public API for third-party integrations, `*` is acceptable but document the security model.

### 4.7 Admin Route Protection — Good

`admin/layout.tsx:20-36`:
- Server-side guard checks both authentication AND email match ✓
- Requires `ADMIN_EMAIL` env var ✓
- Metadata has `robots: noindex, nofollow` ✓
- Admin actions use `createAdminClient()` (service role) ✓
- Admin input validation includes regex patterns and whitelists ✓

### 4.8 Xero Integration — Minor Concerns

| Severity | Finding | File |
|----------|---------|------|
| Medium | Access tokens stored in plaintext in database — consider encryption at rest | `api/xero/callback/route.ts` |
| Low | No visible token refresh automation | |

---

## 5. Performance

### 5.1 React Memoisation — Severely Lacking

| Pattern | Files Using It | Assessment |
|---------|---------------|------------|
| `React.memo` | **0** | Critical gap |
| `useMemo` | 17 | Moderate use |
| `useCallback` | 17 | Moderate use |

With 13 components over 1,000 lines and complex nested state, the absence of `React.memo` on child components is a significant performance concern. Every parent re-render triggers full re-renders of all children.

### 5.2 Data Fetching — Good

- 28 files use `Promise.all` for parallel data loading ✓
- No sequential await waterfalls detected ✓
- Dashboard layout properly parallelises project + profile fetch ✓
- `revalidatePath` used correctly for cache invalidation after mutations ✓

### 5.3 Code Splitting — Good

46 files use `next/dynamic` for code splitting. Most page-level client components are dynamically imported, reducing initial bundle size.

### 5.4 Image Optimisation — Poor

| Pattern | Files |
|---------|-------|
| `next/image` (optimised) | 4 files |
| Raw `<img>` tags | 27 files |

Most images use raw `<img>` tags with Supabase storage URLs. The 8 `@next/next/no-img-element` ESLint disables confirm this is intentional (likely due to Supabase storage URL patterns), but `next/image` supports `remotePatterns` configuration — and `next.config.mjs` already has Supabase configured in `images.remotePatterns`.

| Severity | Recommendation |
|----------|----------------|
| Medium | Migrate raw `<img>` tags to `next/image` where possible — the remote pattern is already configured |

### 5.5 useEffect Issues

| Severity | Finding | File:Line |
|----------|---------|-----------|
| Medium | Missing deps with ESLint disable: `query` and `activeCategoryId` omitted from effect that uses them | `foundations/library-drawer.tsx:65` |
| Low | Ref used as useEffect dependency (unnecessary) | `projects/schedule/client-page.tsx:217` |

### 5.6 Bundle Weight

**Heavy client-side libraries (all legitimate for use cases):**
- `jspdf` + `jspdf-autotable` — PDF generation
- `pdfjs-dist` — PDF parsing
- `xlsx` — Spreadsheet import
- `mammoth` — Word document parsing

**No problematic imports found:**
- No moment.js (good)
- No full lodash imports (good)
- OpenAI library server-side only (good)

### 5.7 Full-Page Refresh Anti-Patterns

| Pattern | Files | Assessment |
|---------|-------|------------|
| `router.refresh()` | 21 files | Acceptable — triggers React Server Component re-fetch |
| `window.location.reload()` | 2 files | Anti-pattern — loses all client state |
| `window.location.href = ...` | 7 files | Anti-pattern — full page navigation instead of `router.push()` |

| Severity | Finding | File |
|----------|---------|------|
| Medium | `window.location.reload()` after API key creation | `settings/api-keys/api-keys-client.tsx` |
| Medium | `window.location.reload()` after proposal save | `projects/proposal/client-editor.tsx` |
| Low | `window.location.href` for navigation in 7 files | Various |

### 5.8 Middleware Performance

| Severity | Finding |
|----------|---------|
| Medium | Profile query on every dashboard request (`middleware.ts:84-88`) to check `company_name` for onboarding redirect. After onboarding is complete, this is wasted I/O on every single request. |

**Recommendation:** Set a cookie or custom session claim after onboarding completes to skip this query.

---

## 6. Maintainability

### 6.1 Component Size — Critical Issue

**13 files exceed 1,000 lines:**

| File | Lines | Primary Concern |
|------|-------|-----------------|
| `proposal/proposal-pdf-button.tsx` | 1,935 | PDF generation logic mixed with React component |
| `p-and-l/log-cost-sheet.tsx` | 1,705 | Multiple tabs with complex state, inline sub-components |
| `proposal/client-editor.tsx` | 1,587 | Form editor with heavy DOM logic |
| `reporting/reporting-client.tsx` | 1,515 | Multi-section dashboard |
| `contracts/client-contract-editor.tsx` | 1,236 | Contract management |
| `resources/portfolio/portfolio-client.tsx` | 1,186 | Resource portfolio with heavy tables |
| `admin/page.tsx` | 1,120 | Multiple analytics tabs |
| `costs/estimate-client.tsx` | 1,109 | Estimate management |
| `contract-admin/contract-admin-client.tsx` | 1,104 | Contract administration |
| `resources/staff/staff-client.tsx` | 1,056 | Staff resource management |
| `schedule/client-page.tsx` | 1,043 | Gantt chart scheduling |
| `accounting/accounting-client.tsx` | 1,035 | Multi-format accounting |
| `drawings/drawing-viewer.tsx` | 1,011 | Drawing viewing + annotation |

**21 additional files are between 500-1,000 lines.**

| Severity | Recommendation |
|----------|----------------|
| High | Break `proposal-pdf-button.tsx` into page-section generators (cover, scope, pricing, terms) |
| High | Extract tab content from `log-cost-sheet.tsx` into separate components |
| Medium | Extract repeated form patterns into shared form components |

### 6.2 Naming Conventions — Mostly Consistent

- **Components:** PascalCase (correct) ✓
- **Files:** kebab-case with descriptive suffixes (`*-client.tsx`, `*-actions.ts`) ✓
- **Functions:** camelCase ✓
- **DB columns:** snake_case ✓

**Minor inconsistencies:**
- Some utility abbreviations are unclear: `gbp()`, `pct()`, `fmt()`, `DPW`/`dpw`
- File naming varies: `client-page.tsx` vs `*-client.tsx` (not a blocker, but worth standardising)

### 6.3 Magic Numbers/Strings

Hardcoded values are pervasive, especially in PDF generators and scheduling:

| Severity | Example | File:Line |
|----------|---------|-----------|
| Medium | `PAGE_W = 210; PAGE_H = 297` (A4 dimensions) | `proposal-pdf-button.tsx:100-101` |
| Medium | `ROW_H = 52; BAR_H = 30` (Gantt chart dimensions) | `schedule/client-page.tsx:66-67` |
| Medium | `DEFAULT_DPW = 5` (working days per week) | `schedule/client-page.tsx:69` |
| Medium | `headerHeight = 64` (layout magic number) | `landing/page.tsx:18` |
| Low | `overhead_pct: 10, profit_pct: 15, prelims_pct: 10` (default margins) | `costs/actions.ts:13-14` |

**Positive:** `p-and-l/constants.ts` shows the right pattern — `COST_TYPES` and `TRADE_SECTIONS` as typed constants. This pattern should be replicated.

### 6.4 Dead Code

- Zero `TODO`, `FIXME`, `HACK`, or `WORKAROUND` comments found — the codebase is clean of marked debt
- No `@ts-ignore` or `@ts-nocheck` directives
- 1 `console.log` in production (`contracts/actions.ts`)

### 6.5 Documentation

- Most server actions have brief JSDoc comments ✓
- Complex business logic (billing formulas, scheduling calculations) lacks explanatory comments
- `lib/supabase/admin.ts` has excellent documentation as a model

---

## 7. Testing

### 7.1 Current State — ZERO

| Metric | Value |
|--------|-------|
| Test files | 0 |
| Test configuration files | 0 |
| Testing dependencies in package.json | 0 |
| Test scripts | None |
| Coverage | 0% |

**This is the single biggest risk in the codebase.** 62,000+ lines of code with zero automated tests means every deployment is a manual QA exercise and every refactoring is high-risk.

### 7.2 Highest-Risk Areas Needing Tests

Priority order based on business impact and code complexity:

| Priority | Area | Why | Suggested Test Type |
|----------|------|-----|---------------------|
| 1 | Billing calculations (`billing/actions.ts`) | Financial accuracy | Unit tests |
| 2 | Proposal generation (`proposal/actions.ts`, `proposal-pdf-button.tsx`) | Client-facing documents | Integration tests |
| 3 | Auth flow (middleware, callback, RLS) | Security boundary | E2E tests |
| 4 | Cost estimates (`costs/actions.ts`) | Financial data | Unit tests |
| 5 | P&L calculations (`p-and-l/`) | Financial reporting | Unit tests |
| 6 | Library import (`library/actions.ts:70-119`) | Data integrity on bulk operations | Integration tests |
| 7 | Schedule calculations (`schedule/actions.ts:63-131`) | Programme accuracy | Unit tests |
| 8 | Bank reconciliation (`accounting/actions.ts`) | Financial matching | Unit tests |

**Recommendation:** Start with Vitest for unit/integration tests on server actions. These are pure functions that accept arguments and return data — the easiest to test and the highest ROI.

---

## 8. Known Technical Debt

### 8.1 Patterns Diverging from Next.js Best Practices

| Finding | Impact | Fix Effort |
|---------|--------|------------|
| No `loading.tsx` or `error.tsx` anywhere | Users see white screens on errors/slow loads | Low — add 2-3 files |
| `window.location.reload()` / `.href` instead of router | Full page reload loses client state, breaks SPA feel | Medium |
| Raw `<img>` tags instead of `next/image` (27 files) | Missing image optimisation (WebP, lazy loading, sizing) | Medium |
| No ISR / static generation on public pages | Landing, pricing, features re-render on every request | Low |
| Server actions with `next.config.mjs` body limit at 25MB | Unusually high — review if all actions need this | Low |

### 8.2 Architectural Debt

| Finding | Impact | Fix Effort |
|---------|--------|------------|
| 7 PDF generators with duplicated logic | Any branding/formatting change requires 7 edits | High |
| 13 components over 1,000 lines | Hard to read, review, and maintain | High |
| 60% of server actions have no auth check | Single point of failure if RLS has a bug | Medium |
| No input validation library | Manual validation is inconsistent and error-prone | Medium |
| Middleware queries DB on every request | Unnecessary latency after onboarding | Low |
| `any` types throughout (357+) | Runtime errors, no IDE assistance, no refactoring safety | High (incremental) |

### 8.3 Operational Debt

| Finding | Impact |
|---------|--------|
| Zero test coverage | Every change is a risk; refactoring is dangerous |
| No error tracking (Sentry, etc.) | Production errors are invisible unless users report them |
| No structured logging | `console.error` in production; no log aggregation or alerting |
| Xero tokens stored in plaintext | Compliance/security concern for financial integration |

---

## Summary Scorecard

| Area | Grade | Key Issue |
|------|-------|-----------|
| Architecture | **A-** | Clean App Router structure, good separation of concerns |
| Supabase Pattern | **A** | Excellent three-tier client with proper RLS |
| TypeScript Safety | **D+** | 357+ `any` types undermine strict mode |
| Error Handling | **C** | Inconsistent; some silent failures |
| Error Boundaries | **F** | Zero loading.tsx or error.tsx files |
| Server Action Security | **C-** | 60% rely solely on RLS, no input validation |
| Database Queries | **B+** | Good parallel fetching, 2 N+1 patterns |
| RLS Policies | **A-** | Comprehensive, with one historical fix |
| Performance | **C+** | No React.memo, 27 unoptimised images, middleware DB call |
| Code Splitting | **A-** | 46 files use dynamic imports |
| Component Size | **D** | 13 files >1,000 lines, 34 files >500 lines |
| Duplication | **C-** | 7 PDF generators with repeated logic |
| Testing | **F** | Zero tests on 62,000 lines |
| Documentation | **C** | Adequate inline docs, no external docs |
| Naming/Consistency | **B** | Mostly consistent with minor variations |

---

## Recommended Action Plan

### Phase 1: Safety Net (1-2 weeks)
1. Add `error.tsx` and `loading.tsx` to dashboard route groups
2. Add Zod validation to the 10 most critical server actions (billing, costs, proposals)
3. Add `requireAuth()` helper and apply to all mutating server actions
4. Set up Vitest and write 20 tests on financial calculation functions

### Phase 2: Type Safety (2-4 weeks)
5. Create interfaces for core domain types: `Project`, `Estimate`, `EstimateLine`, `Proposal`, `Profile`
6. Replace `any` types in the 10 worst files
7. Type all server action parameters (replace `any[]` params)

### Phase 3: Refactoring (4-8 weeks)
8. Extract shared PDF service from 7 generators
9. Break apart the 5 largest components (>1,500 lines)
10. Migrate `<img>` tags to `next/image`
11. Replace `window.location` calls with `router.push`/`router.refresh`

### Phase 4: Operations (ongoing)
12. Add Sentry error tracking
13. Optimise middleware to skip profile query for onboarded users
14. Continue expanding test coverage to 40%+ of server actions
15. Batch the N+1 query in `bulkAddMoMItemsAction`

---

*This review was conducted as a read-only audit. No code was modified.*
