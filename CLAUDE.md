# Constructa — Claude Code Project Context

> This file is auto-loaded by Claude Code at session start.
> Read this before making any changes to the codebase.
> Last updated: 5 April 2026 — Claude Code session (Sprints 15 & 16: Resource Catalogues + Cost Capture Enhancements)
> Previous sessions: Claude Code Sprint 14 (5 Apr morning), Claude Code (4 Apr evening + night), Perplexity Computer (4 Apr morning)

---

## Project Overview

**Constructa** is a SaaS platform for UK SME construction contractors ("Dave" — £1-3m turnover, 5-8 subcontractors).

- **Live app:** https://constructa-nu.vercel.app
- **GitHub repo:** https://github.com/constructa-co/Constructa (public)
- **Marketing site:** https://www.constructa.co — SEPARATE project, DO NOT TOUCH `src/app/(marketing)/`
- **Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Supabase (PostgreSQL + RLS + Auth + Storage), OpenAI gpt-4o-mini, Vercel CI/CD

---

## Credentials

> ⚠️ Credentials are in `.env.local` (not committed). Ask the project owner.

- Supabase project ref: `pudadynieiuypxeoimnz` (West Europe/London)
- Supabase access token: stored in shell as `SUPABASE_ACCESS_TOKEN` (rotated April 3 2026)
- New token name: "Constructa CI" — obtain from project owner
- Vercel: auto-deploys from GitHub main branch
- OpenAI: `OPENAI_API_KEY` env var in Vercel (project level)

**Always run before committing:**
```bash
git config user.email "perplexity-computer@constructa.co"
git config user.name "Perplexity Computer"
```

**Push Supabase migrations:**
```bash
SUPABASE_ACCESS_TOKEN=[token] supabase db push --linked --yes
```

---

## Architecture

```
src/app/
  (marketing)/              ← DO NOT TOUCH — constructa.co landing pages
  dashboard/
    home/                   ← NEW: Command centre home page (KPI strip, section cards)
    page.tsx                ← CRM Pipeline / Kanban
    layout.tsx              ← ThemeProvider + DashboardShell
    projects/
      new/                  ← 2-step new project wizard (lands on Brief)
      brief/                ← Step 1: AI project brief + scope
      costs/                ← Step 2: Full BoQ estimating tool
      schedule/             ← Step 3: Programme / Gantt (from manhours)
      contracts/            ← Step 4: T&Cs, risk register, contract review AI
      proposal/             ← Step 5: Proposal editor + PDF export
      billing/              ← Post-contract invoicing (FULLY BUILT)
      variations/           ← Post-contract scope changes (FULLY BUILT)
    settings/
      profile/              ← Company profile, logo, MD message, pdf_theme
      case-studies/         ← Case studies CRUD
    library/                ← Cost library browser
    resources/              ← Labour rate management
    foundations/            ← Vision Takeoff (AI drawing scan — FULLY BUILT)
    live/                   ← Placeholder for Live Projects module
  proposal/[token]/         ← Public client portal (no auth required)
src/components/
  sidebar-nav.tsx           ← Main left sidebar (5 sections)
  project-navbar.tsx        ← Per-project top tabs (Brief→Estimating→Programme→Contracts→Proposal)
  dashboard-shell.tsx       ← Theme-aware wrapper
src/lib/
  ai.ts                     ← OpenAI: generateText(), generateJSON<T>() — gpt-4o-mini only
  theme-context.tsx         ← ThemeProvider + useTheme()
```

---

## Sidebar Navigation Structure

```
COMPANY PROFILE
  Profile         /dashboard/settings/profile
  Case Studies    /dashboard/settings/case-studies
  Setup Wizard    /onboarding?force=true

WORK WINNING
  Home            /dashboard/home          ← PRIMARY LANDING PAGE
  Pipeline        /dashboard               ← CRM Kanban
  New Project     /dashboard/projects/new
  ── divider ──
  Cost Library    /dashboard/library       ← Reference data, not a workflow step
  Resources       /dashboard/resources

PRE-CONSTRUCTION (5-step workflow)
  Brief           /dashboard/projects/brief
  Estimating      /dashboard/projects/costs
  Programme       /dashboard/projects/schedule
  Contracts       /dashboard/projects/contracts
  Proposal        /dashboard/projects/proposal

LIVE PROJECTS (module headers — all disabled "Soon" except Overview)
  Overview        /dashboard/live
  Billing & Valuations
  Variations
  Change Management
  Cost Tracking
  Programme
  Communications

CLOSED PROJECTS (all disabled "Soon")
  Archive
  Final Accounts
  Handover Documents
  Lessons Learned
```

---

## The 5-Step Pre-Construction Workflow

Data flows automatically — no re-entry between tabs:

```
1. BRIEF       → AI chat describes project → scope auto-populated
                 → AI suggests estimate line items → creates Estimate v1
                 → Captures lat/lng from postcode
                 
2. ESTIMATING  → Full BoQ with rate build-up per line (L+P+M+C+Temp Works)
                 → Cost hierarchy: Direct Cost → Prelims(10%) → Overhead(10%) → Risk(5%) → Profit(15%)
                 → Margins NEVER shown to client — all-in rates only in PDF
                 → Discount field (% + reason) flows to PDF closing page
                 → "Suggest Estimate Lines" creates AI line items from Brief scope
                 
3. PROGRAMME   → Auto-generates Gantt from estimate manhours (labour components)
                 → Contractor adjusts durations manually
                 → "Save to Proposal" writes to project.programme_phases
                 → PDF reads programme_phases for the Gantt page
                 
4. CONTRACTS   → T&C tier selector (Domestic/Commercial/Specialist)
                 → AI risk register (grounded in JCT/NEC/Construction Act)
                 → AI-suggested exclusions and clarifications
                 → Upload client contract → AI flags onerous clauses (Red/Amber/Green)
                 → Contract chatbot (risk awareness, NOT legal advice)
                 → Contractor can accept/dismiss individual flags
                 
5. PROPOSAL    → Pulls from all tabs automatically (no re-entry)
                 → "About Us — This Proposal" section overrides master profile per-proposal
                 → Closing statement AI-generated with discount callout
                 → PDF Download (gated if profile incomplete)
                 → Copy Proposal Link → public client portal URL
```

---

## PDF Structure (proposal-pdf-button.tsx)

1. Cover page (company logo, project title, 4-stat strip)
2. About Us (capability statement — uses `project.proposal_capability` override OR `profile.capability_statement`)
3. Case studies (selected per project, full page each)
4. Project Brief & Scope (two-column: overview left, AI scope bullets right + site photos)
5. Fee Proposal (section totals, margins hidden, TOTAL INC. VAT primary)
6. Project Timeline / Gantt (reads `project.programme_phases` → proportional bars)
7. Commercial Terms (exclusions left, clarifications right — reads BOTH field names)
8. Risk & Opportunities (from `project.risk_register`)
9. Why Choose Us (AI closing statement + discount callout if `discount_pct > 0`)
10. Acceptance / signature page (shows TOTAL INC. VAT prominently)

---

## Database Schema (key columns)

```sql
profiles:
  company_name, logo_url, capability_statement, accreditations, specialisms
  md_message, md_name          ← MD personal message for About Us
  pdf_theme                    ← 'slate' | 'navy' | 'forest'
  preferred_trades TEXT[]      ← contractor's trade specialisms

projects:
  -- Basic
  name, client_name, site_address, postcode, lat, lng, region
  project_type, client_type, start_date, potential_value
  -- Brief
  brief_scope, brief_trade_sections TEXT[], brief_completed
  -- Proposal
  proposal_introduction, scope_text, exclusions, clarifications
  proposal_capability          ← per-proposal About Us override
  proposal_company_name        ← per-proposal company name override
  proposal_token               ← UUID for client portal URL
  proposal_status              ← 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined'
  proposal_accepted_at, proposal_accepted_by, client_email
  closing_statement            ← AI-generated "Why Choose Us"
  discount_pct, discount_reason
  -- Contracts
  tc_tier                      ← 'domestic' | 'commercial' | 'specialist'
  contract_exclusions, contract_clarifications
  risk_register JSONB          ← [{type, description, likelihood, impact, mitigation}]
  contract_review_flags JSONB  ← [{clause, severity, description, recommendation, dismissed}]
  -- Programme
  programme_phases JSONB       ← [{name, duration, unit, startOffset, manhours}]
  timeline_phases JSONB        ← legacy field, programme_phases takes priority
  -- Estimating
  payment_schedule_type        ← 'percentage' | 'milestone'
  selected_case_study_ids JSONB

estimates:
  project_id, version_name, is_active
  overhead_pct(10), profit_pct(15), risk_pct(5), prelims_pct(10)  ← defaults

estimate_lines:
  estimate_id, trade_section, description, quantity, unit, unit_rate
  pricing_mode                 ← 'simple' | 'buildup'
  
estimate_line_components:
  estimate_line_id
  component_type               ← 'labour'|'plant'|'material'|'consumable'|'temp_works'|'subcontract'
  quantity, unit, unit_rate, manhours_per_unit, total_manhours

labour_rates:
  trade, role, day_rate, region, is_system_default
  -- 260 roles across 60 trades seeded

cost_library_items:
  code, description, unit, base_rate, category, is_system_default
  -- 833 items: materials + plant + consumables across 60 trades

rate_buildups:
  organization_id (NULL = system), name, unit, built_up_rate
  components JSONB, total_manhours_per_unit

variations (Sprint 14):
  project_id, title, description, amount, status (Draft/Pending Approval/Approved/Rejected)

invoices (Sprint 14):
  project_id, invoice_number, type (Interim/Final), amount, status (Draft/Sent/Paid)

project_expenses (enhanced Sprint 14):
  project_id, description, amount, expense_date, supplier
  cost_type  ← labour|materials|plant|subcontract|overhead|prelims|other
  trade_section ← matches estimate_lines.trade_section for budget vs actual
```

---

## Client Portal

Public URL: `https://constructa-nu.vercel.app/proposal/[token]`

- No authentication required
- Shows full proposal in-browser (not just PDF)
- Acceptance form: captures client name (required) + email (optional)
- On acceptance: sets `proposal_status = 'accepted'`, stores `proposal_accepted_at`, `proposal_accepted_by`, `client_email`
- Confirmation panel shown with reference code and timestamp

**What Sprint 12 proper needs to close the loop:**
- Viewed tracking (notify contractor when client opens the link)
- Acceptance notification to contractor (email/in-app)
- Project status auto-updates on dashboard when accepted
- Email send from within Constructa (currently manual copy/paste of link)

---

## Vision Takeoff (AI Drawing Scan) — ALREADY BUILT

Location: `src/app/dashboard/foundations/vision-takeoff.tsx`

- Upload floor plan or sketch → GPT-4o Vision extracts items + quantities
- Second AI pass fuzzy-matches extracted items to 833-item cost library
- Results table shows: item name, qty, unit, matched rate, total
- "Add All Items to BoQ" button creates estimate lines with pre-filled rates
- Entry points: onboarding step 4 callout, empty estimate "Got a drawing?" prompt

**This is a headline feature currently not prominently marketed. Needs:**
- Demo video / GIF on marketing site
- Onboarding tour that centres on it
- Connection to Brief AI suggestions workflow

---

## Important Rules (do not violate)

1. **NEVER touch `src/app/(marketing)/`** — separate product
2. **Always run `npx tsc --noEmit`** before committing — zero errors required
3. **NO `revalidatePath` in estimating actions** — breaks optimistic UI state
4. **Margins NEVER shown to client in PDF** — all-in rates only, no OH/profit/risk %
5. **All AI via `src/lib/ai.ts`** — `generateText()` and `generateJSON<T>()`, model is `gpt-4o-mini`
6. **Supabase migrations** — new file in `supabase/migrations/` with timestamp prefix
7. **RLS on new tables** — check `p.user_id = auth.uid()` OR org membership
8. **PDF reads `programme_phases` first** — falls back to `timeline_phases` then `brief_trade_sections`
9. **Exclusions/clarifications** — PDF checks BOTH `contract_exclusions` AND `exclusions` field names

---

## PDF Brand Themes

Stored in `profiles.pdf_theme`:
- `"slate"` (default): `#0D0D0D` primary, white accent
- `"navy"`: `#0A1628` deep navy, `#C9A84C` gold accent
- `"forest"`: `#1A3A2A` green, `#E8E0D0` cream accent

**Theme implementation note (fixed April 4):**
`ProposalPdfButton` now fetches a fresh profile from Supabase at click time (`createClient()` + `.from("profiles").select("*").eq("id", profile.id)`). This means theme changes take effect immediately without requiring a page refresh. Previously the server-rendered prop was stale if profile was updated in another tab.

---

## Local Build Process
Run before every push — catches what Vercel catches:
```bash
cd /Users/robertsmith/Documents/GitHub/constructa
node /usr/local/bin/npx next build 2>&1 | grep -E "Failed|error TS|Type error|✓"
```
node is at `/usr/local/bin/node` (v22.20.0). PATH must include `/usr/local/bin`.
If `node_modules` is stale, run `node /usr/local/bin/npm install` first.

## Known Bugs (to fix next session)

### BUG-001 — Duplicate `md_name` input (Medium — data loss risk)
**File:** `src/app/dashboard/settings/profile/profile-form.tsx` lines 615 and 753
Both inputs have `name="md_name"`. Only the last one submits. If contractor types into the first field, value is silently discarded.
**Fix:** Remove the duplicate at line 615, keep the one at 753.

### BUG-002 — Client portal URL UX gap (Medium)
`proposal_token` is only written when `saveProposalAction()` or `sendProposalAction()` is first called. If the contractor copies the link URL manually before saving/sending, it 404s with "Proposal Not Found". No warning shown.
**Fix:** Either pre-generate the token on project creation, or show a "link not active — save proposal first" message in the actions panel.

### BUG-003 — Wrong company name in proposal editor banner (Medium)
The proposal editor page shows "Company profile complete — Tripod Construction Ltd" instead of the profile's `company_name`. Likely caused by `proposal_company_name` override being set on the project record, or a stale/incorrect profile query.
**Fix:** Investigate the ClientEditor banner component — ensure it reads `profile.company_name` for the authenticated user, not `project.proposal_company_name`.

### BUG-004 — PDF download via `window.open()` (Low — UX)
Chrome popup blocker intercepts the new tab, so PDFs download silently rather than opening. The download still works correctly but no visual confirmation.
**Fix:** Replace `window.open(url)` with a programmatic `<a href=url download>` click trigger in `proposal-pdf-button.tsx`.

---

## Session Work Log (April 5 — Sprint 16: Cost Capture Enhancements)

### ✅ SPRINT 16 COMPLETE — 5 April 2026

**Sprint 16 scope:** WBS-based cost logging, labour time units, resource autocomplete, receipt/document upload, fix "use server" server error.

**⚠️ SPRINT NUMBERING NOTE:** What is committed in git as "Sprint 15" and "Sprint 16" are TWO NEW SPRINTS that were not in the original plan. They were inserted between Sprint 14 (P&L Dashboard) and the originally planned Sprint 15 (UI/UX Consistency). The original Sprint 15 is now Sprint 17, the original Sprint 16 is now Sprint 18, and everything downstream shifts +2. Total roadmap: 43 sprints (was 41).

**1. Critical bug fix — "use server" illegal export (root cause of 500 on every logCostAction):**
- `actions.ts` had `export { COST_TYPES, TRADE_SECTIONS }` — Next.js "use server" files can ONLY export async functions, never constants
- Every `logCostAction` POST was returning 500 silently
- Fix: moved constants to `constants.ts` (no directive); `actions.ts` imports nothing from it
- Rule permanently recorded: never export constants from "use server" files

**2. WBS-based cost logging:**
- DB migration `20260405200000_sprint16_cost_logging.sql`: added `estimate_line_id UUID FK → estimate_lines(id) ON DELETE SET NULL` to `project_expenses`
- New `WBSPicker` component in `log-cost-sheet.tsx` replaces generic static dropdown
  - `mode: "section"` for Labour/Overhead (spans multiple activities — picks trade section)
  - `mode: "line"` for Plant/Materials (picks section then optionally specific estimate line item)
  - Derives sections from the active estimate's `estimate_lines`
  - Falls back to `TRADE_SECTIONS` constants if project has no estimate
  - "Other / not in estimate" escape hatch maps to manual `TRADE_SECTIONS` pick
- All 5 tabs pass `estimate_line_id: form.lineId || undefined` to `logCostAction`
- `page.tsx` passes `estimateLines={lines}` → `ClientPLDashboard` → `LogCostSheet`

**3. Labour time units:**
- State: `qty: string` + `timeUnit: "hours" | "half_days" | "days"` (was just `days: string`)
- Rate info panel shows hourly / half-day / daily simultaneously
- `calcAmount()`: hours → `(dailyRate/8) × qty`; half-days → `dailyRate × 0.5 × qty`; days → `dailyRate × qty`
- Inline unit selector (Hours / Half Days / Full Days) next to the quantity field

**4. Receipt / document upload:**
- Supabase Storage: `receipts` bucket (public), policies: authenticated upload, public view, authenticated delete
- DB: `receipt_url TEXT` column on `project_expenses` (already in migration)
- New `ReceiptUpload` component: dashed drop-zone → uploads to `receipts/${projectId}/timestamp-filename` → shows image thumbnail or PDF FileText icon → ×  remove button → "View document ↗" link
- Added to all 5 cost logging tabs (Labour, Plant Owned, Plant Hired, Materials, Overhead)
- All `logCostAction` calls pass `receipt_url: form.receiptUrl || undefined`
- Cost entries table: new "Doc" column with `Paperclip` icon linking to receipt when present
- `colSpan` on totals footer row corrected from 5 → 6

**Key files changed:**
- `src/app/dashboard/projects/p-and-l/log-cost-sheet.tsx` — WBSPicker, ReceiptUpload, labour time units, all tab states updated
- `src/app/dashboard/projects/p-and-l/client-pl-dashboard.tsx` — Doc column + Paperclip icon
- `src/app/dashboard/projects/p-and-l/actions.ts` — removed illegal constant re-exports (the 500 fix)
- `supabase/migrations/20260405200000_sprint16_cost_logging.sql` — estimate_line_id FK, receipt_url, staff/plant columns, storage bucket

**New DB columns (all applied to live DB):**
```sql
project_expenses: + estimate_line_id UUID FK → estimate_lines(id), + receipt_url TEXT
staff_resources:  + rate_mode TEXT, + hourly_chargeout_rate NUMERIC, + overtime_chargeout_rate NUMERIC,
                  + car_allowance_annual NUMERIC, + mobile_phone_annual NUMERIC, + job_title TEXT
plant_resources:  + rate_mode TEXT, + daily_chargeout_rate NUMERIC
                  (updated category constraint to new values)
storage:          receipts bucket created with upload/view/delete policies
```

---

## Session Work Log (April 5 — Sprint 15: Resource Catalogues)

### ✅ SPRINT 15 COMPLETE — 5 April 2026

**Sprint 15 scope:** Staff resource catalogue (rate modes, job titles, full cost buildup display), Plant resource catalogue (rate modes, categories, owned plant chargeout), numeric input UX, resource autocomplete.

**⚠️ SPRINT NUMBERING NOTE:** This is a new sprint inserted between Sprint 14 and the originally planned Sprint 15 (UI/UX Consistency). See Sprint 16 note above for full context.

**1. Staff Resource Catalogue (`/dashboard/resources/staff`):**
- Rate mode toggle: "Simple Rate" (hourly chargeout directly, e.g. for subcontract labour) vs "Full Cost Buildup" (annual salary → employer NI/pension → benefits → working days → overhead → profit → daily chargeout)
- Simple mode: `hourly_chargeout_rate` input + optional `overtime_chargeout_rate`; daily = hourly × 8
- Full buildup: salary, NI (13.8% default), pension (3% default), company car, car allowance, mobile phone, IT, life insurance, other benefits, working days, holiday days, public holidays, overhead absorption %, profit uplift %
- Job title field: `list="job-title-suggestions"` + `<datalist>` of 60+ UK construction roles (Groundworker, Bricklayer, Electrician, Site Manager, QS, Contracts Manager, etc.)
- Table: Mode badge / Hourly chargeout / Daily chargeout / Annual chargeout — computed for both simple and full mode
- Full mode rows also show annual employer cost (total employment cost inc. NI/pension/benefits)
- `NumericInput` component: added `onFocus={(e) => e.target.select()}` — click to immediately replace zero

**2. Plant Resource Catalogue (`/dashboard/resources/plant`):**
- Rate mode toggle: "Simple" (enter daily chargeout directly) vs "Full" (depreciation buildup model)
- Simple mode: `daily_chargeout_rate` input only; preview shows half-day/daily/weekly breakdown
- Full buildup: purchase price, depreciation years, residual value, finance cost, maintenance, insurance, other annual costs, utilisation months, working days/month, profit uplift %
- New categories: Heavy Plant / Light Plant / Lifting Equipment / Temporary Works / Light Tools / Specialist Tools / Other (replaced: excavator/dumper/vehicle/scaffold/lifting/tool/other)
- Name autocomplete: `<datalist>` with 70+ UK plant items (1.5T–30T Excavators, Dumpers, Telehandlers, MEWPs, Scaffold, Generators, etc.)
- Table: Mode badge / Half Day / Daily / Weekly chargeout
- `Input` primitive: added `onFocus` select-all for number inputs

**3. Log Cost Sheet — Staff rate fix:**
- `StaffResource` interface was missing `rate_mode`, `hourly_chargeout_rate`, `car_allowance_annual`, `mobile_phone_annual`, `job_title`
- `calcStaffDailyChargeout`: added `if (s.rate_mode === "simple") return s.hourly_chargeout_rate * 8` branch — without this, simple-rate staff showed £0 (was always using full buildup formula with annual_salary = 0)
- `calcPlantDailyChargeout`: added `if (p.rate_mode === "simple") return p.daily_chargeout_rate` branch

**Key files changed:**
- `src/app/dashboard/resources/staff/staff-client.tsx` — full rewrite of staff CRUD UI
- `src/app/dashboard/resources/plant/plant-client.tsx` — full rewrite of plant CRUD UI
- `src/app/dashboard/resources/plant/actions.ts` — updated PlantResourceInput type + upsert payload
- `src/app/dashboard/projects/p-and-l/log-cost-sheet.tsx` — StaffResource interface fix, rate calculation fixes

---

## Session Work Log (April 5 — Sprint 14: Job P&L Dashboard)

### What was built this session (Sprint 14)

**1. DB migrations (applied via Supabase MCP + local migration file):**
- `variations` table — RLS-protected, linked to projects, status workflow (Draft/Pending/Approved/Rejected)
- `invoices` table — RLS-protected, linked to projects, type (Interim/Final), status (Draft/Sent/Paid)
- `project_expenses` enhanced — added `cost_type` TEXT (labour/materials/plant/subcontract/overhead/prelims/other) and `trade_section` TEXT
- Migration file: `supabase/migrations/20260405000000_sprint14_pl_dashboard.sql`

**2. New page: `/dashboard/projects/p-and-l`**
- `page.tsx` — server component. Fetches estimate (with lines), expenses, invoices, variations. Computes full contract value (direct cost → prelims → overhead → risk → profit → discount) and total budget cost (direct + prelims). Passes all computed values + breakdowns to client.
- `client-pl-dashboard.tsx` — 3-tab client component:
  - KPI strip: Contract Value | Budget Cost | Est. Margin | Costs to Date | Invoiced to Date
  - Budget burn progress bar with remaining/overrun callout + forecast margin at completion
  - Tab 1 "Budget vs Actual": trade section table with budget, actual, variance, % spent progress bars, totals row
  - Tab 2 "Cost Entries": log actual costs (type + section + supplier + date), delete entries, totals footer
  - Tab 3 "Invoices": 3-card summary (invoiced/received/outstanding), invoice table with inline status changer
- `actions.ts` — `logCostAction`, `deleteCostAction`, `updateInvoiceStatusAction`

**3. Sidebar updated (`sidebar-nav.tsx`):**
- "Billing & Invoicing" → `/dashboard/projects/billing` (was disabled)
- "Variations" → `/dashboard/projects/variations` (was disabled)
- "Job P&L" → `/dashboard/projects/p-and-l` (new)
- "Cost Tracking" disabled placeholder removed (Job P&L is now that feature)

**4. Billing actions.ts rewritten:**
- Removed `organization_id` dependency (column never existed on `invoices` table)
- Removed `getActiveOrganizationId` and `createValuationAction` (RPC didn't exist in DB)
- Clean simple CRUD against `invoices` table matching its actual schema
- Added `revalidatePath` for both billing and p-and-l pages

### New DB schema additions
```sql
variations: id, project_id, title, description, amount, status, created_at
invoices:   id, project_id, invoice_number, type, amount, status, created_at
project_expenses (enhanced): + cost_type TEXT, + trade_section TEXT
```

### Key files created/changed
- `src/app/dashboard/projects/p-and-l/page.tsx` (NEW)
- `src/app/dashboard/projects/p-and-l/client-pl-dashboard.tsx` (NEW)
- `src/app/dashboard/projects/p-and-l/actions.ts` (NEW)
- `src/app/dashboard/projects/billing/actions.ts` (REWRITTEN — removed org_id)
- `src/components/sidebar-nav.tsx` (enabled 3 live project links)
- `supabase/migrations/20260405000000_sprint14_pl_dashboard.sql` (NEW)

---

## Session Work Log (April 5 — Sprint 13 close + roadmap planning, commits 92f761b→7de0dd9)

### Sprint 13 — Final clause parsing fix (confirmed working by user)

**1. Vercel function timeout (92f761b):**
`export const maxDuration = 60` added to `contracts/page.tsx`. Extends Vercel serverless
function timeout from 10s default to 60s for the entire contracts route including all
server actions. Without this, AI calls exceeding 10s were being silently killed.

**2. Input size (92f761b):**
Excerpt reduced 30k → 20k chars (10k head + 10k tail with omission notice).
Keeps AI response time within the 60s budget even on cold starts.
20k chars covers the full commercial substance of any real contract.

**3. Unstructured contract support (92f761b):**
Original prompt required "numbered clauses or clear headings" — many real contracts
(domestic, bespoke) don't have these. Prompt now explicitly instructs AI to treat
any distinct topic or paragraph as a clause and always return results.
Diagnostic `console.log` added — Vercel function logs show exact AI response if
further debugging needed in future.

**All commits this session:**
- `92f761b` — clause parsing: maxDuration, 20k excerpt, flexible prompt, diagnostics
- `6dd6cd2` — swap Sprint 17/18: Gantt before Admin (per product owner)
- `04cc92c` — release batch strategy: Batch 1/2/3, Admin moved to Sprint 18
- `3b18f75` — full data architecture, admin management accounts, accounting integration
- `5c9c7b7` — data intelligence architecture + Constructa admin dashboard design
- `f13d63e` — Live Projects + Closed Projects sprints added (21–30)
- `82e9b01` — sprint reprioritisation per product owner feedback
- `7de0dd9` — Sprint 21 Drawing Upload (full build) + Sprint 22 Video Walkthrough AI

### Roadmap decisions confirmed this session

- Gantt drag-and-drop: elevated from deprioritised → Sprint 17
- Admin Dashboard: moved forward to Sprint 18 (needed from first paying subscriber)
- Drawing upload: full feature build as Sprint 21 (annotation, multi-page, scale detection)
- Video walkthrough AI: moved from long-term vision → Sprint 22 (concrete sprint)
- UI/UX consistency pass: Sprint 15 — all pages to Contract Shield standard
- Pre-construction workflow refinement: Sprint 16 — fix data flow gaps

**Release batch strategy:**
- Batch 1 (14–22): Polish + admin ops → Launch point
- Batch 2 (23–28): Live Projects
- Batch 3 (29–32): Closed Projects
- Data & Admin (33–41): Intelligence, accounts integration, market data product

**Data architecture:**
- No rewrite needed — aggregation layer sits on top of existing schema
- 8 anonymised benchmark tables (rate, labour, plant, material, programme, payment, variation, contract risk)
- Triggers fire on close / payment / variation / Contract Shield analysis
- Admin dashboard = Constructa management accounts (MRR, ARR, gross margin, LTV, CAC)
- Contractor management accounts + Xero/Sage/QuickBooks (Sprints 35–38)
- Market intelligence product (Sprint 39) — sellable API for QS firms, lenders, insurers

---

## Session Work Log (April 4 — Contract Shield sprint, commits 5877c6e→39c97ad)

### ✅ SPRINT 13 FULLY COMPLETE — confirmed working by user (5 April 2026)

All Contract Shield features confirmed working end-to-end. "Build Contractor Response"
clause parsing now works correctly. Sprint 14 is the next sprint.

### What was built this session (Sprint 13 — Contract Shield)

**1. PDF extraction (5877c6e):** Replaced `pdf-parse` (crashed on Node.js — used browser-only `DOMMatrix` API from pdfjs-dist v5) with `unpdf`. DOCX via `mammoth`. Both are server-side only — added to `experimental.serverComponentsExternalPackages` in `next.config.mjs`.

**2. Toaster fix (edb9520):** `<Toaster richColors position="bottom-right" />` was never mounted in `dashboard/layout.tsx`. ALL toast notifications across the entire dashboard were silently doing nothing. Now fixed.

**3. Full contract analysis (d87e5bf):** Analysis was sending only the first 4k chars (just the preamble). Replaced with parallel chunked analysis — 40k chars/chunk, 2k overlap, `Promise.all`, deduplicated + sorted by severity. Now handles full contract documents.

**4. Dark theme + Contract Shield branding (f0f3872):** Complete dark-theme treatment of contracts page. Hero section with purple gradient Shield icon, "Contract Shield" name, "AI-Powered" badge, live high/medium/low flag counter badges.

**5. Contract Shield → Risk Register import (e949c92):** One-click button imports HIGH/MEDIUM flags as risk items with mitigations pre-filled. Works from both the flags list and the Risk Register tab header.

**6. Contract Shield → Exclusions AI (e949c92):** `generateContractExclusionsAction` now accepts `contractFlags?` param. When flags are present, AI generates targeted exclusions/clarifications addressing the identified risks rather than generic ones.

**7. Persistence note (e949c92):** All data (flags, risk register, exclusions, client contract clauses) saves to Supabase projects table on every action. Banner in flags panel confirms this.

**8. Client Contract 4th tier (1c9a1a4):** Full "Build Contractor Response" workflow:
- Parse uploaded client contract into clauses (AI extracts clauseRef, title, 120-char excerpt)
- Per-clause Accept / Modify / Reject toggles with inline editing
- "Download Response PDF" generates formal contractor amendment document with colour-coded clause headers (green/amber/red), proposed wording, reason for rejection
- Exclusions & clarifications appended to the PDF
- 4th tier card appears dynamically, shows accepted/modified/rejected counts
- Clauses saved to `client_contract_clauses` JSONB column

**9. Sanitisation fix (cc81400):** `.replace(/\s+/g, " ")` was collapsing ALL whitespace including newlines, turning contracts into unstructured walls of text. Fixed to `[^\S\n]+` — preserves newlines (clause structure) while normalising spaces/tabs. Applied to both `analyseContractAction` and `structureClientContractAction`.

**10. Single-pass clause parsing (39c97ad):** Two sequential AI calls for clause parsing were timing out on Vercel (combined ~30-60s). Replaced with single combined prompt: parse + recommend amendments in one call. Max 12 clauses, 120-char originals, 1-2 sentence proposals. Also fixed empty-error-string bug (catch block `msg || "Unknown error"` prevents falsy error strings silently swallowing failures).

### Key files changed this session
- `src/app/dashboard/projects/contracts/actions.ts` — all server actions
- `src/app/dashboard/projects/contracts/client-contract-editor.tsx` — full UI
- `src/app/dashboard/projects/contracts/page.tsx` — dark theme
- `src/app/dashboard/layout.tsx` — Toaster mount (affects ENTIRE dashboard)
- `next.config.mjs` — serverComponentsExternalPackages for unpdf + mammoth

### Database columns used (all exist — added earlier sprint)
- `projects.uploaded_contract_text TEXT` — raw contract text
- `projects.contract_review_flags JSONB` — AI flags array
- `projects.contract_exclusions TEXT`
- `projects.contract_clarifications TEXT`
- `projects.risk_register JSONB`
- `projects.client_contract_clauses JSONB` — clause-by-clause contractor response
- `projects.tc_tier TEXT` — 'domestic'|'commercial'|'specialist'|'client'

### Supabase storage
- Bucket: `contracts` — must exist with RLS. SQL to create:
```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('contracts', 'contracts', false);
CREATE POLICY "Users manage own contracts" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'contracts' AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM projects WHERE user_id = auth.uid()
  ));
```
- If bucket missing, users get "Upload failed: Bucket not found" — they can use "Paste text instead" as fallback

---

## Session Work Log (April 4)

### Claude Code session — evening (commits a8d6511, 0b94254, 6e10445)

**PDF theme fix (a8d6511):** `ProposalPdfButton` now fetches fresh profile from Supabase at click-time so pdf_theme is always current. Root cause: server-rendered prop was stale when theme changed in another tab without page refresh.

**BUG-001 fixed (6e10445):** Removed duplicate `md_name` input from `profile-form.tsx`. Was at ~line 615 in capability section. Canonical field is in "Managing Director Message" section (~line 753).

**BUG-003 diagnosis:** Not a code bug — profile has "Tripod Construction Ltd" as company_name from test data. The banner code is correct (`profile.company_name`). Change via Profile settings.

**BUG-004 diagnosis:** jsPDF `doc.save()` already uses direct download. No `window.open()` call exists. PDF downloads silently to ~/Downloads because Chrome does not auto-open PDFs — expected behaviour.

**Command centre rebuilt (6e10445):** `/dashboard/home` now dark-themed with:
- 4-KPI strip (Pipeline Value, Active Projects, Outstanding, Win Rate 90d)
- Company Profile card with progress bar + missing field hints
- 4 section cards (Work Winning, Pre-Construction, Live Projects, Closed Projects)
- Activity feed: colour-coded dots + status pills per proposal_status
- Expiring proposals alert (proposals within 5d of validity date)
- Quick actions footer strip

---

## PDF Fixes Applied (April 4 — commit d833388 + a8d6511)

1. **Gantt dedicated page** — Gantt chart always gets its own full page (`doc.addPage()`). Previously shared a page with Fee Proposal and was squeezed. Row height 11→13mm, header 14→16mm, label col 55→60mm, max weeks 20→26.
2. **Commercial Terms y-sync** — `y = Math.max(termLeftY, termRightY) + 6` added after `tcClauses.forEach`. Previously the closing statement rendered on top of the T&C columns.
3. **Theme fresh-fetch** — PDF button now fetches fresh `profile` from Supabase at click time (commit a8d6511). All three themes (Slate/Navy/Forest) confirmed generating distinct colour outputs.

---

## Sprint Backlog — Complete Roadmap (Sprints 15–44)

### IMMEDIATE — Bug fixes
- [x] **BUG-001** ~~Fix duplicate `md_name` input~~ — done (6e10445)
- [x] **BUG-003** ~~Wrong company name~~ — not a code bug, data issue; profile has "Tripod Construction Ltd" from test data
- [x] **BUG-004** ~~Fix PDF download~~ — not applicable; jsPDF `doc.save()` already uses direct download
- [ ] **BUG-002** Add "link not active yet" UX when proposal_token not generated (low priority)

### Sprint 12 — Close the Loop — DONE (commit 333744c)
- [x] Viewed tracking — client portal sets proposal_status 'sent'→'viewed' on page load
- [x] Accepted alert on Overview — green banner, 7-day window, client name + value
- [x] Viewed alert on Overview — blue banner, 48h window, "follow up now" prompt
- [x] Send Proposal via Email — mailto button in proposal editor, pre-filled subject + body
- [x] Full server-side email send via Resend — `src/lib/email.ts`, RESEND_API_KEY in Vercel env (commit d9e80a7)
- [x] Client confirmation email on acceptance — fires in acceptProposalAction
- [x] Contractor notification email on acceptance — fires alongside client email
- Emails send from `proposals@mail.constructa.co` (verified ✓ April 4)
- Resend domain: `mail.constructa.co`, region: eu-west-1 (Ireland)
- RESEND_FROM_EMAIL=proposals@mail.constructa.co in Vercel env
- RESEND_API_KEY set in Vercel env

### Sidebar updated (commit ff785dd)
- Overview moved above Company Profile — primary landing, no section label
- Pre-Construction items pluralised (Briefs/Estimates/Programmes/Contracts/Proposals)
- Divider colour fixed (border-white/10 not border-gray-200)

### Sprint 13 — Close the Loop (NEXT after bugs)
- [ ] Viewed tracking — notify contractor when client opens the proposal link
- [ ] Acceptance notification to contractor (email or in-app notification)  
- [ ] Project status updates on dashboard/pipeline when proposal accepted
- [ ] Email send from within Constructa (currently: copy link, paste in email)
- [ ] Email confirmation sent to client on acceptance (Supabase email or Resend.com)

### Sprint 13 — Contract Shield Polish — ✅ FULLY COMPLETE (confirmed 5 April 2026)
- [x] PDF/DOCX text extraction (unpdf + mammoth, server-side)
- [x] Full contract analysis — parallel 40k-char chunks, not just first 4k
- [x] Dark theme + "Contract Shield" branding with hero section
- [x] Flags → Risk Register one-click import (pre-filled mitigations)
- [x] Flags → Exclusions AI (contextual, not generic)
- [x] All data persists to project (flags, risks, exclusions, clauses)
- [x] Client Contract 4th tier — parse → Accept/Modify/Reject → download formal PDF response
- [x] Toaster fix — ALL dashboard toasts now work (was broken silently)
- [x] Whitespace sanitisation fix — preserves clause structure for AI
- [x] Clause parsing: converted two sequential AI calls → single-pass (timeout fix)
- [x] maxDuration = 60 on contracts page (extends Vercel function timeout)
- [x] Prompt handles unstructured contracts — works on informal docs without numbered clauses
- [x] Confirmed working end-to-end by user

---

## GO-TO-MARKET RELEASE STRATEGY

### What's Already Viable to Charge For (Now)
The pre-construction workflow is complete enough to sell:
- AI Brief + Scope → Estimate (full BoQ with rate build-up) → Programme (Gantt) → Contract Shield → Proposal PDF + Client Portal
- This solves "Dave" pain points 4 and 5 (pricing time and proposal quality) completely
- Could launch with a waitlist / beta cohort today on the existing codebase

### Batch 1 — Launch Ready (Sprints 14–24, inc. Admin Phase 1 at Sprint 20)
Polish to a standard worthy of charging money, plus the minimum admin visibility to operate the business.
Sprints 14–16 complete. Sprints 17–24 remaining (~8 sprints from now).
Target: ~8 sprints.

### Batch 2 — Live Projects (Sprints 25–30)
The "making money mid-job" module. This is what makes contractors sticky and daily-active.
Target: 3–4 months post-Batch 1.

### Batch 3 — Closed Projects + Accounts Integration (Sprints 31–34)
Project closure, handover, lessons learned, Xero/Sage sync.
Target: 6–9 months post-Batch 1.

### Data Intelligence (Sprints 35–43 + Admin Phase 2)
Meaningful only with contractor volume — 200+ active projects generating benchmarks.
Target: build Sprint 35 triggers early (low effort), Admin Phase 2 dashboard when data warrants it.
Total roadmap: Sprint 43 (was Sprint 41 before today's 2 new sprints were inserted).

---

### Sprint 14 — Job P&L Dashboard — ✅ FULLY COMPLETE (5 April 2026)
- [x] Live project margin: original estimate vs actual costs logged
- [x] Which jobs are making money — the #1 question for "Dave"
- [x] Connects billing module (invoiced) to estimate (budgeted)
- [x] Over-budget alert when costs exceed estimate section by >10%
- [x] Margin-at-completion forecast from spend-to-date rate
- [x] Budget vs actual breakdown by trade section (table with progress bars)
- [x] Cost entry form: type (labour/materials/plant/subcontract/overhead/prelims/other), section, supplier
- [x] Invoice tracker with status management (Draft/Sent/Paid)
- [x] Invoiced / Received / Outstanding cash position strip
- [x] Sidebar: Billing, Variations, Job P&L all now live (previously disabled "Soon")
- [x] DB migrations applied: `variations`, `invoices` tables created; `project_expenses` enhanced

### Sprint 15 — Resource Catalogues ✅ COMPLETE (5 April 2026)
See session log above.

### Sprint 16 — Cost Capture Enhancements ✅ COMPLETE (5 April 2026)
See session log above.

### Sprint 17 — UI/UX Consistency Pass — HIGH PRIORITY
**Problem:** Overview and Contracts pages look excellent (dark theme, hero sections, clear hierarchy).
The other sections (Brief, Estimating, Programme, Proposal editor, Profile, Resources) are inconsistent —
different card styles, lighter themes, missing hero branding, no section identity.
Every page should feel as considered and polished as Contract Shield.

**Scope:**
- [ ] Audit every dashboard page against the Contracts/Overview benchmark
- [ ] Consistent dark-slate base: `bg-slate-900` page, `bg-slate-800/50` cards, `border-slate-700`
- [ ] Every major section gets a hero/identity block (icon + title + subtitle + AI badge where applicable)
- [ ] Tab bars, button styles, input styles unified across all pages
- [ ] Typography scale consistent — headings, labels, helper text all matching
- [ ] Empty states: every list/table has a proper empty state (not just blank space)
- [ ] Loading states: spinners and skeleton screens where AI calls take time
- [ ] Mobile: at minimum, nothing should be broken on a phone (full responsive is later)

**Priority pages (worst offenders first):**
1. Brief — functional but plain, no identity, chat interface feels disconnected
2. Estimating (Costs) — dense table works but styling is dated vs the rest
3. Programme — Gantt looks reasonable but surrounding chrome is inconsistent
4. Company Profile / Settings — important for first impression, currently feels like a form dump
5. Proposal editor — the most client-facing output; needs the most polish

### Sprint 18 — Pre-Construction Workflow Refinement
**Problem:** The 5-step workflow functions but doesn't flow correctly end-to-end.
Information entered in earlier steps doesn't reliably pull through to the Proposal.
Some proposal sections are missing or incomplete. The standard needs to match Contract Shield quality.

**Scope:**
- [ ] **Brief → Proposal:** Audit what scope data flows through and what gets lost
- [ ] **Estimate → Proposal PDF:** Verify all section totals, line items, payment schedule render correctly
- [ ] **Programme → Proposal PDF:** Gantt page — confirm programme_phases always renders, fallback works
- [ ] **Contracts → Proposal PDF:** T&C tier, exclusions, clarifications, risk register all appearing correctly
- [ ] **Profile → Proposal PDF:** Logo, capability statement, MD message, case studies — all tested end-to-end
- [ ] **Proposal editor UX:** Section-by-section review — what's editable, what's auto-populated, what's missing
- [ ] **Missing proposal sections:** Identify any planned sections that aren't rendering and fix
- [ ] Full end-to-end test: create a new project, complete all 5 steps, generate PDF — document any gaps
- [ ] AI suggestions throughout: each step should have AI assistance as capable as Brief/Contracts already do

### Sprint 19 — Gantt Drag-and-Drop & Programme Polish
The Programme tab is a core part of the pre-construction workflow. Contractors expect
to adjust their programme interactively, not just via number inputs.

- [ ] Drag bars left/right to adjust start offset (sequencing)
- [ ] Drag right edge to resize duration
- [ ] Dependencies: simple Finish-to-Start linking between phases (visual connector lines)
- [ ] Snap to week grid
- [ ] Keyboard accessibility (arrow keys to nudge)
- [ ] "Critical path" highlight — identify the longest chain
- [ ] Programme summary: total duration, key milestones, auto-updated on drag
- [ ] Export to PDF reflects drag-adjusted programme (reads programme_phases)

### Sprint 20 — Constructa Admin Dashboard: Phase 1
Needed before the first paying subscriber. A protected `/admin` route reading from existing
tables via service role key — relatively quick to build, operationally essential.

- [ ] `/admin` route: email-guard (ADMIN_EMAILS list), separate layout and sidebar
- [ ] Uses `SUPABASE_SERVICE_ROLE_KEY` (already in Vercel) — bypasses RLS for cross-contractor queries
- [ ] **Your revenue:** Subscriber count by plan, MRR estimate, new signups trend
- [ ] **Your costs:** Log Vercel/Supabase/OpenAI/Resend invoices → gross margin estimate
- [ ] **Who's using it:** Contractor list — email, plan, joined date, last active, project count, proposals sent
- [ ] **Is it working:** AI error rate, Supabase DB size vs limit, recent errors
- [ ] **Usage heatmap:** Which features used, how often, per day
- [ ] **At-risk accounts:** Paying subscribers inactive >21 days (churn predictor)
- [ ] Basic user actions: manually set plan, add note, mark for follow-up

### Sprint 21 — Proposal Versioning
- [ ] Up-rev proposals (v1, v2, v3) with change tracking
- [ ] Discount feature already built — versioning enables tracking discounts per revision
- [ ] Show diff between versions (what changed in scope/price)

### Sprint 22 — Billing Module Polish
- [ ] Already functionally built — needs connecting to payment stages from Proposal
- [ ] Programme → Billing milestone automation (phases → payment schedule)

### Sprint 23 — Drawing Upload & AI Takeoff (full feature build)
The Vision Takeoff feature exists but is buried and underdeveloped. This sprint makes it
a first-class workflow entry point — the fastest way to go from a drawing to a priced estimate.

**What already exists:** Upload floor plan → GPT-4o Vision extracts items + quantities →
fuzzy-matches to 833-item cost library → "Add All to BoQ" button.

**What needs building:**
- [ ] Promote to Brief tab as primary option: "Got a drawing? Start here" hero card
- [ ] Support multiple drawing types: floor plans, elevations, site plans, structural drawings
- [ ] Annotation overlay: show extracted items highlighted on the drawing (visual confirmation)
- [ ] Confidence scores: flag low-confidence extractions for manual review
- [ ] Multi-page PDF drawings: process each page separately, merge results
- [ ] Scale detection: if drawing has a scale bar, use it to improve quantity accuracy
- [ ] Manual correction: edit quantities inline before adding to BoQ
- [ ] "Drawing register": store uploaded drawings against the project for reference
- [ ] Demo on marketing site hero (this is the headline feature that should lead all marketing)

### Sprint 24 — Video Walkthrough AI
Site video → AI extracts scope, quantities and condition notes. Solves the
problem of contractors doing site surveys and having to manually note everything down.

- [ ] Upload site walkthrough video (MP4, MOV) — up to 5 minutes
- [ ] GPT-4o Vision processes video frames at intervals (1 frame/5s)
- [ ] Extracts: rooms/areas identified, work required, approximate dimensions, condition notes
- [ ] Generates: draft project scope from walkthrough ("Kitchen — strip out, new units, tiling...")
- [ ] Maps extracted items to cost library for instant rough estimate
- [ ] Produces: site survey report PDF (area by area, condition notes, suggested scope)
- [ ] Connects to Brief: pre-fills scope text from the walkthrough analysis
- [ ] Storage: video stored in Supabase storage, linked to project
- [ ] Privacy: processing in-memory only, no video retained on OpenAI servers

--- BATCH 1 COMPLETE — LAUNCH POINT (Sprints 15–24) ---

### Sprint 25 — Live Projects: Overview
The command centre for a project once it's on site. Replaces the "Coming Soon" placeholder.
- [ ] Project health dashboard: budget RAG status, programme % complete, outstanding invoices
- [ ] Key dates strip: start date, planned completion, weeks remaining, any EOT claimed
- [ ] Quick-action buttons: raise variation, submit application, log cost, update programme
- [ ] Links to all Live Projects sub-modules from one screen
- [ ] Status banner: on programme / at risk / delayed (AI-suggested based on data)

### Sprint 26 — Live Projects: Cost Tracking
Connects to the estimate — tracks actual spend vs budget in real time.
- [ ] Log actual costs against estimate trade sections (labour, plant, materials per section)
- [ ] Budget vs actual bar chart per trade section
- [ ] Committed costs (orders placed, not yet invoiced)
- [ ] Forecast final cost: actual + committed + estimated remaining
- [ ] Over-budget alerts: flag sections >10% over estimate
- [ ] Cost approval workflow: costs above a threshold require confirmation before logging
- [ ] Links to billing module so invoiced amounts net off costs automatically

### Sprint 27 — Live Projects: Billing & Valuations
Currently functionally built — needs polish, connection to proposal, and live data wiring.
- [ ] Payment schedule pulled from Proposal (milestone or % stage payments)
- [ ] Application for Payment form: cumulative valuation, retention calc, net amount due
- [ ] Payment certificate tracking: issue date, due date, final date for payment, Pay Less Notice window
- [ ] Overdue payment alerts: flag when payment date passes without receipt
- [ ] Retention ledger: amount held, release dates (practical completion + defects)
- [ ] PDF: formal Application for Payment document matching Constructa brand standard

### Sprint 28 — Live Projects: Variations
Currently functionally built — needs polish and proper workflow.
- [ ] Raise variation: scope description, reason (client instruction / design change / unforeseen)
- [ ] Pricing: pulls from cost library / rate buildups / manual entry
- [ ] Status workflow: Draft → Submitted → Approved → Rejected → Disputed
- [ ] Client approval tracking: sent date, approved date, approved by
- [ ] Variation log: running total of approved vs pending vs disputed variations
- [ ] Incorporation into Final Account automatically
- [ ] PDF: formal Variation Order document

### Sprint 29 — Live Projects: Programme (Live Tracking)
Separate from the pre-construction Programme tab — this tracks actual vs planned on site.
- [ ] Planned vs actual Gantt: original programme bars vs actual progress bars
- [ ] % complete per phase (contractor updates weekly)
- [ ] Delay recording: cause, days lost, responsible party (client/contractor/neutral)
- [ ] Extension of Time log: claimed, agreed, outstanding
- [ ] Early warning notices: flag delays before they become disputes
- [ ] Programme narrative: AI-drafted weekly site update text based on % complete inputs

### Sprint 30 — Live Projects: Communications
Formal construction communication log — critical for dispute avoidance.
- [ ] Site instruction log: numbered, dated, description, issued by
- [ ] RFI (Request for Information) tracker: raised, responded, outstanding
- [ ] Early Warning Notices: log + PDF generation
- [ ] Letters/formal notices: templates for Pay Less Notice response, termination, extension claims
- [ ] Document register: upload and tag site photos, drawings, reports to the project
- [ ] All communications timestamped and non-editable once issued (audit trail)

--- BATCH 2 COMPLETE — LIVE PROJECTS RELEASE (Sprints 25–30) ---

### Sprint 31 — Closed Projects: Final Accounts
- [ ] Final Account summary: original contract sum + approved variations + agreed adjustments
- [ ] Retention release tracker: half on PC, half on defects expiry — with dates
- [ ] Final Account agreement status: draft → submitted → agreed → signed
- [ ] Any disputed amounts: log and status
- [ ] PDF: formal Final Account Statement document for client signature
- [ ] Link back to billing: confirm all applications reconcile to Final Account total

### Sprint 32 — Closed Projects: Handover Documents
- [ ] Document pack builder: O&M manuals, warranties, test certificates, as-built drawings
- [ ] Checklist: which documents are required vs received vs outstanding
- [ ] Upload and tag documents to the handover pack
- [ ] Client-facing handover portal: share link so client can access their documents (no auth required)
- [ ] Defects Liability Period tracker: start date, end date, items logged, items resolved
- [ ] PDF: Handover Certificate with document list and DLP dates

### Sprint 33 — Closed Projects: Archive
- [ ] Project archiving: move from active to closed with one action
- [ ] Archived project search: find by client, project type, value, year, region
- [ ] Key data preserved: final contract value, margin achieved, duration, client rating
- [ ] Reuse: copy estimate from archived project as starting point for new similar project
- [ ] "Similar projects" matching: when pricing a new job, surface archived projects of same type/value

### Sprint 34 — Closed Projects: Lessons Learned
Turns project data into business intelligence — the flywheel that improves every future bid.
- [ ] Structured retrospective: what went well, what didn't, what to do differently
- [ ] AI analysis: compare estimated vs actual margin, programme vs actual duration, variation frequency
- [ ] Insight cards: "Your groundworks sections run 15% over estimate on average"
- [ ] Win/loss analysis: compare won vs lost proposals — price point, project type, client type
- [ ] Contractor performance data over time: margin trend, on-time delivery %, repeat client rate
- [ ] Feeds back to cost library: suggest rate adjustments where actuals consistently differ from estimates

--- BATCH 3 COMPLETE — CLOSED PROJECTS RELEASE (Sprints 31–34) ---

### Sprint 35 — Data Foundation
The aggregation layer that makes cross-contractor intelligence possible. Built entirely as
a database migration — zero changes to the contractor-facing app required.

**Benchmark tables (anonymised, no RLS, service-role only, no PII):**
- `project_benchmarks` — project type, region, contract value band, margin %, duration weeks
- `rate_benchmarks` — trade, role, region, day rate (anonymised median / P25 / P75)
- `labour_benchmarks` — trade section, labour % of total cost, manhour productivity
- `plant_benchmarks` — plant item, day rate, % of project cost, hire vs owned split
- `material_benchmarks` — category, unit rate, regional variance, supplier type
- `programme_benchmarks` — project type, contract value, planned weeks, actual weeks, slippage
- `variation_benchmarks` — project type, variation count, uplift %, % approved / disputed
- `contract_risk_benchmarks` — contract type, risk flag count, outcome (claim / no claim)

**Triggers (fire on key events):**
- [ ] On project status → 'closed': write to `project_benchmarks`, `programme_benchmarks`
- [ ] On invoice status → 'paid': write to `payment_benchmarks` (days late, retention release)
- [ ] On variation status → 'approved'/'disputed': write to `variation_benchmarks`
- [ ] On estimate created: write budget rates to `rate_benchmarks` (anonymised)
- [ ] On actual cost logged: write actuals to `labour/plant/material_benchmarks`
- [ ] Data consent flag: `contractors.data_consent = true` gates all trigger writes (GDPR)
- [ ] Add data consent checkbox to onboarding and Settings page

### Sprint 36 — Admin Dashboard Phase 2
Superadmin tooling to explore, visualise and act on the benchmark data accumulated in Sprint 35.
Only accessible to Constructa staff — not visible to contractors.

- [ ] Data intelligence explorer: query benchmark tables by region, project type, value band, date range
- [ ] Benchmark browser: paginated table of all rate/labour/plant benchmarks with filters + CSV export
- [ ] Market rate maps: choropleth map of UK regions showing median day rates by trade, powered by `rate_benchmarks`
- [ ] Anonymous percentile positioning: "This contractor's labour rates are in the 70th percentile for London groundworks"
- [ ] Platform analytics dashboard: MAU, DAU, proposals sent per day, estimates created, P&L modules activated
- [ ] Churn prediction: flag contractors with no login >14 days, no proposal sent >30 days
- [ ] At-risk accounts: combine churn signals into a risk score, surface top-20 at-risk accounts for intervention
- [ ] Usage heatmap: which features are used most / least — informs deprioritisation decisions

### Sprint 37 — Contractor Management Accounts
A consolidated financial view across ALL of a contractor's projects — the equivalent of
a simple management accounts pack, generated automatically from Constructa data.

- [ ] Consolidated P&L: sum of all project margins (estimated vs actual) across the business for any date range
- [ ] Cash flow forecast: projected inflows (outstanding applications) vs committed outflows (logged costs not yet paid)
- [ ] WIP (Work In Progress) schedule: value of work done not yet invoiced across all live projects
- [ ] Overhead absorption report: total business overhead vs overhead recovered via `overhead_pct` across all estimates
- [ ] Year-to-date summary: revenue, cost, gross margin, overhead, net margin — by month
- [ ] Per-project comparison table: all projects side by side — contract value, invoiced, received, margin %
- [ ] Exportable to PDF (management accounts format) and CSV (for accountant import)
- [ ] Date range picker: filter by financial year, calendar year, or custom range

### Sprint 38 — Xero Integration
Push invoices and expenses to Xero, pull payment status back. Eliminates double-entry
between Constructa and the contractor's accounting software.

- [ ] OAuth2 connection flow: "Connect to Xero" in Settings → Xero consent screen → token stored encrypted
- [ ] Push invoices: on "Invoice Sent" in Constructa → create draft invoice in Xero (line items, amounts, due date)
- [ ] Pull payment status: poll Xero daily → mark Constructa invoices as paid when Xero confirms receipt
- [ ] Push expenses: on cost logged in P&L → create bill/expense in Xero (supplier, amount, category)
- [ ] Trade section → Xero tracking category mapping: configurable in Settings (e.g. "Groundworks" → Xero tracking code "GW")
- [ ] Sync log: timestamped record of every push/pull with status (success / error / skipped)
- [ ] Error handling: show failed syncs in Settings with retry button and error detail
- [ ] Disconnect/reconnect: revoke token and reconnect without losing sync history

### Sprint 39 — QuickBooks / Sage Integration
Same push/pull pattern as Xero, extended to the two next most common accounting packages
used by UK SME contractors. Single unified sync settings page covers all three integrations.

- [ ] QuickBooks Online OAuth2 connection flow (same pattern as Xero Sprint 38)
- [ ] Push invoices to QuickBooks (QBO invoice API)
- [ ] Pull payment status from QuickBooks
- [ ] Push expenses to QuickBooks
- [ ] Sage Business Cloud OAuth2 connection flow
- [ ] Push invoices to Sage
- [ ] Pull payment status from Sage
- [ ] Push expenses to Sage
- [ ] Unified sync settings page: shows all three integrations (Xero / QuickBooks / Sage), one active at a time
- [ ] Sync health indicator: last synced timestamp, error count, items pending
- [ ] Field mapping UI: map Constructa trade sections to accounting categories for each platform

### Sprint 40 — Accounting Phase 2: Reconciliation
Bank feed import and transaction matching — the step beyond just pushing to accounting software.
Enables contractors to reconcile payments received against Constructa invoices without leaving the app.

- [ ] Bank feed import: CSV upload (standard bank export format) or Plaid open banking connection
- [ ] Transaction parser: extract date, payee/payer, reference, amount from bank CSV
- [ ] Auto-match: fuzzy-match bank transactions to outstanding Constructa invoices by amount + reference
- [ ] Manual match: review unmatched transactions and link to invoice or expense manually
- [ ] Reconciliation dashboard: unmatched transactions, matched transactions, reconciled total vs outstanding
- [ ] VAT return preparation: group expenses and income by VAT period, calculate VAT due/reclaimable
- [ ] VAT summary export: MTD-compatible CSV for HMRC Making Tax Digital submission
- [ ] Audit trail: every match/unmatch logged with timestamp and user

### Sprint 41 — Market Intelligence Product
Constructa's benchmark data becomes a sellable B2B data product for professionals who
need accurate UK construction cost intelligence — QS firms, developers, lenders, insurers.

- [ ] Data API: REST endpoints returning regional benchmark rates (authenticated, rate-limited, paid tier)
- [ ] Quarterly construction cost index: median rates by trade + region + project type, published quarterly
- [ ] Subscriber portal: separate dashboard for B2B data customers (not contractors) — browse, filter, download
- [ ] B2B subscription pricing: tiered access (Single region £X/mo, National £Y/mo, Full API access £Z/mo)
- [ ] White-label PDF report generator: "East Midlands Construction Cost Report Q2 2026" — downloadable on demand
- [ ] Report builder UI: select region, project type, trade sections, date range → generate branded PDF
- [ ] Data consent audit: confirm all benchmark data used in reports passes through the consent gate from Sprint 35
- [ ] Partnership pipeline: target RICS-registered QS practices, development finance lenders, building insurers

### Sprint 42 — Native Mobile App
Core Constructa workflows available offline and on the go. Targets the on-site use case —
a site manager or director who needs to log costs, check P&L, or raise a variation from the job.

- [ ] Technology decision: React Native (Expo) or PWA — evaluate against App Store requirements
- [ ] Core mobile workflows: log cost (all 5 types), view project P&L, raise variation, check invoice status
- [ ] Camera receipt capture: photograph receipt → upload to Supabase Storage → attach to cost entry (replaces file picker)
- [ ] Push notifications: overdue payment alerts, variation approved/rejected, programme milestone due
- [ ] Offline mode: queue cost log entries locally, sync when back online (SQLite local store)
- [ ] Biometric auth: Face ID / Touch ID login on supported devices
- [ ] App Store submission: iOS App Store and Google Play Store — handle review process
- [ ] Deep links: notification tap → opens correct project/screen in app
- [ ] Mobile-optimised UI: all existing components adapted for touch and small screens

### Sprint 43 — Regional Pricing Intelligence + Merchant Procurement Layer
Closes the loop between Constructa's benchmark data and real purchasing decisions. Contractors
see whether their rates are competitive, and can order materials directly from trade suppliers
linked to their estimate lines — with pricing that reflects Constructa's collective buying power.

- [ ] Regional rate benchmarks surfaced to contractors: "Your bricklayer rate is 12% above the London median"
- [ ] Rate adjustment suggestions: "Based on 47 similar projects, consider repricing this section"
- [ ] Percentile positioning card: per trade section, show contractor's rate vs P25/P50/P75 for their region
- [ ] Travis Perkins integration: OAuth or API key connection, fetch live pricing for materials on estimate lines
- [ ] Jewson integration: same pattern — live pricing for timber, civils, building materials
- [ ] Selco integration: same pattern — focus on joinery and building materials
- [ ] Materials ordering: from estimate lines → one-click create basket on merchant site with pre-filled quantities
- [ ] Bulk pricing: Constructa negotiates group rates — contractors ordering via platform get preferential pricing
- [ ] Delivery tracking: merchant order status → auto-log delivery as material cost entry in P&L
- [ ] Merchant analytics (admin): which suppliers are used most, GMV through platform, referral fee model

### Sprint 44 — Resource Planning & Staff Allocation
Cross-project resource management — lets contractors see at a glance whether they have the
people available to deliver their pipeline. Solves the critical problem of over-committing
labour across multiple overlapping projects, and surfaces conflicts before they become on-site crises.

- [ ] Staff allocation view: per-person calendar showing which project they are assigned to, on which dates
- [ ] Cross-project Gantt overlay: all active + upcoming projects on one timeline, colour-coded by project
- [ ] Resource availability: calculate free days per person per week based on allocations vs contracted days
- [ ] Allocation editor: drag staff onto project phases to assign them, or use a form (project, phase, start, end, days/week)
- [ ] Red flag alerts: highlight weeks where a person is over-allocated (>5 days/week or >contracted days)
- [ ] Project staffing view: per-project breakdown of who is allocated, for how long, at what cost rate
- [ ] Holiday & absence register: log planned holidays, training days, bank holidays per person — these block availability automatically
- [ ] Absence calendar: monthly view per person showing working days, holidays, allocated days, free days
- [ ] Demand vs supply: aggregate view — total labour days demanded by all live projects vs total available across the workforce
- [ ] Under-resourcing alerts: flag projects where allocated days are fewer than estimated manhours require
- [ ] Subcontractor slots: allocate named subcontractors (from plant/staff catalogues) the same way as directly employed staff
- [ ] Export: weekly resource schedule as PDF or CSV for sharing with site managers

--- BATCH 4 COMPLETE — DATA & ADMIN LAYER (Sprints 35–44) ---

### DEPRIORITISED (post-launch with real user data)
- Mobile responsive full pass (Sprint 17 prevents breakage; full pass later)
- Voice-to-proposal wizard
- SS-FS Gantt dependencies beyond Sprint 19 scope

---

## CONSTRUCTA DATA INTELLIGENCE ARCHITECTURE

### No Major Rewrite Required — Architecture Confirms This

The existing schema already captures data at the right granularity. The `estimate_line_components` table already breaks every cost into `labour | plant | material | consumable | temp_works | subcontract`. The `estimates` table already stores `overhead_pct`, `profit_pct`, `risk_pct`, `prelims_pct`. Geographic data (`lat`, `lng`, `postcode`, `region`) is already on every project.

**What is needed is NOT a rewrite — it is an aggregation layer on top:**
- A set of anonymised benchmark tables (no RLS, no PII, service-role only)
- Supabase triggers that fire when key events happen (project closed, invoice paid, variation approved)
- These triggers copy the relevant signal data into the benchmark tables — no user data, just numbers and categories
- As contractors log actuals (Sprints 22–25), those actuals automatically feed the benchmarks

This can be built entirely in Sprint 35 as a pure database migration — no changes to the contractor-facing app required.

### Full Data Capture Scope — Everything That Must Be Recorded

**Budget layer (already captured in estimate tables):**
- Labour: trade, role, day rate, manhours, total — per line item ✓
- Plant: item, day rate, duration, total — per line item ✓
- Materials: item, unit, rate, quantity, total — per line item ✓
- Subcontract: trade section, value — per line item ✓
- Consumables: per line item ✓
- Prelims: `prelims_pct` on estimate (default 10%) ✓
- Overhead: `overhead_pct` on estimate (default 10%) ✓
- Profit: `profit_pct` on estimate (default 15%) ✓
- Risk allowance: `risk_pct` on estimate (default 5%) ✓
- Sell rate vs cost rate: both captured at line level ✓
- Trade section totals and project total ✓
- Programme forecast: phase name, duration, start offset, manhours ✓

**Actual layer (to be captured in Sprints 22–25 — cost tracking module):**
- Actual labour costs logged: trade, role, days worked, rate, total
- Actual plant costs: item, days, rate, total
- Actual material costs: supplier, item, qty, cost
- Actual subcontract costs: trade, agreed value, final account value
- Actual programme: phase start/end dates, slippage in days, delay cause
- Actual prelims spend (scaffolding, welfare, management time)

**Commercial layer (Sprints 23–24):**
- Applications for payment: gross valuation, deductions, retention, net claimed
- Payment received: date received, days from due date (early/on time/late/disputed)
- Retention held: amount, release date expected, release date actual
- Variations: count, total value, % approved, % disputed, average time to agree
- Final account: agreed value vs contract sum

**Risk & Contract layer (already partially captured):**
- Contract Shield flags: high/medium/low count per project ✓
- T&C tier used ✓
- Risk register items: likelihood, impact, mitigation recorded ✓
- Risk realisation: did the risk materialise? (to be captured in Lessons Learned — Sprint 30)
- Opportunity realisation: did the opportunity convert?

**Outcome layer (at project close):**
- Estimated margin % vs actual margin %
- Programme slippage in weeks
- Variation uplift as % of contract sum
- Payment performance: average days late across all applications
- Client rating (optional contractor input)
- Win/loss on proposal (already captured via `proposal_status`) ✓

### Current State — Honest Assessment
All contractor data is stored correctly but siloed per-contractor via Supabase RLS (Row Level Security). The geographic fields already exist on projects (`lat`, `lng`, `postcode`, `region`) but no cross-contractor aggregation exists yet. No rewrite needed — just the aggregation layer.

**What is NOT captured yet (needs building):**
- No anonymised cross-contractor aggregate tables (Sprint 31)
- No actual cost logging yet (Sprint 22)
- Labour rates tagged `region = 'national'` only — regional differentiation needed
- No data consent/transparency clause in T&Cs (legally required before aggregating)

### Architecture Required — Platform Intelligence Layer

**The mechanism:** When a contractor completes a project or closes a record, a Supabase database trigger (or server action) fires and writes an anonymised snapshot to a set of aggregate tables. No PII. No user_id. Just the signal data.

**Access:** These aggregate tables have NO RLS — they are readable only via the Supabase service role key, which is used exclusively by the Constructa admin backend (never exposed to contractors).

**Tables to create (Sprint 31):**

```sql
-- ── 1. Project Outcome Benchmark ─────────────────────────────────────────────
-- One row per closed project. Captures the full budget vs actual story.
-- NO PII. NO user_id. Trigger fires on project_status → 'closed'.
project_benchmarks (
  id UUID, created_at TIMESTAMPTZ,
  -- Classification
  project_type TEXT,              -- 'residential_extension', 'loft_conversion', 'commercial_fitout', etc.
  contract_value_band TEXT,       -- '<25k'|'25-75k'|'75-200k'|'200-500k'|'>500k'
  region TEXT,                    -- 'London'|'South East'|'South West'|'Midlands'|'North West', etc.
  postcode_district TEXT,         -- First 3-4 chars only: 'SW1', 'M14', 'B1' (not full postcode)
  tc_tier TEXT,                   -- 'domestic'|'commercial'|'specialist'|'client'
  client_type TEXT,               -- 'residential'|'commercial'|'public sector'
  -- Budget (from estimate at proposal stage)
  budget_total NUMERIC,           -- Total contract value inc. VAT
  budget_labour_pct NUMERIC,      -- Labour as % of direct cost
  budget_plant_pct NUMERIC,
  budget_materials_pct NUMERIC,
  budget_subcontract_pct NUMERIC,
  budget_prelims_pct NUMERIC,     -- Prelims allowance %
  budget_overhead_pct NUMERIC,    -- OH allowance %
  budget_risk_pct NUMERIC,        -- Risk allowance %
  budget_profit_pct NUMERIC,      -- Profit margin %
  budget_gross_margin_pct NUMERIC,-- Overall gross margin % at tender
  -- Actuals (populated as cost tracking is logged; may be NULL on early capture)
  actual_total NUMERIC,
  actual_labour_pct NUMERIC,
  actual_plant_pct NUMERIC,
  actual_materials_pct NUMERIC,
  actual_subcontract_pct NUMERIC,
  actual_prelims_pct NUMERIC,
  actual_gross_margin_pct NUMERIC,-- What was actually achieved
  margin_variance_pct NUMERIC,    -- actual - budget margin (negative = cost overrun)
  -- Programme
  programme_estimated_weeks INTEGER,
  programme_actual_weeks INTEGER,
  programme_slippage_weeks INTEGER,-- actual - estimated (negative = early, positive = late)
  -- Variations
  variation_count INTEGER,
  variation_approved_value NUMERIC,
  variation_disputed_value NUMERIC,
  variation_uplift_pct NUMERIC,   -- variations as % of original contract sum
  -- Payments
  payment_apps_count INTEGER,     -- number of applications submitted
  payment_avg_days_late NUMERIC,  -- average days late across all payments (0 = on time)
  payment_disputed_count INTEGER, -- number of disputed/Pay Less Notice applications
  retention_held NUMERIC,         -- £ retention still held at practical completion
  -- Contract & Risk
  contract_shield_high_flags INTEGER,
  contract_shield_medium_flags INTEGER,
  risk_register_items INTEGER,
  risks_materialised INTEGER,     -- how many risk register items actually occurred
  opportunities_captured INTEGER, -- how many opportunity items were realised
  -- Outcome
  proposal_win BOOLEAN,
  final_account_agreed BOOLEAN,
  client_repeat BOOLEAN           -- did this client come back? (lag metric, populated later)
  -- NEVER: user_id, project name, client name, site address, contractor name
)

-- ── 2. Rate Benchmark ─────────────────────────────────────────────────────────
-- One row per estimate line item at project close. The market rate dataset.
rate_benchmarks (
  id UUID, created_at TIMESTAMPTZ,
  trade_section TEXT,             -- 'Groundworks', 'Carpentry', 'M&E', etc.
  work_category TEXT,             -- normalised work type within trade
  unit TEXT,                      -- m², nr, m, sum, etc.
  sell_rate NUMERIC,              -- rate charged to client (ex VAT)
  net_cost_rate NUMERIC,          -- actual cost rate (if cost tracking available)
  gross_margin_pct NUMERIC,       -- (sell - cost) / sell
  region TEXT,
  postcode_district TEXT,
  project_type TEXT,
  contract_value_band TEXT,
  quarter TEXT                    -- 'Q1-2026', 'Q2-2026' — for time-series trending
  -- NEVER: user_id, project_id
)

-- ── 3. Labour Rate Benchmark ──────────────────────────────────────────────────
-- What contractors actually pay for labour by trade, role, region.
labour_benchmarks (
  id UUID, created_at TIMESTAMPTZ,
  trade TEXT,
  role TEXT,
  day_rate NUMERIC,               -- actual day rate paid
  region TEXT,
  postcode_district TEXT,
  engagement_type TEXT,           -- 'direct'|'subcontract'|'agency'
  quarter TEXT
  -- NEVER: user_id
)

-- ── 4. Plant & Material Benchmarks ───────────────────────────────────────────
-- Actual plant hire rates and material costs vs cost library rates.
plant_benchmarks (
  id UUID, created_at TIMESTAMPTZ,
  item_description TEXT,
  unit TEXT,
  actual_rate NUMERIC,
  library_rate NUMERIC,           -- what the cost library suggested
  variance_pct NUMERIC,
  region TEXT,
  quarter TEXT
)

material_benchmarks (
  id UUID, created_at TIMESTAMPTZ,
  item_description TEXT,
  category TEXT,                  -- 'Roofing'|'Groundworks'|'Insulation', etc.
  unit TEXT,
  actual_rate NUMERIC,
  library_rate NUMERIC,
  variance_pct NUMERIC,
  region TEXT,
  supplier_type TEXT,             -- 'merchant'|'direct'|'specialist' (NOT supplier name)
  quarter TEXT
)

-- ── 5. Programme Benchmark ────────────────────────────────────────────────────
-- Estimated vs actual duration per phase type. Powers programme accuracy insights.
programme_benchmarks (
  id UUID, created_at TIMESTAMPTZ,
  phase_name_normalised TEXT,     -- 'Groundworks'|'Steelwork'|'Roofing'|'First Fix', etc.
  estimated_weeks NUMERIC,
  actual_weeks NUMERIC,
  slippage_weeks NUMERIC,
  delay_cause TEXT,               -- 'client'|'contractor'|'weather'|'supply_chain'|'design'
  project_type TEXT,
  region TEXT,
  contract_value_band TEXT,
  quarter TEXT
)

-- ── 6. Payment Performance Benchmark ─────────────────────────────────────────
-- How quickly clients pay, by sector. The payment culture dataset.
payment_benchmarks (
  id UUID, created_at TIMESTAMPTZ,
  client_type TEXT,               -- 'residential'|'commercial'|'developer'|'public'
  tc_tier TEXT,
  days_to_payment INTEGER,        -- actual days from due date to receipt
  payment_status TEXT,            -- 'on_time'|'late'|'disputed'|'part_paid'
  retention_released BOOLEAN,     -- was retention released on time?
  region TEXT,
  contract_value_band TEXT,
  quarter TEXT
)

-- ── 7. Variation Benchmark ────────────────────────────────────────────────────
-- Variation frequency, value, and resolution time by project type.
variation_benchmarks (
  id UUID, created_at TIMESTAMPTZ,
  cause TEXT,                     -- 'client_instruction'|'design_change'|'unforeseen'|'provisional_sum'
  value_band TEXT,                -- '<1k'|'1-5k'|'5-25k'|'>25k'
  days_to_agree INTEGER,          -- how long from raised to approved
  outcome TEXT,                   -- 'approved'|'disputed'|'withdrawn'
  project_type TEXT,
  client_type TEXT,
  region TEXT,
  quarter TEXT
)

-- ── 8. Contract Risk Benchmark ────────────────────────────────────────────────
-- Which contract clauses are most commonly flagged by Contract Shield.
contract_benchmarks (
  id UUID, created_at TIMESTAMPTZ,
  tc_tier TEXT,
  clause_type TEXT,               -- 'payment'|'liability'|'LADs'|'retention'|'design', etc.
  severity TEXT,                  -- 'high'|'medium'|'low'
  flag_type TEXT,                 -- 'risk'|'obligation'|'unusual'
  client_type TEXT,
  region TEXT,
  quarter TEXT
)
```

**Trigger events (when each benchmark fires):**
- Project closed / Final Account agreed → `project_benchmarks` + `programme_benchmarks`
- Each estimate line at project close → `rate_benchmarks` + `labour_benchmarks` + `plant_benchmarks` + `material_benchmarks`
- Each payment received → `payment_benchmarks`
- Each variation agreed/closed → `variation_benchmarks`
- Each Contract Shield analysis → `contract_benchmarks` (fires immediately, not at close)

**Regional intelligence:** At 1,000 contractors across the UK, `rate_benchmarks` filtered by `region + trade_section + quarter` gives a real market rate index. At 5,000 it's a publishable dataset. At 10,000 it's infrastructure-grade data that banks, insurers, and developers will pay for.

**Legal note:** Before launching aggregation, add to Terms of Service: "By using Constructa, you agree that anonymised, non-identifiable project and cost data may be used to improve platform benchmarks and market intelligence." Standard SaaS practice — must be explicit and visible at signup.

---

## CONSTRUCTA OWNER DASHBOARD (Admin Backend)

### Overview
A completely separate section of the app — `/admin/*` — locked to a specific admin email.
Uses the Supabase **service role key** (bypasses RLS) to query across all contractors.
Never shared with contractor-facing routes. This IS the Constructa management accounts.

**Auth pattern:**
```typescript
// src/app/admin/layout.tsx
const ADMIN_EMAILS = ['robert@constructa.co'];
const user = await supabase.auth.getUser();
if (!ADMIN_EMAILS.includes(user.data.user?.email || '')) redirect('/dashboard');
// Use service role client (SUPABASE_SERVICE_ROLE_KEY) for all admin queries
```

---

### Admin Module 1 — Constructa P&L / Management Accounts
**This is your management accounts for the Constructa business itself.**
Not contractor data — the health of the SaaS business as a company.

**Revenue:**
- [ ] MRR (Monthly Recurring Revenue): live, by plan tier (Free/Pro/Business)
- [ ] ARR (Annual Run Rate): MRR × 12
- [ ] Revenue trend: month-by-month bar chart, growth rate %
- [ ] Revenue by plan: % split Free vs Pro vs Business — shows where revenue concentrates
- [ ] New MRR: revenue from new subscribers this month
- [ ] Expansion MRR: revenue from upgrades (Free→Pro, Pro→Business)
- [ ] Churned MRR: revenue lost from cancellations

**Costs (Constructa operating costs):**
- [ ] Vercel hosting: log monthly invoice cost
- [ ] Supabase: log monthly invoice cost (scales with DB size + bandwidth)
- [ ] OpenAI API: track spend via OpenAI usage API (cost per month, per active user)
- [ ] Resend email: log monthly cost
- [ ] Total platform cost per month
- [ ] Cost per active user (total monthly costs ÷ MAU)
- [ ] AI cost as % of revenue — the key efficiency metric as AI usage grows

**Gross Margin:**
- [ ] Revenue − platform costs = gross margin £ and %
- [ ] Monthly gross margin trend
- [ ] Target: platform costs should be <15% of revenue at scale

**Customer Metrics:**
- [ ] Total subscribers: Free, Pro, Business count + trend
- [ ] Net new subscribers: gained − lost this month
- [ ] Churn rate: % of paying subscribers who cancelled
- [ ] LTV (Lifetime Value): average revenue per paying subscriber × avg subscription length
- [ ] CAC (Customer Acquisition Cost): if/when paid marketing runs
- [ ] LTV:CAC ratio — the fundamental SaaS health metric
- [ ] At-risk accounts: paying subscribers inactive >21 days (churn predictor)

**Cash:**
- [ ] Cash collected this month (Stripe payments received)
- [ ] Outstanding (subscribers in arrears)
- [ ] Next 90 days projected revenue (current MRR × 3, adjusted for known churn)

---

### Admin Module 2 — Platform Analytics
Usage and engagement across the contractor base.
- [ ] DAU/MAU: daily and monthly active users
- [ ] Feature usage heatmap: which modules used most — proposals, estimates, Contract Shield, billing
- [ ] Session depth: how far through the workflow do contractors get? (Brief→Estimate→Programme→Contracts→Proposal)
- [ ] AI usage: calls per day, tokens per call, which features drive most AI usage
- [ ] New signup trend: daily/weekly chart
- [ ] Conversion funnel: signed up → created project → sent proposal → won project
- [ ] Geographic spread: where are contractors? UK map by postcode district
- [ ] Trade mix: what trades are using Constructa? (from profiles.preferred_trades)
- [ ] Time-to-first-proposal: how long from signup to first proposal sent? (target <10 min)

---

### Admin Module 3 — User Management
- [ ] All contractors: email, plan, joined, last active, project count, proposals sent, proposals won
- [ ] Search/filter by plan, region, trade, activity level, join date
- [ ] Individual contractor summary: usage metrics only — no access to their actual project content
- [ ] Manual plan override (for trials, support arrangements, partnerships)
- [ ] Subscription management: cancel, upgrade, downgrade, extend trial
- [ ] Account notes: log support interactions, sales conversations
- [ ] Churned users: who cancelled, when, how long they were active — spot patterns

---

### Admin Module 4 — Data Intelligence
Reads from anonymised benchmark tables (Sprint 31). The growing data asset.
- [ ] Rate benchmark explorer: trade × region × project type → P25/median/P75 sell rates over time
- [ ] Labour rate map: what are contractors paying labour by region and role?
- [ ] Material cost tracker: how do actual costs compare to library rates? Where is the library wrong?
- [ ] Margin distribution: histogram of gross margins achieved across the platform — by project type
- [ ] Programme accuracy: estimated vs actual weeks by phase — where do contractors consistently underestimate?
- [ ] Variation analysis: frequency, value, cause, time to agree — by project type and region
- [ ] Payment performance: average days late by client type — the industry payment culture dataset
- [ ] Risk realisation: which risk register items actually materialised?
- [ ] Contract risk heatmap: which clauses get flagged most by Contract Shield?
- [ ] Data volume: records collected per benchmark table, by region, growth rate — the moat tracker

---

### Admin Module 5 — Content Management
- [ ] System cost library editor: add/edit/remove `cost_library_items` (is_system_default = true)
- [ ] System labour rates: add/edit by trade, role, region — bulk regional uplift (e.g. London +15%)
- [ ] AI prompt management: view and edit Contract Shield, Brief AI, Risk Register prompts in-app
- [ ] Email template management: edit transactional email copy
- [ ] Platform announcements: push a banner message to all contractor dashboards

---

### Admin Module 6 — Market Intelligence (The Data Product)
The monetisable output of the benchmark data. Requires Sprint 31 data to be meaningful.
- [ ] Rate Index reports: "South East Residential Construction — Q2 2026"
- [ ] Regional rate cards: what's the market sell rate for key work categories by region?
- [ ] Seasonal trends: do rates and margins shift by quarter?
- [ ] Project type benchmarks: cost/m² ranges, typical margins, typical programme by project type
- [ ] Payment culture index: average days to payment by client sector and region
- [ ] Export: downloadable CSV and PDF reports
- [ ] API access: paid endpoint for developers, QS firms, mortgage lenders, insurers to query benchmark data

---

### Admin Module 7 — Platform Health
- [ ] Vercel function error rate: flag if AI calls are failing above a threshold
- [ ] OpenAI spend tracker: daily/monthly cost, cost per AI call, per active user — alert if spike
- [ ] Supabase: DB size, row counts, storage, bandwidth vs plan limits
- [ ] Email delivery: Resend send rate, bounce rate, open rate
- [ ] Failed background jobs / errored server actions
- [ ] Response times: flag any Vercel functions taking >3s consistently

---

## CONTRACTOR MANAGEMENT ACCOUNTS & ACCOUNTING INTEGRATION

### Vision
The cost data contractors log through Constructa (estimates, actual costs, invoices, variations)
IS their accounting source of truth. The goal is to make Constructa the base layer for their
management accounts — removing the need to re-enter data into a separate accounting package.

### Contractor Management Accounts (Sprint 34)
A per-contractor P&L and cash flow dashboard — their business in numbers.
- [ ] **Project P&L:** For each project: contract value, costs logged, gross margin £ and %
- [ ] **Consolidated P&L:** All active projects combined — total revenue, total cost, total margin
- [ ] **Rolling 12-month P&L:** Month-by-month revenue and margin — is the business growing?
- [ ] **Cash flow forecast:** Applications due, expected receipts, costs due to be paid — 13-week view
- [ ] **Debtor ledger:** Who owes money, how much, how overdue — with chase prompts
- [ ] **Retention tracker:** Total retention held across all projects, expected release dates
- [ ] **Work in progress (WIP):** Value of work done but not yet invoiced
- [ ] **Overhead recovery:** Are the overhead and profit margins actually being recovered?
- [ ] **Tax estimate:** Simplified CIS deduction tracker, VAT on invoices raised

### Accounting Integration — Xero (Sprint 35)
Xero is the dominant accounting package for UK SME contractors.
- [ ] **OAuth connection:** Contractor connects their Xero account from Constructa settings
- [ ] **Invoice sync:** When an Application for Payment is raised in Constructa → create draft invoice in Xero
- [ ] **Payment sync:** When payment is marked received in Constructa → reconcile in Xero
- [ ] **Cost sync:** When actual costs are logged in Constructa → create bill/purchase in Xero
- [ ] **Subcontractor payments:** CIS deduction calculations pushed to Xero
- [ ] **Chart of accounts mapping:** Map Constructa trade sections to Xero nominal codes
- [ ] **Bank feed reconciliation prompt:** Flag Xero transactions not yet matched to a Constructa project
- [ ] Xero API: OAuth 2.0, `xero-node` SDK, webhook for payment received events

### Accounting Integration — Sage (Sprint 36)
Sage 50 and Sage Business Cloud are common in slightly larger UK contractors.
- [ ] Same sync capability as Xero — invoices, payments, costs, CIS
- [ ] Sage Business Cloud API (REST, OAuth)
- [ ] Sage 50 — more complex, CSV import/export as fallback if API too restrictive

### Accounting Integration — QuickBooks (Sprint 37)
Growing presence in UK SME market.
- [ ] Same sync capability
- [ ] QuickBooks Online API (OAuth 2.0)

### Data Ownership Principle
The contractor owns their data. Constructa holds it as processor, not controller.
- Export all data as CSV or JSON at any time (GDPR right to portability)
- On account closure: 90-day data retention then deletion, or export first
- Accounting integrations are always contractor-initiated and revocable
- Constructa never reads from accounting packages — only writes to them

---

--- BATCH 3 COMPLETE ---

## DATA & ADMIN LAYER (Sprints 32–39)
> Runs in parallel with Batches 2 & 3 where possible.
> Sprint 32 (Admin Phase 1) is time-sensitive — needed from first paying subscriber.
> Sprint 33 (Data Foundation) can be built any time but needs contractor volume to be useful.

## Sprint 32 — Constructa Admin Dashboard: Phase 1 ← BUILD EARLY (see Sprint 17 above)
> NOTE: Sprint 17 IS this sprint — it was moved forward into Batch 1.
> Listed here for reference. By the time we reach this number it should already be done.

## Sprint 33 — Data Intelligence Foundation
Pure backend — no UI. Can be built any time; triggers collect data silently.
Best built once 50+ contractors are active so backfill seeding is meaningful.
- [ ] Create all 8 benchmark tables (no RLS, service-role access only)
- [ ] Supabase triggers: project close, payment received, variation closed, Contract Shield analysis
- [ ] `postcode_district` extraction (first 3-4 chars: 'SW1A 2AA' → 'SW1')
- [ ] `region` standardisation: postcode prefix → 12 UK regions
- [ ] Contract Shield trigger: writes to `contract_benchmarks` on every analysis (immediate)
- [ ] PII validation: automated check that aggregate tables contain no email/name patterns
- [ ] Terms of Service update: data aggregation consent clause
- [ ] Backfill: run against all existing closed/accepted projects

## Sprint 34 — Constructa Admin Dashboard: Phase 2 (Data Intelligence)
Requires Sprint 33 to have been running for at least 2–3 months with real contractor data.
- [ ] Module 4: Data Intelligence (benchmark explorer, regional rate map, margin distribution)
- [ ] Module 5: Content Management (cost library editor, labour rates by region, AI prompts)
- [ ] Module 6: Market Intelligence (first exportable benchmark reports — PDF + CSV)

## Sprint 35 — Contractor Management Accounts
- [ ] Per-project P&L: contract value, costs logged, gross margin £ and %
- [ ] Consolidated P&L: all active projects combined
- [ ] Cash flow forecast: 13-week view of expected receipts and costs due
- [ ] Debtor ledger: who owes what, how overdue, chase prompts
- [ ] Retention tracker: total held, expected release dates
- [ ] WIP valuation: work done but not yet invoiced

## Sprint 36 — Xero Integration
- [ ] OAuth connection from Constructa settings
- [ ] Invoice sync: Application for Payment → Xero draft invoice
- [ ] Payment sync: marked received → reconcile in Xero
- [ ] Cost sync: logged actuals → Xero bills
- [ ] CIS deduction calculations
- [ ] Chart of accounts mapping (Constructa trade sections → Xero nominal codes)

## Sprint 37 — Sage Integration
## Sprint 38 — QuickBooks Integration

## Sprint 39 — Admin Dashboard: Phase 3 (Market Intelligence Product)
By this point data volume should support a sellable product.
- [ ] Rate Index reports: quarterly by region and trade (PDF + web)
- [ ] API endpoint: paid access for QS firms, developers, mortgage lenders, insurers
- [ ] Pricing: per-report purchase or API subscription tier

### LONG-TERM VISION (V2+)
- Native mobile app + site walkthrough voice wizard
- Video walkthrough AI (GPT-4o Vision reads site video)
- Merchant procurement layer (Travis Perkins partnership) — the Stage 2 revenue stream
- Financial infrastructure: escrow stage payments, contractor working capital lending, client property finance — Stage 3
- Staff financial products (contractor workforce payroll, pension, insurance)
- **Data product:** Sell benchmark API and reports to QS firms, developers, mortgage lenders, insurers, RICS
- **Regional intelligence:** Real-time construction cost index by trade and region — publishable quarterly
- **Regulatory:** If holding client funds (escrow) → FCA authorisation required. Plan for this early.

---

## Target User — "Dave"

UK SME contractor, £1-3m turnover, 5-8 subcontractors, kitchen extensions / loft conversions / commercial fit-outs.

**Pain points in order:**
1. Doesn't get paid on time — clients dispute, go quiet
2. Signs contracts he doesn't understand — gets hammered
3. Doesn't know if he's making money mid-job — finds out too late
4. Spends 4+ hours pricing jobs he doesn't win
5. Proposals look amateur — Word docs with no branding

Constructa currently solves **4 and 5** brilliantly. **1, 2, and 3** are the next frontier (Sprints 12-17).

**Key metrics that matter:**
- First proposal sent within 10 minutes of signup
- Proposals that result in client acceptance through the platform
- Jobs where billing is managed through Constructa (retention + data flywheel)

---

## Business Model (3 stages)

**Stage 1 (now):** SaaS subscriptions
- Free: 3 proposals/month, watermarked
- Pro £49/month: unlimited, all AI, estimating, Gantt
- Business £99/month: multiple users, custom branding, contract review, service line profiles

**Stage 2:** Merchant procurement layer (Travis Perkins group buying, 2.5% GMV margin + float income)

**Stage 3:** Financial infrastructure (escrow stage payments, contractor working capital lending, client property finance, accountancy software)
