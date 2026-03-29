# Sprint 4 — World-Class Proposal Rebuild

**Status:** COMPLETE ✅  
**Date:** 2026-03-29

---

## Changes Delivered

### CHANGE 1: Project Creation Wizard ✅
**Files:** `src/app/dashboard/projects/new/page.tsx`, `src/app/dashboard/projects/new/actions.ts`

- Full 3-step wizard replacing the single-form page
- Step 1: Project Details (name, client name, email, phone, client address, site address, project type, start date, contract value)
- Step 2: Choose Template (existing radio card UI preserved)  
- Step 3: Review & Create (summary with all entered fields)
- Light-mode design (white background, clean cards, blue CTAs)
- Progress indicator (Step 1 of 3, Step 2 of 3, Step 3 of 3)
- On creation: redirects to `/dashboard/projects/proposal?projectId=${id}` (not costs page)
- Action saves all new fields: `client_email`, `client_phone`, `client_address`, `site_address`, `project_type`, `start_date`, `potential_value`

### CHANGE 2: Proposal Editor Rebuild ✅
**Files:** `src/app/dashboard/projects/proposal/client-editor.tsx`, `src/app/dashboard/projects/proposal/page.tsx`

- Single scrolling page (no tabs) with 9 clearly labelled sections
- Each section has a completion indicator (green checkmark or grey circle)
- **Section 1**: Project Summary (read-only info card from project data)
- **Section 2**: Company Profile Check (amber warning if incomplete, green pill if complete)
- **Section 3**: Client Introduction (textarea + AI draft button)
- **Section 4**: Scope of Works (large textarea + AI draft button)
- **Section 5**: Exclusions & Clarifications (two columns side by side)
- **Section 6**: Project Timeline (Gantt phase builder, clean table layout)
- **Section 7**: Payment Schedule (NEW — stage/description/percentage/£ table with auto-calc)
- **Section 8**: Site Photos (URL input grid)
- **Section 9**: Terms & Conditions (standard/custom toggle)
- **Sticky sidebar**: completion checklist, Generate PDF, Copy Client Link, Save All, status badge
- Payment schedule saves to `payment_schedule` JSONB column

### CHANGE 3: PDF Quality Upgrade ✅
**File:** `src/app/dashboard/projects/proposal/proposal-pdf-button.tsx`

- Cover page: navy 40% top block, company name/logo, "PROPOSAL & FEE PROPOSAL", thin rule, large project name, client info, date/ref columns, navy footer bar
- All pages: slim navy header band (company left, doc title centre, page number right), slim footer with rule
- About Us page: only renders if `capability_statement` exists; years trading badge, specialisms, body text, info table
- Introduction + Project Overview table
- Scope of Works with navy left-accent section headings
- Fee Proposal (full/summary toggle preserved) + **Payment Schedule table** at bottom
- Gantt Timeline: duration column added, start dates on bars, legend note
- Exclusions & Clarifications: two side-by-side navy-header boxes
- Site Photos: only renders if photos exist (no blank placeholders)
- T&Cs: navy header, alternating rows
- Signature page: summary box (contract value, start date, valid until) + two signature blocks

### CHANGE 4: Client Acceptance Page Upgrade ✅
**Files:** `src/app/proposal/[token]/page.tsx`, `src/app/proposal/[token]/acceptance-client.tsx`

- Fetches: `scope_text`, `exclusions_text`, `payment_schedule`, `gantt_phases`, `project_type`, `start_date`, `site_address`
- Also fetches: `logo_url`, `phone`, `website`, `accreditations`, `capability_statement`, `years_trading`, `insurance_details`
- Full-width dark theme professional page
- Header: company logo or name + tagline
- Hero: project name large, "Prepared exclusively for [Client Name]", date/ref pills
- 3-stat key numbers bar: Contract Value, Estimated Start, Project Duration
- Scope preview (first 300 chars with fade)
- Payment schedule table (if data exists)
- Timeline (phase list with colour dots)
- What's excluded / Works location (two columns)
- Company credentials section
- Acceptance section: prominent button, accepted/expired states

### CHANGE 5: Project Settings Upgrade ✅
**Files:** `src/app/dashboard/projects/settings/client-page.tsx`, `src/app/dashboard/projects/settings/actions.ts`

- Added: Client Email, Client Phone
- Added: Contract Value (£) / `potential_value`
- Added: Payment Terms (select: 14 days | 21 days | 28 days | 30 days | Stage payments)
- Clean light-mode redesign with proper card sections
- Action now saves all new fields securely (scoped to user_id)

### CHANGE 6: DB Migration ✅
**File:** `supabase/migrations/20260329000000_sprint4_proposal.sql`

```sql
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS client_email text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS client_phone text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS payment_schedule jsonb;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS payment_terms text;
```

Migration pushed successfully to remote (pudadynieiuypxeoimnz).

---

## TypeScript
`npx tsc --noEmit` — **0 errors** ✅

---

## Git
Committed and pushed to `main` branch.
