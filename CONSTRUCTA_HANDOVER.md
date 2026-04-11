# Constructa — Full Project Handover Document
**Last updated:** 11 April 2026 — evening session (Sprint 57 polish + schema sweep + independent reviews)
**For:** Any AI coding assistant (Claude Code, ChatGPT Codex, Cursor, etc.) picking up this project

---

## Project Overview

**Constructa** is a SaaS platform for UK SME construction contractors.
- **Live app:** https://constructa-nu.vercel.app
- **GitHub repo:** https://github.com/constructa-co/Constructa (public)
- **Marketing site:** https://www.constructa.co (SEPARATE project — do NOT modify)
- **Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Supabase (PostgreSQL + RLS + Auth + Storage), OpenAI gpt-4o-mini, Vercel CI/CD

---

## Current State at a Glance (11 April 2026 — evening)

**Last sprint completed:** Sprint 57 polish follow-up + schema sweep (commit `2b2b5c8`, deployed to Vercel)
**App status:** Live and functional at https://constructa-nu.vercel.app — all modules operational
**Git:** All code on `main`, clean working tree, Vercel auto-deploys on push
**Test project in DB:** "22 Birchwood Avenue — Kitchen Extension & Loft Conversion" (`projectId: 7b08021a-9ca2-4262-836b-970891608cbe`)
**Supabase:** `pudadynieiuypxeoimnz` — 74 migrations applied, all tables and RLS in place

**What's built (59 sprints):**
- Full pre-construction workflow: AI Brief → BoQ Estimating → Gantt Programme → Contract Review → Proposal PDF
- Full live project workflow: Overview → Billing/AfP → Variations → Job P&L → Change Management → Programme → Communications
- Full project close: Final Accounts → Handover Documents → Lessons Learned
- Cross-project: Pipeline Kanban, Management Accounts, CIS, Business Intelligence, Reporting
- AI throughout: brief chat, estimate line suggestions, contract risk analysis, proposal generation, drawing takeoff, video walkthrough, claims drafting
- Resource catalogues: Staff, Plant, Materials (with live pricing)
- Admin dashboard: 9-tab BI with subscriber management

**STRATEGIC DIRECTION (locked 11 April 2026):** No new functional features.
The owner's instruction is: **test → break → strengthen → streamline**. Feature
breadth is complete. Sprint 58 is a pure hardening sprint (see below).
Independent reviews from Perplexity Computer and Grok both confirmed this is
the right posture; their raw reports are archived at
`docs/reviews/2026-04-11/` for future context.

**Immediately next:**
1. Sprint 58 — Hardening & Robustness (full scope below; P1 items before launch)
2. Sprint 59 — Contract Administration Suite polish (scaffolded, not production-ready)
3. Launch readiness pass with 3-5 real beta contractors

**Do NOT touch:** `src/app/(marketing)/` — that's constructa.co landing page, entirely separate project

---

## Credentials & Infrastructure

> **SECURITY:** All credentials are stored in `.env.local` (not committed) and in Vercel environment variables.
> Never commit real tokens to this repo. Ask the project owner for credentials.

| Service | Detail |
|---------|--------|
| Supabase project ref | `pudadynieiuypxeoimnz` |
| Supabase MCP project_id | `pudadynieiuypxeoimnz` |
| Vercel project ID | `prj_Wh2LiojiueBHFrBgfZlQ6AKYaECb` |
| Vercel team ID | `team_wANaJiVrRNAsnnMMmrCSaOCS` |
| OpenAI | `OPENAI_API_KEY` env var in Vercel (project level) — uses `gpt-4o-mini` |
| Git user email | `perplexity-computer@constructa.co` |
| Git user name | `Perplexity Computer` |

**Always run before committing:**
```bash
git config user.email "perplexity-computer@constructa.co"
git config user.name "Perplexity Computer"
```

**TypeScript check (required before every commit):**
```bash
/usr/local/bin/node node_modules/.bin/tsc --noEmit
```
Node is at `/usr/local/bin/node` — `npx` is not available in the shell.

**Deploy:** Push to `main` → Vercel auto-deploys via GitHub integration.

---

## Architecture

```
src/
  app/
    (marketing)/          ← Landing pages — DO NOT TOUCH
    dashboard/
      page.tsx            ← CRM / Kanban dashboard
      layout.tsx          ← ThemeProvider + DashboardShell
      live/               ← Live Projects Overview (portfolio dashboard)
      projects/
        new/              ← New project wizard
        brief/            ← Step 1: AI-powered project brief
        costs/            ← Step 2: Full BoQ estimating tool
        schedule/         ← Step 3: Programme / Gantt
        contracts/        ← Step 4: T&Cs, risk register, AI contract review
        drawings/         ← Drawing AI Takeoff (Sprint 25)
        proposal/         ← Step 5: Proposal editor + PDF export
        billing/          ← Post-contract: invoicing
        variations/       ← Post-contract: scope changes
        overview/         ← Live project health dashboard (Sprint 27)
          page.tsx         ← Server: RAG status, burn %, programme %, KPIs
          overview-client.tsx      ← Client: KPI cards, ProgrammeBar, invoices, quick actions
        p-and-l/          ← Job P&L dashboard (Sprint 14+)
          page.tsx         ← Server: fetches all data, computes KPIs; splits actual vs committed
          client-pl-dashboard.tsx  ← Client: tabs (Overview/Budget/Costs/Invoices); committed KPI + stacked bar + 7-col section table
          log-cost-sheet.tsx       ← 6-tab cost logging dialog (incl. Subcontract with committed/actual toggle)
          section-forecast-popover.tsx  ← Inline per-section forecast editor (Sprint 28)
          actions.ts               ← Server actions (logCostAction, upsertSectionForecastAction, deleteCostAction, etc.)
          constants.ts             ← COST_TYPES, TRADE_SECTIONS (NOT "use server")
          global-pl-client.tsx     ← Global portfolio P&L view
      settings/
        profile/          ← Company profile, MD message, theme
        case-studies/     ← Case studies management
      library/            ← Cost library browser
      resources/
        staff/            ← Staff resource catalogue (rate buildups)
        plant/            ← Plant resource catalogue (owned plant rates)
  components/
    sidebar-nav.tsx       ← Main left sidebar with accordion sections
    project-navbar.tsx    ← Per-project top tabs
    dashboard-shell.tsx   ← Theme-aware wrapper
  lib/
    ai.ts                 ← OpenAI utility: generateText(), generateJSON<T>()
    theme-context.tsx     ← ThemeProvider + useTheme() hook
    supabase/
      client.ts           ← Browser client (createBrowserClient)
      server.ts           ← Server client (createServerClient)
      admin.ts            ← Service role client (bypasses RLS) — server-only, Sprint 20
  app/
    admin/                ← Platform admin dashboard (Sprint 20)
      layout.tsx          ← Email-based auth guard (ADMIN_EMAIL env var)
      page.tsx            ← Server: fetches all subscriber/usage data via service role
      admin-client.tsx    ← Client: KPI strip, subscriber table, usage stats, platform info
```

---

## Database Schema (all key tables)

```sql
-- Core
profiles          — id (= auth.uid), company_name, logo_url, md_message, md_name,
                    pdf_theme, preferred_trades, capability_statement,
                    financial_year_start_month (INT, default 4 = April)

projects          — id, user_id, name, client_name, site_address, postcode, lat, lng, region
                    project_type, client_type, start_date, potential_value
                    brief_scope, brief_trade_sections, brief_completed
                    proposal_introduction, scope_text, exclusions, clarifications
                    contract_exclusions, contract_clarifications, tc_tier
                    risk_register (JSONB), contract_review_flags (JSONB)
                    programme_phases (JSONB)
                    payment_schedule (JSONB), payment_schedule_type
                    closing_statement, discount_pct, discount_reason
                    selected_case_study_ids (JSONB)
                    uploaded_contract_text, uploaded_contract_url
                    proposal_status TEXT ('draft'|'sent'|'accepted'|'declined')
                    proposal_sent_at TIMESTAMPTZ, proposal_accepted_at TIMESTAMPTZ
                    status TEXT (kanban: 'lead'|'estimating'|'proposal_sent'|'active'|'completed'|'lost')
                    current_version_number INT NOT NULL DEFAULT 1  ← Sprint 22

-- Proposal Versioning (Sprint 22)
proposal_versions — id, project_id, version_number INT, notes TEXT, snapshot JSONB,
                    created_at TIMESTAMPTZ, created_by UUID
                    UNIQUE (project_id, version_number)
                    RLS: users can SELECT/INSERT for their own projects; no UPDATE/DELETE (immutable)

-- Estimating
estimates         — id, project_id, is_active, overhead_pct, profit_pct, risk_pct,
                    prelims_pct, discount_pct, total_cost
                    is_client_boq BOOLEAN DEFAULT false  ← Sprint 26a
                    client_boq_filename TEXT              ← Sprint 26a (original filename)

estimate_lines    — id, estimate_id, project_id, trade_section, description,
                    qty, unit, unit_rate, line_total, pricing_mode ('simple'|'buildup')
                    client_ref TEXT  ← Sprint 26a (client's item reference, e.g. "2.1.3")

estimate_line_components — id, estimate_line_id, component_type ('labour'|'plant'|'material'
                           |'consumable'|'temp_works'|'subcontract')
                           qty, unit, unit_rate, manhours_per_unit, total_manhours

-- Resources (Company Catalogue)
staff_resources   — id, user_id, name, job_title, role, is_active
                    rate_mode ('simple'|'full')
                    -- Simple mode:
                    hourly_chargeout_rate, overtime_chargeout_rate
                    -- Full buildup mode:
                    annual_salary, employer_ni_pct, employer_pension_pct
                    company_car_annual, car_allowance_annual, mobile_phone_annual
                    it_costs_annual, life_insurance_annual, other_benefits_annual
                    annual_working_days, holiday_days, public_holiday_days
                    overhead_absorption_pct, profit_uplift_pct

plant_resources   — id, user_id, name, category, is_active
                    category: 'heavy_plant'|'light_plant'|'lifting'|'temp_works'
                              |'light_tools'|'specialist_tools'|'other'
                    rate_mode ('simple'|'full')
                    -- Simple mode:
                    daily_chargeout_rate
                    -- Full buildup mode:
                    purchase_price, depreciation_years, residual_value
                    finance_cost_annual, maintenance_annual, insurance_annual
                    other_annual_costs, utilisation_months, working_days_per_month
                    profit_uplift_pct

-- Live Project Financials
project_expenses  — id, project_id, description, supplier, amount, expense_date
                    cost_type ('labour'|'materials'|'plant'|'subcontract'|'overhead'|'prelims'|'other')
                    trade_section TEXT
                    estimate_line_id UUID FK → estimate_lines(id) ON DELETE SET NULL
                    receipt_url TEXT  ← Supabase Storage public URL
                    cost_status TEXT DEFAULT 'actual' CHECK IN ('actual','committed')  ← Sprint 28

project_section_forecasts  — id UUID PK, project_id UUID FK → projects(id) ON DELETE CASCADE
                             trade_section TEXT NOT NULL, forecast_cost NUMERIC, updated_at TIMESTAMPTZ
                             UNIQUE (project_id, trade_section)  ← Sprint 28; user-editable override

invoices          — id, project_id, invoice_number, type ('Interim'|'Final'),
                    amount, status ('Draft'|'Sent'|'Paid'), created_at

invoices          — id, project_id, invoice_number, invoice_date, type, amount, status,
                    due_date, paid_date, retention_pct, gross_valuation, previous_cert,
                    retention_held, net_due, is_retention_release BOOL, period_number INT
                    (Sprint 29: AfP accounting columns added)

payment_schedule_milestones — id, project_id, user_id, title, due_date, amount,
                    status ('Pending'|'Due'|'Paid'), notes  ← Sprint 29

variations        — id, project_id, title, description, amount,
                    status ('Draft'|'Pending Approval'|'Approved'|'Rejected'),
                    variation_number TEXT (e.g. VAR-001), instruction_type, trade_section,
                    instructed_by, date_instructed, approval_date, approval_reference,
                    rejection_reason  ← Sprint 30 additions

-- Live Projects: Communications (Sprint 32)
site_instructions — id, project_id, user_id, reference (SI-001), title, description,
                    instruction_type, issued_to, date_issued, status, notes
rfis              — id, project_id, user_id, reference (RFI-001), question, addressee,
                    date_sent, date_due, date_responded, response_summary, status
early_warning_notices — id, project_id, user_id, reference (EWN-001), title, description,
                    ewn_type, potential_cost_impact, potential_time_impact_days,
                    date_issued, status, notes
document_register — id, project_id, user_id, reference (DOC-001), title, document_type,
                    direction ('sent'|'received'), date, from_party, to_party, notes

-- Live Projects: Change Management (Sprint 34)
change_events     — id, project_id, user_id, reference (CE-001), title, description,
                    type (Compensation Event|EOT|Contract Notice|Loss & Expense|etc.),
                    status (Draft|Notified|Submitted|Assessed|Agreed|Rejected|Withdrawn),
                    issued_by, clause_reference, value_claimed, value_agreed,
                    time_claimed_days, time_agreed_days,
                    date_notified, date_submitted, date_assessed, date_agreed, notes

-- Closed Projects: Final Accounts (Sprint 33)
final_accounts    — id, project_id UNIQUE, user_id, status (Draft|Agreed|Disputed|Signed),
                    agreed_amount, disputed_amount, dispute_notes,
                    agreed_date, signed_date, agreement_reference, notes
final_account_adjustments — id, project_id, user_id, description, type (Addition|Deduction),
                    amount, notes, order_index

-- Closed Projects: Handover Documents (Sprint 35)
handover_items    — id, project_id, user_id, category, title, description,
                    status (Pending|Received|Issued|N/A), required BOOL,
                    date_received, issued_to, notes, order_index
                    NOTE: 16 standard items auto-seeded on first open per project

-- Closed Projects: Lessons Learned (Sprint 36)
lessons_learned   — id, project_id UNIQUE, user_id, overall_rating INT(1-5),
                    client_satisfaction INT(1-5), financial_outcome, programme_outcome,
                    summary, ai_narrative
lesson_items      — id, project_id, user_id, type (Went Well|Improvement|Risk|Opportunity),
                    category, title, detail, impact (Low|Medium|High),
                    action_required BOOL, action_owner, order_index

-- Drawing AI Takeoff (Sprint 25)
drawing_extractions — id, project_id, user_id, filename, file_size_kb INT, format TEXT,
                      page_count INT, pages_processed INT,
                      extracted_items JSONB (array of DrawingResultItem),
                      raw_ai_response TEXT,
                      status TEXT ('processing'|'processed'|'error'),
                      error_message TEXT, created_at TIMESTAMPTZ
                      NOTE: Files are NEVER stored — only metadata + AI results saved.
                      PDFs are rendered to JPEG in-browser via pdfjs-dist, sent to GPT-4o Vision.

-- Library
cost_library_items — code, description, unit, base_rate, category, is_system_default
labour_rates       — trade, role, day_rate, region, is_system_default
rate_buildups      — saved first-principles rate build-ups
```

**Supabase Storage buckets:**
- `receipts` — public bucket for cost entry attachments (delivery tickets, invoices, photos)
  - Policy: authenticated users can upload; public can view; authenticated users can delete own

---

## Critical Architectural Rules

1. **`"use server"` files can ONLY export async functions** — never export constants from them. Constants like `COST_TYPES` and `TRADE_SECTIONS` live in `constants.ts` (no directive) and are imported separately by client components. Violating this causes a 500 on every server action POST.

2. **`revalidatePath` is NOT used in estimating actions** — breaks optimistic UI state in the BoQ editor.

3. **PDF margins are NEVER shown to client** — overhead/profit/risk are baked into all-in rates. The PDF shows only section totals and grand total.

4. **RLS on all tables** — new tables need RLS enabled + policy using `auth.uid() = user_id` or via projects join.

5. **Supabase migrations** — always create a new `.sql` file in `supabase/migrations/` with format `YYYYMMDDHHMMSS_description.sql`. Apply via Supabase MCP `apply_migration` tool.

6. **TypeScript must be 0 errors** — run `/usr/local/bin/node node_modules/.bin/tsc --noEmit` before every commit.

7. **NEVER modify `src/app/(marketing)/`** — that's the constructa.co landing page, separate project.

8. **Use `gpt-4o-mini` only** for all AI calls.

9. **`projects` table — confirmed non-existent columns (DO NOT SELECT):**
   - `updated_at` — does NOT exist; use `created_at` for ordering
   - `end_date` — does NOT exist
   - `timeline_phases` — does NOT exist; use `programme_phases` (JSONB)
   Selecting any of these causes the entire Supabase query to return `null` silently (no error, just null data).

---

## Workflow: How the product works

A contractor creates a project and works through 5 pre-construction tabs:

```
1. BRIEF       → Describe project via AI chat → scope auto-populated → AI suggests estimate lines
2. ESTIMATING  → Full BoQ: trade sections, line items, rate build-up (L+P+M+C per item)
                 Cost hierarchy: Direct Cost → Prelims(10%) → Overhead(10%) → Risk(5%) → Profit(15%)
3. PROGRAMME   → Auto-generates Gantt from estimate manhours → contractor adjusts → saves
4. CONTRACTS   → Select T&C tier → AI risk register → upload client contract → AI review
5. PROPOSAL    → Pulls everything together → generates branded PDF
```

Then post-contract (Live Projects):
```
6. OVERVIEW        → Per-project health dashboard (RAG, burn %, programme %)
7. BILLING         → AfP accounting, retention ledger, aged debt
8. VARIATIONS      → VAR-001 numbering, approval workflow, PDF instruction
9. JOB P&L         → Real-time financial position, committed costs, section forecasts
10. CHANGE MGMT    → CE-001 register, EOT / Contract Notice / Loss & Expense
11. PROGRAMME      → As-built vs baseline Gantt, delay reasons, revised planned finish
12. COMMS          → Site Instructions, RFIs, EWNs, Document Register
```

Then project close (Closed Projects):
```
13. FINAL ACCOUNT   → Financial settlement statement, status machine, PDF for signature
14. HANDOVER DOCS   → 16-item checklist (O&Ms, warranties, as-builts, certs), progress %
15. LESSONS LEARNED → Star ratings, structured lessons, AI narrative
```

Cross-project dashboard:
```
16. HOME DASHBOARD  → `/dashboard/home` — executive ops view; KPI cards; alert banners;
                       active projects table with inline module-linked chips; financial snapshot
```

---

## Job P&L Dashboard — Key Details

**URL:** `/dashboard/projects/p-and-l?projectId=XXX` (per project) or `/dashboard/projects/p-and-l` (global)

**Cost Logging (LogCostSheet):**
- 5 tabs: Labour / Plant — Owned / Plant — Hired / Materials / Overhead
- Labour: select from staff catalogue OR manual entry; time in hours/half-days/days; calculates from chargeout rate
- Plant Owned: select from plant catalogue OR manual; days × daily chargeout rate
- Plant Hired: supplier, daily/weekly/monthly rate, delivery/collection charges
- Materials: qty × unit rate + optional delivery; units: m2/m3/m/nr/tonne/kg/bag/sheet/length/item
- Overhead: fixed amount OR % of costs to date
- ALL tabs: WBS picker (from estimate lines), date, notes, receipt upload
- Receipt upload: dashed drop-zone → uploads to Supabase Storage `receipts` bucket → shows thumbnail/PDF icon → paperclip icon in cost table

**WBS Picker modes:**
- `"section"` — for Labour/Overhead (spans multiple activities) — shows trade sections from estimate
- `"line"` — for Plant/Materials — shows section then optional specific estimate line item
- Falls back to `TRADE_SECTIONS` constants if project has no estimate

**Rate calculations:**
- Staff simple mode: `hourly_chargeout_rate × 8 = daily`
- Staff full mode: `(salary + NI + pension + benefits) / working_days × (1 + overhead%) × (1 + profit%)`
- Plant simple mode: `daily_chargeout_rate` directly
- Plant full mode: `(depreciation + running_costs) / utilisation_days × (1 + profit%)`
- Labour hours: `hourlyRate × qty`; half-days: `dailyRate × 0.5 × qty`; days: `dailyRate × qty`

**Global P&L:** Aggregates all projects; monthly period data; per-project margin table; FY toggle (uses `profiles.financial_year_start_month`).

---

## Resource Catalogues — Key Details

**Staff Resources** (`/dashboard/resources/staff`):
- Rate modes: Simple (hourly chargeout direct) vs Full Buildup (salary → employer costs → overhead → profit)
- Job title autocomplete: 60+ UK construction titles via `<datalist>`
- Table shows: Hourly / Daily / Annual chargeout for both modes
- Numeric inputs: `onFocus → select all` so zero can be overwritten immediately

**Plant Resources** (`/dashboard/resources/plant`):
- Rate modes: Simple (daily chargeout direct) vs Full Buildup (depreciation model)
- Categories: Heavy Plant / Light Plant / Lifting Equipment / Temporary Works / Light Tools / Specialist Tools / Other
- Name autocomplete: 70+ UK plant items via `<datalist>`
- Table shows: Mode badge / Half Day / Daily / Weekly chargeout

---

## Sidebar Navigation (current state — Sprint 59)

```
OVERVIEW (always visible)
  Overview          /dashboard/home
  On-site Hub       /dashboard/mobile          ← Sprint 49 (PWA quick-action hub)

COMPANY PROFILE (accordion)
  Profile           /dashboard/settings/profile
  Case Studies      /dashboard/settings/case-studies
  Integrations      /dashboard/settings/integrations  ← Sprint 44 (Xero)
  API Keys          /dashboard/settings/api-keys      ← Sprint 48
  Labour Rates      /dashboard/resources/staff
  Plant Rates       /dashboard/resources/plant
  Cost Library      /dashboard/library
  Material Rates    /dashboard/resources/material-rates  ← Sprint 50
  Setup Wizard      /onboarding?force=true

WORK WINNING (accordion)
  Pipeline          /dashboard  (Kanban: Lead/Estimating/Proposal Sent/Active/Completed/Lost)
  New Project       /dashboard/projects/new

PRE-CONSTRUCTION (accordion, auto-expands on project select)
  Briefs            /dashboard/projects/brief?projectId=X
  Estimates         /dashboard/projects/costs?projectId=X
  Programmes        /dashboard/projects/schedule?projectId=X
  Contracts         /dashboard/projects/contracts?projectId=X
  Proposals         /dashboard/projects/proposal?projectId=X

LIVE PROJECTS (accordion)
  Project Overview    /dashboard/projects/overview?projectId=X
  Billing & Invoicing /dashboard/projects/billing?projectId=X
  Variations          /dashboard/projects/variations?projectId=X
  Job P&L             /dashboard/projects/p-and-l?projectId=X
  Change Management   /dashboard/projects/change-management?projectId=X
  Programme           /dashboard/projects/programme?projectId=X
  Communications      /dashboard/projects/communications?projectId=X
  Contract Admin      /dashboard/projects/contract-admin?projectId=X  ← Sprint 59

CLOSED PROJECTS (accordion)
  Archive             /dashboard/projects/archive
  Final Accounts      /dashboard/projects/final-account?projectId=X
  Handover Documents  /dashboard/projects/handover-documents?projectId=X
  Lessons Learned     /dashboard/projects/lessons-learned?projectId=X

RESOURCES (always visible)
  Resource Portfolio  /dashboard/resources/portfolio  ← Sprint 51

REPORTING (always visible, no accordion)
  Reports & Photos     /dashboard/reporting             ← Sprint 58
  Management Accounts  /dashboard/management-accounts  ← Sprint 40
  CIS Compliance       /dashboard/cis                  ← Sprint 41
  Business Intelligence /dashboard/intelligence        ← Sprint 48
```

Sidebar state is persisted in `localStorage`. Active project is stored in `localStorage` and auto-appended to all module links. True accordion behaviour: opening any section closes all others.

---

## Kanban Pipeline (Dashboard)

Stages: **Lead → Estimating → Proposal Sent → Active → Completed / Lost**

Actions per stage:
- Lead: "Start Estimating" (blue) + Mark as Lost
- Estimating: "Proposal Sent →" (purple) + Pull Back + Mark as Lost
- Proposal Sent: "Mark as Won" (emerald) + Pull Back + Mark as Lost
- Active: "Mark Complete" (zinc) + P&L link
- Completed/Lost: "Reopen"

All moves use optimistic state updates for instant visual feedback.

---

## Theme System

- `src/lib/theme-context.tsx` — `ThemeProvider` + `useTheme()` hook
- `"system-c"` (default): dark sidebar `#0d0d0d`, white content
- `"dark"`: full dark mode using `#0d0d0d / #1a1a1a / #2a2a2a`

**PDF brand themes** (stored in `profiles.pdf_theme`):
- `"slate"`: charcoal/white (default)
- `"navy"`: deep navy/gold
- `"forest"`: forest green/cream

---

## AI Integration

All AI calls go through `src/lib/ai.ts`:
```typescript
generateText(prompt: string): Promise<string>
generateJSON<T>(prompt: string, fallback: T): Promise<T>
```
Model: `gpt-4o-mini` via `OPENAI_API_KEY` env var. `maxDuration = 60` on AI-heavy pages.

AI features currently built:
- Brief AI chat assistant (populates project fields from natural language)
- Scope bullet extraction
- AI line item suggestions from brief → creates estimate lines
- Introduction / scope / clarifications / exclusions AI rewrite
- Contract risk analysis (upload T&Cs → AI flags clauses Red/Amber/Green)
- Contract chatbot (risk awareness)
- Risk & opportunities register generation
- Closing statement generation
- Case study AI enhancement
- MD message AI rewrite
- Proposal full generation
- Drawing AI Takeoff: upload PDF/image drawing → pdfjs renders to JPEG pages → GPT-4o Vision multi-image analysis → extract quantities by trade section → match to cost library → add to estimate (Sprint 25)
- Client BoQ Import: upload Excel (SheetJS rows → AI column detection) or PDF (pdfjs → GPT-4o Vision) → parse client's exact sections + item refs → create estimate → export priced Excel back to client (Sprint 26a)

---

## Estimating Tool — Key Details

**Cost library:** 833 items across 60 trades in `cost_library_items`
**Labour rates:** 260 roles across 60 trades in `labour_rates`
**Plant rates:** 156 items in `cost_library_items` where `category = 'Plant'`

**Rate build-up:** Each estimate line can be in `'simple'` (single rate) or `'buildup'` mode.
Build-up components in `estimate_line_components`:
- `component_type`: labour | plant | material | consumable | temp_works | subcontract
- Rate conversion: day↔week (×5), day↔hr (×8)
- `total_manhours` feeds Programme tab auto-generation

**Margin hierarchy:**
```
Direct Cost (trade lines)
+ Prelims (% of direct, or explicit prelims lines)
= Total Budget Cost
+ Overhead (% of budget)
+ Risk (% of budget + overhead)
+ Profit (% of budget + overhead + risk)
- Discount
= Contract Value (shown to client)
```

---

## PDF Structure (Proposal)

1. Cover page
2. About Us (company profile, MD message)
3. Case studies (selected, full page each)
4. Project Brief & Scope (two-column: intro + overview left, scope bullets right)
5. Fee Proposal (section totals, margins hidden, TOTAL INC. VAT primary, payment schedule)
6. Project Timeline (Gantt from `project.programme_phases`)
7. Commercial Terms (exclusions + clarifications left, T&Cs right)
8. Risk & Opportunities (if any in risk_register)
9. Why Choose Us (reasons box + closing statement + discount callout if applicable)
10. Acceptance / signature page

**Key PDF rules:**
- Margins (overhead/risk/profit) are NEVER shown — all-in rates only
- `computeEstimateContractSum(est)` is the canonical contract value function (see `client-editor.tsx`)
- Cover shows CONTRACT VALUE inc. VAT (= contractSum × 1.2)
- `profile.pdf_theme` controls colour scheme ('slate'|'navy'|'forest')
- Closing statement is inside Why Choose Us section (NOT a separate page) — critical: it was previously creating a near-blank page when T&Cs overflowed

---

## Sprint History

| Sprint | What was built |
|--------|---------------|
| 1–10 | Estimating engine, BoQ editor, rate buildups, cost library, brief AI, programme/Gantt, T&Cs, project wizard, onboarding, proposal editor, case studies, AI wizard, billing module, variations module, Vision Takeoff |
| 11 | project_expenses table, basic cost logging |
| 12 | Client Portal — shareable proposal URL, in-browser render, digital acceptance, Resend email, viewed tracking |
| 13 | Contract Shield — AI contract review (R/A/G), plain English explanations, chatbot, contractor response PDF, 4th T&C tier |
| 14 | Job P&L Dashboard — KPI strip, budget vs actual by section + drill-down, 5-tab LogCostSheet, invoice tracker; Global P&L; Live Projects Overview; Kanban pipeline + optimistic updates; sidebar accordion; financial year month on profiles |
| 15 | Resource Catalogues — Staff (simple/full rate modes, job title + 60-item autocomplete, full cost buildup, hourly/daily/annual table); Plant (simple/full rate modes, 6 new categories, depreciation model, 70-item name autocomplete, chargeout table); numeric input select-all UX; fix simple-rate staff £0 bug |
| 16 | Cost Capture Enhancements — WBS-based cost logging (estimate lines picker, section and line modes); Labour time units (hours/half-days/days); Receipt/document upload (Supabase Storage `receipts` bucket, thumbnail + PDF icon, paperclip in table); Fix critical "use server" 500 bug; DB: estimate_line_id FK + receipt_url + all resource columns live |
| 17 | UI/UX Dark Theme Consistency Pass — Brief page hero + dark inputs + chat bubbles; Project navbar dark tabs; Programme dark Gantt card; Estimating dark inputs/cards/summary; Variations + Billing dark theme + KPI strips; New Project wizard dark; Onboarding dark (all 4 steps); Onboarding layout fix (was rendering marketing header); correct ProjectNavBar activeTab on Variations/Billing |
| 18 | Pre-Construction Workflow Polish — Fix Gantt bar width (manualDays/calculatedDays) and position (startOffset days→weeks); Fix Preliminaries PDF to render per-line not lump-sum; Add T&C clauses 10-12 (Materials, Practical Completion, Confidentiality); Fix Why Choose Us specialism splitting + project-type bullet + fallbacks; Add PDF error toast; Fix contract value default to use estimate total; New `getProposalLinkAction` (copy link no longer sets status=sent); Fix start date AI extraction in Brief; Fix rate/unit uncontrolled inputs with key prop; Fix Cost Summary z-index (z-20 + solid bg); Remove duplicate Estimating header; Auto-scaffold BoQ from Brief trade selection; Drawing upload callout on Brief page; Expand TRADE_SECTIONS 15→22; Expand AI trades prompt to 47 exact-match names; Fix chip shift-bug with disabled guard; Fix public proposal totalWeeks calculation |
| 19 | Gantt Drag-and-Drop & Programme Polish — Drag bars to reposition (snaps to calendar week); Drag right edge to resize (snaps to working-week increments); Dependency arrows: "Starts After" select per phase → SVG amber bezier curves, auto-snaps successor to predecessor end; Critical path: yellow ring on phases ending in final week; Working week selector (4/5/6/7d, default 5, persisted localStorage); Monday-anchored start dates: date input snaps forward to Monday, week headers always show WC Mon dates; 4-card summary strip; Auto-sequence button; `updatePhasesAction` saves `start_date` to project and revalidates proposal paths; `calculatedDays`/`manualDays` = working days; `startOffset` = calendar days |
| 20 | Admin Dashboard Phase 1 — `/admin` route (ADMIN_EMAIL guard); service role client; subscriber list with active/inactive status; Revenue KPIs (MRR/ARR at £49/mo); platform-wide usage stats; sidebar amber admin link for admin user only |
| 21 | Comprehensive BI Admin Dashboard — 9-tab investor-grade dashboard; MRR waterfall; cohort retention; DAU/WAU/MAU; Rule of 40; LTV/ARPU/churn; OpenAI cost integration; Plausible analytics integration; manual P&L cost entry; feature adoption heatmap; geography by country/region; automated report generator (daily/weekly/monthly/quarterly/annual); pure CSS charts (no external library) |
| 22 | Proposal Versioning — `proposal_versions` table (JSONB snapshot, version number, notes, immutable); `current_version_number` on projects; `createProposalVersionAction`, `getProposalVersionsAction`, `restoreProposalVersionAction`; `VersionHistoryPanel` (collapsible sidebar, amber badge, two-step restore); version badge in status row; "Save Version" button with notes dialog |
| 23 | Onboarding Polish + Email Notifications — `sendContractorViewedNotification` (fires on status sent→viewed, admin client email lookup, fire-and-forget); `sendWelcomeEmail` (fires on first onboarding completion); onboarding header "Welcome to Constructa"; Skip buttons on steps 3 & 4; dashboard empty-state getting-started checklist card with 4-step progress |
| 24 | SKIPPED — LemonSqueezy Billing deferred to later sprint |
| 26 | Video Walkthrough AI — upload site survey video (MP4/MOV/WebM, 200MB, 2min); extract 20 frames in-browser via HTML5 canvas; extract + resample audio via Web Audio API; transcribe narration via Whisper-1; combined GPT-4o Vision call (narration = primary, frames = context); returns scope/trades/value/observations; "Apply to Brief" populates all fields; full workflow: video → brief → estimate → programme in under 1 minute |
| 26a | Client BoQ Import — upload client-provided BoQ (Excel or PDF) in Estimating tab; AI parses via GPT-4o Vision (PDF) or SheetJS+AI (Excel); preserves client's sections, item refs, descriptions; creates estimate flagged `is_client_boq`; preview grouped by section with amber qty warning; export priced BoQ to Excel (Priced_filename.xlsx) with cost summary appended |
| 26a bugs | **Post-import bug fixes:** (1) BoQ tab reverting on navigation — root cause: `router.push` is soft nav, useState init doesn't re-run; fixed via `window.location.href` with `?tab=<id>` URL param + project-scoped sessionStorage key `constructa_tab_<projectId>`; (2) Programme pulling wrong estimate — root cause: BoQ import set `is_active: false` AND programme filtered out `is_client_boq` estimates; fixed: `createBoQEstimateAction` auto-sets imported BoQ as active; programme logic now uses `is_active` only; existing production data fixed via Supabase MCP SQL |
| 27 | Live Projects: Overview — per-project health dashboard; RAG status; 4-card KPI strip; burn bar; ProgrammeBar mini-Gantt; outstanding invoices list; 4 quick-action buttons |
| 28 | Live Projects: Cost Tracking — committed costs, section forecasts, stacked burn bar, 7-col section table, SectionForecastPopover, Subcontract tab |
| 29 | Live Projects: Billing & Valuations — AfP accounting (gross→less prev cert→less retention→net due); retention ledger; aged debt bands (current/1-30/31-60/61-90/90+); payment milestones; DB: due_date, paid_date, retention_pct, gross_valuation, previous_cert, retention_held, net_due, is_retention_release, period_number on invoices |
| 30 | Live Projects: Variations — VAR-001 auto-numbering; 7 instruction types; Draft→Pending→Approved/Rejected workflow; approval reference capture; PDF variation instruction; negative amounts as (£x) for omissions |
| 31 | Live Projects: Programme Live Tracking — pct_complete + actual_start/finish on Phase interface; % overlay on Gantt bars; LiveTrackingPanel with per-phase sliders + dates; AI weekly update narrative via GPT-4o stored in programme_updates table |
| 32 | Live Projects: Communications — 4 tables (site_instructions, rfis, early_warning_notices, document_register) with auto-numbered refs; SI + EWN PDF export; RFI respond dialog; document direction badges; EWN £/time exposure footer |
| 33 | Closed Projects: Final Accounts — financial settlement (originalContractSum + variations + adjustments = adjustedContractSum); status machine (Draft/Agreed/Disputed/Signed); adjustment CRUD; variations schedule; certification history; PDF with signature block |
| 34 | Live Projects: Change Management — CE-001 register; 8 event types; status workflow (Draft→Notified→Submitted→Assessed→Agreed/Rejected/Withdrawn); financial + time impact tracking (claimed vs agreed); expandable row detail |
| 35 | Closed Projects: Handover Documents — 16 standard items auto-seeded (O&M manuals, warranties, as-builts, test certs, H&S file, compliance certs); progress bar; click-to-cycle status badges; grouped by category |
| 36 | Closed Projects: Lessons Learned — star ratings (overall + client satisfaction); financial/programme outcome selectors; structured lesson items (Went Well/Improvement/Risk/Opportunity) with impact + action tracking; AI narrative via GPT-4o |
| 37 | Live Programme: As-Built vs Baseline Gantt — dual-bar Gantt (baseline grey + actual coloured); today line; revised planned finish (dashed amber); delay calculation per phase (forecast from progress rate); delay reason (9 categories); total programme delay summary; delay panel listing all delayed phases. Fields stored in programme_phases JSONB (no migration needed) |
| 38 | Dashboard Home Rebuild — cross-project ops dashboard at `/dashboard/home`; 8 parallel DB fetches; 8 KPI cards (active projects, outstanding, overdue, retention, open RFIs, pending variations, CE exposure, total programme delay); 5 conditional alert banners; active projects table with inline module-linked alert chips; financial snapshot panel; 7 quick-action links |
| 25 | Drawing AI Takeoff — `drawing_extractions` DB table; `analyzeDrawingPagesAction` (in-browser PDF→JPEG via pdfjs-dist, multi-image GPT-4o Vision, cost library matching); `getDrawingExtractionsAction`; `addItemsToEstimateAction`; `/drawings` page with drag-drop upload, live progress, extraction results panel with checkboxes + trade section grouping, drawing register; Drawings tab added to project navbar; files never stored in Supabase (process-only architecture) |

> ⚠️ **Sprint numbering note (5 April 2026):** Sprints 15 and 16 above are NEW sprints inserted between the original Sprint 14 (P&L) and the originally planned Sprint 15 (UI/UX Consistency Pass). All downstream sprints shift +2. Original roadmap end: Sprint 41. Corrected total: **Sprint 46** (further updated 6 April 2026: Sprints 23–24 added for Onboarding Polish and LemonSqueezy Billing, shifting all subsequent sprints +2).

---

## Sprint Backlog — Complete Roadmap (Sprints 15–46)

### ✅ Sprint 17 — UI/UX Dark Theme Consistency Pass (COMPLETE — 5 April 2026)
Applied Contract Shield / Job P&L dark-theme standard to all lagging pages:
- Brief page: hero block, dark inputs, dark chat bubbles, loading spinner text
- Project navbar: dark tab styling (`border-blue-500` active, `border-slate-700/50` base)
- Estimating: dark inputs/selects/cards/summary strip
- Programme: dark Gantt card, week headers, phase row inputs
- Variations + Billing: hero blocks, KPI strips, dark dialogs, correct `activeTab`
- New Project wizard: removed `bg-white`, dark step indicators + cards
- Onboarding: dark all 4 steps; new `layout.tsx` fixes marketing header appearing on `/onboarding`

### ✅ Sprint 18 — Pre-Construction Workflow Polish (COMPLETE — 5 April 2026)
All 15 backlog items delivered. Commit `6c9dd42`, deployed `dpl_5mEsArgjbxW3DnNMPmh1S9q33w1e` (READY).
- **Gantt fixed:** bars now correct width (`manualDays ?? calculatedDays`) and position (`startOffset / 7` days→weeks)
- **Prelims PDF:** renders individual line items, not a single lump-sum row
- **T&Cs:** clauses 10–12 added (Materials & Ownership, Practical Completion, Confidentiality)
- **Why Choose Us:** specialism splitting fixed, project-type bullet, fallback content when profile sparse
- **PDF error toast:** `try/catch` + `toast.error()` — failures now visible
- **Contract value:** defaults to estimate total when estimate exists (`useState(estimatedTotal > 0)`)
- **Copy Link:** new `getProposalLinkAction` — no longer sets `proposal_status = "sent"` on copy
- **Start date AI:** `processBriefChatAction` extracts start date → auto-fills the date field
- **Rate/unit inputs:** `key={line.unit_rate}` / `key={line.unit}` — uncontrolled inputs now update on library selection
- **Cost Summary z-index:** `z-20` + `bg-slate-900` — no longer overlapped by section content
- **Estimating header:** removed legacy duplicate project selector
- **Auto-scaffold BoQ:** `saveBriefAction` inserts placeholder estimate lines from brief trade selection
- **Drawing callout:** purple dashed link on Brief page → Estimating (Vision Takeoff promo)
- **TRADE_SECTIONS:** expanded 15 → 22 in estimate-client; chip click guarded with `disabled` prop
- **AI trades prompt:** updated to 47 exact-match names from `ALL_TRADES`
- **Public proposal:** `totalWeeks` now reads `manualDays ?? calculatedDays`; `programme_phases` added to select

### ✅ Sprint 19 — Gantt Drag-and-Drop & Programme Polish (COMPLETE — 5 April 2026)
Commits `abd72e3`, `4c91891`, `22a4b8e`.
- **Drag-to-move:** drag bar body → `startOffset` updates live, snaps to 7-day calendar week
- **Drag-to-resize:** right-edge grip handle → `manualDays` updates, snaps to 1 working-week
- **Dependencies:** "Starts After" select → `dependsOn[]` stored in JSONB; SVG bezier arrows (amber, dashed); setting dependency auto-snaps successor to predecessor end
- **Critical path:** phases ending in final week highlighted with yellow ring + ★
- **Working week selector:** 4d/5d/6d/7d (default 5); `toCalendarDays(workingDays, daysPerWeek)` converts at render; persisted in `localStorage`
- **Monday start dates:** `snapToMonday()` on any date input; week headers always show WC Mon date; saved to `projects.start_date` on "Save to Proposal"
- **Data model:** `calculatedDays`/`manualDays` = working days; `startOffset` = calendar days (multiples of 7)

### ✅ Sprint 20 — Constructa Admin Dashboard Phase 1 (COMPLETE — 6 April 2026)
Commit `ae36de8`.
- **`/admin` route:** protected — middleware redirects unauthenticated users to `/login`; layout checks `user.email === ADMIN_EMAIL` env var (server-side), non-admins redirected to `/dashboard`
- **Service role client:** `src/lib/supabase/admin.ts` — bypasses RLS, requires `SUPABASE_SERVICE_ROLE_KEY` env var (`.env.local` + Vercel), server-only
- **Subscriber list:** fetches all profiles + auth user emails (via `supabase.auth.admin.listUsers`), joins with projects/estimates/contracts data; sortable/searchable table; Active/Inactive status badge (30-day activity)
- **Revenue KPIs:** Total Subscribers, Active (30d), MRR (subscribers × £49/mo), ARR (MRR × 12) — `PLAN_PRICE_GBP` constant in `admin-client.tsx` to update when billing goes live
- **Usage stats:** total projects, estimates, proposals sent, contracts reviewed — platform-wide aggregates
- **Platform info panel:** Supabase project ref, region, hosting, AI model, link to Supabase dashboard
- **Sidebar link:** `isAdmin` prop threaded through `dashboard/layout.tsx` → `DashboardShell` → `SidebarNav` — amber "⚡ Admin Dashboard" button shown only when email matches `ADMIN_EMAIL`
- **Required env vars:** `ADMIN_EMAIL` + `SUPABASE_SERVICE_ROLE_KEY` (add to `.env.local` AND Vercel)

### ✅ Sprint 21 — Comprehensive BI Admin Dashboard (COMPLETE — 6 April 2026)
Commit `182457f`. DB migration `sprint21_admin_bi_foundation`.
- **9-tab admin dashboard** at `/admin`: Overview · Revenue & P&L · Growth · Retention · Engagement · Geography · Costs · Website · Reports
- **Investor-grade SaaS metrics**: Rule of 40, MRR waterfall, ARR trajectory, cohort retention grid, LTV, ARPU, churn rate, DAU/WAU/MAU, stickiness, activation rate, burn multiple (TBD), LTV:CAC (TBD)
- **Automated reports**: Daily/Weekly/Monthly/Quarterly/Annual report text generator; print-to-PDF; email via Resend
- **OpenAI cost integration**: usage API → daily spend chart, MTD cost, cost per user (in Costs tab)
- **Plausible website analytics**: visitors, pageviews, bounce rate, top pages, traffic sources, conversion rate (requires `PLAUSIBLE_API_KEY`)
- **P&L engine**: revenue − COGS (OpenAI + manual infrastructure) = gross profit; EBITDA; runway; cost per user
- **Manual cost entry**: form in Costs tab writes to `admin_costs` table (service role only)
- **Feature adoption heatmap**: % of users who used each of 8 features
- **Geography**: UK regions from `projects.region`; user countries from `profiles.country`
- **Country capture**: middleware reads `x-vercel-ip-country` Vercel Edge header, updates `profiles.country` once per user
- **DB additions**: `profiles.country`, `profiles.signup_source`, `admin_costs` table
- **Pure CSS charts**: BarChart, SparkLine, KpiCard, CohortGrid — no external library
- **PLAN_PRICE_GBP = 49** in `types.ts` — single constant to update when Stripe billing goes live

### ✅ Sprint 22 — Proposal Versioning (COMPLETE — 6 April 2026)
Commit `f755696`, deployed `dpl_7rd6jqcP5mC6ge4ed9yMh4TqYWic` (READY).
- **DB migration** `sprint22_proposal_versions`: `proposal_versions` table (id, project_id, version_number, notes, snapshot JSONB, created_at, created_by); `projects.current_version_number INT DEFAULT 1`; RLS — SELECT/INSERT for own projects, no UPDATE/DELETE (immutable history)
- **Server actions** in `proposal/actions.ts`: `createProposalVersionAction` (snapshots 20 fields → JSONB, bumps version number); `getProposalVersionsAction` (newest-first list); `restoreProposalVersionAction` (writes snapshot back to project row)
- **`VersionHistoryPanel`** component: collapsible sidebar accordion, version count badge, amber current-version pill, formatted date + notes per row, two-step "Restore → Confirm?" flow, reload on restore
- **`ClientEditor` changes**: version badge (amber `vN` pill) in status row; "Save Version (vN+1)" amber button; modal dialog with optional notes textarea; optimistic local state update so UI reflects new version immediately
- **`page.tsx`**: fetches `proposal_versions` server-side, passes `proposalVersions` + `currentVersionNumber` as props

### ✅ Sprint 23 — Onboarding Polish + Email Notifications (COMPLETE — 6 April 2026)
Commit `9033bc2`.
- **`sendContractorViewedNotification`**: fires in `proposal/[token]/page.tsx` when a proposal status first transitions `sent → viewed`; uses `createAdminClient()` to look up contractor email; fire-and-forget so it never blocks the page render for the client
- **`sendWelcomeEmail`**: fires in `onboarding/actions.ts` on first-time setup completion (when `company_name` goes from null → set); includes 4-step getting-started checklist in the email body
- **Contractor acceptance notification** (`sendContractorAcceptanceNotification`) was already wired in `proposal/[token]/actions.ts` — confirmed working
- **Onboarding header**: "Company Profile" → "Welcome to Constructa 👋" with time-estimate subtitle
- **Skip buttons**: added to Step 3 (Capabilities) and helper copy on Step 4 (T&Cs)
- **Dashboard empty state**: getting-started checklist card shown when user has 0 projects; 4-step progress tracker (Profile ✓ done, Create project / Estimate / Proposal as next steps); prominent CTA; theme-aware

### ✅ Sprint 25 — Drawing Upload & AI Takeoff (COMPLETE — 7 April 2026, fully tested)
- **`drawing_extractions` table**: process-only — files never stored, only metadata + AI results
- **`analyzeDrawingPagesAction`**: creates pending DB record → renders PDF pages to JPEG in-browser via `pdfjs-dist` (unpkg CDN worker, v5+ uses `.mjs`) → sends up to 10 pages as multi-image GPT-4o Vision call → parses extracted items → matches against cost library via `generateJSON` → updates DB record with results
- **`addItemsToEstimateAction`**: finds active/any estimate, bulk-inserts lines (NO `project_id` — not a column on `estimate_lines`), recalculates total
- **`/dashboard/projects/drawings`**: server page (`maxDuration = 60`) + `DrawingsClient` component
- **Drawings tab**: added to `project-navbar.tsx` between Estimating and Programme; activeTab type updated
- **Multi-file upload**: drag-drop or click selects multiple PDFs/images at once — each processed individually with its own AI call (sequential). Critical: do NOT combine into one call — the AI synthesises and loses quantity detail from GA drawings
- **Per-file processing**: renders each file, shows progress as "Drawing 2 of 4 · page 1 of 3", results panels appear as each drawing completes
- **GA + detail drawing awareness**: AI prompt instructs it to use GA drawings for quantities and detail drawings for specification, producing properly described BoQ items (e.g. "Naylor faced fire rated concrete lintel, 215×100mm — 2 item")
- **Multiple result panels**: one panel per drawing, each with its own checkbox selection and "Add N to Estimate" CTA
- **Drawing register**: past extractions listed below upload zone, expandable, quick "Add all" button
- **CAD handling**: DWG/RVT/SKP/IFC/DXF rejected with amber warning (non-fatal if mixed with valid files)
- **Body limit**: `next.config.mjs` `serverActions.bodySizeLimit = "25mb"` for base64 page payloads
- **Rates hidden**: suggested rates from library matching NOT shown on drawings panel — appear on Estimating page only after items added
- **Sprint 47** deferred: native CAD/BIM/SketchUp viewer for in-app measurement

### ✅ Sprint 26a — Client BoQ Import (COMPLETE — 7 April 2026)
Commit `78ae468`.

A client QS sometimes sends an unpriced BoQ (NRM2, SMM7 or bespoke) that the contractor must price and return. Sprint 26a imports it exactly — preserving the client's sections and item references for like-for-like comparison.

**Files:**
- `boq-import-action.ts`: three server actions:
  - `parseBoQFromPdfAction` — in-browser PDF→JPEG via pdfjs → GPT-4o Vision → structured JSON (client_ref, section, description, quantity, unit). Preserves all headings including provisional sums and PC sums.
  - `parseBoQFromExcelDataAction` — accepts rows from SheetJS (first 200), passes tab-separated text to `generateJSON`, AI identifies column structure.
  - `createBoQEstimateAction` — inserts estimate (`is_client_boq: true`, `client_boq_filename`), bulk-inserts lines with `client_ref`, auto-advances project status to "Estimating"
- `boq-import.tsx`: modal dialog — upload zone (Excel/PDF, 25MB); states: idle → parsing → preview → importing → done; preview grouped by section with collapsible accordions showing client_ref + qty/unit; amber warning for blank quantities (imported as qty=1 placeholder); "Import N items" CTA
- `boq-excel-export.ts`: client-side SheetJS export — `exportBoQToExcel(estimate)` — grouped by client sections, Ref column included for client BoQ, priced columns (rate + total), full cost summary at bottom; filename = `Priced_<original_filename>.xlsx`
- `types.ts`: `EstimateLine.client_ref?: string | null`; `Estimate.is_client_boq?: boolean`; `Estimate.client_boq_filename?: string | null`
- `estimate-client.tsx`:
  - "Import Client BoQ" button (emerald) next to "New Estimate" in tabs area
  - Green banner on client BoQ estimates: filename + instructions + "Export to Excel" button
  - **Ref column** (50px) replaces Type/Line type column for client BoQ line items
  - Build-up toggle hidden for client BoQ rows (rate-entry only)
  - `BoQImport` modal rendered at root; on close after successful import: `window.location.reload()` to re-fetch estimate from server

**DB migration:** `sprint26a_client_boq_import` — adds `is_client_boq`, `client_boq_filename` to estimates; `client_ref` to estimate_lines. Applied via Supabase MCP.

**Sprint 26b (future):** client-format PDF export matching client's section structure; toggle between Constructa summary format and client format on proposal.

---

### ✅ Sprint 26 — Video Walkthrough AI (COMPLETE — 7 April 2026, fully tested)
- **`VideoWalkthrough` component**: full-width section at top of Brief page, purple border
- **`analyzeVideoAction`**: accepts up to 20 base64 JPEG frames + optional audio transcript, sends to GPT-4o Vision, returns scope/trades/value/observations
- **`transcribeAudioAction`**: accepts base64 WAV, sends to Whisper-1, returns transcript text
- **In-browser frame extraction**: HTML5 video element seeks to 20 evenly-spaced timestamps → canvas → JPEG 640px → base64. Raw video never sent to server.
- **In-browser audio extraction**: Web Audio API `decodeAudioData` → `OfflineAudioContext` resample 16kHz mono → WAV header + PCM → base64. Frames + audio extracted in parallel.
- **Three-step progress**: "Extracting video frames…" → "Transcribing your narration…" → "Combining narration + visuals to build your brief…"
- **Narration-first prompt**: transcript flagged as PRIMARY source in GPT-4o prompt; frames provide visual context (conditions, access, hazards). This is critical — visuals alone miss spoken scope.
- **Results panel**: scope preview, purple trade chips, estimated value, collapsible site observations
- **"Apply to Brief"**: one click pushes scope + trades + value + start date into Brief form; AI chat panel receives confirmation message
- **Limits**: 200MB file, 2-minute duration (iPhone 1-min video ~100MB HEVC)
- **Audio failure is non-fatal**: if browser can't decode audio (no track, codec issue), analysis continues with visuals only
- **Demonstrated end-to-end**: video walkthrough → brief → suggest estimate lines → programme — full pre-construction workflow in under 1 minute

### ✅ Sprint 27 — Live Projects: Overview (COMPLETE — 7 April 2026)
Commit on `main`, deployed to Vercel (READY).

Per-project health dashboard sitting above the project tab area. Replaces the old blank overview stub.

**Files:**
- `src/app/dashboard/projects/overview/page.tsx` (NEW — server component): parallel fetches project, estimates, expenses, invoices, variations; computes contractValue (from active estimate lines + overhead/risk/profit/discount %s), budgetCost (direct + prelims), costsPosted, burnPct, programmePct (from `start_date` + `programme_phases` JSON with `startOffset + ceil(manualDays/daysPerWeek)*7` calendar-day end per phase), currentPhaseName, RAG status
- `src/app/dashboard/projects/overview/overview-client.tsx` (NEW): RAG badge component, 4 KPI cards (Contract Value, Budget Cost, Costs Posted, Margin), burn progress bar, `ProgrammeBar` mini-Gantt (proportional phase blocks + white "today" line), outstanding invoices list, 4 quick-action buttons (Log Cost, Raise Invoice, Add Variation, View P&L)
- `src/components/project-navbar.tsx` (modified): `"overview"` added to activeTab union; Overview tab first in TABS array with Activity icon → `/dashboard/projects/overview?projectId=…`
- `src/components/sidebar-nav.tsx` (modified): Live Projects > Overview links to `/dashboard/projects/overview`

**RAG logic:** Green = burn < 85% AND programme < 90%; Amber = burn 85–100% OR programme 90–100%; Red = burn > 100% OR programme > 100%

**Programme %:** `totalCalendarDays = max(startOffset + ceil(manualDays / daysPerWeek) * 7)` across all phases; `elapsedDays = today − start_date`; `programmePct = elapsedDays / totalCalendarDays * 100`

### Sprint 24 — LemonSqueezy Billing Integration (DEFERRED — skipped by user)
- LemonSqueezy replaces previously planned Stripe integration
- Subscription management: checkout, webhooks, subscription status
- Gating: restrict features or show upgrade prompt when no active subscription
- Admin dashboard: real revenue data replaces estimated MRR
- PLAN_PRICE_GBP constant updated from types.ts once pricing confirmed

--- BATCH 1 COMPLETE — LAUNCH POINT (Sprints 14–26) ---

### ✅ Sprint 27 — Live Projects: Overview *(see full entry above in Sprint History)*

### ✅ Sprint 28 — Live Projects: Cost Tracking (COMPLETE — 7 April 2026)
Commit `82fb44a`, deployed `dpl_2HqivLXMcGrzuJDXTQCM9dbJAPPM` (READY).

**DB migrations applied via Supabase MCP:**
- `cost_status TEXT DEFAULT 'actual' CHECK (cost_status IN ('actual','committed'))` added to `project_expenses` — all existing rows default to `'actual'` (non-breaking)
- `project_section_forecasts` table created: `id UUID PK`, `project_id UUID FK → projects(id) ON DELETE CASCADE`, `trade_section TEXT NOT NULL`, `forecast_cost NUMERIC`, `updated_at TIMESTAMPTZ`, unique constraint on `(project_id, trade_section)`; RLS: SELECT/INSERT/UPDATE/DELETE for own projects only

**Files changed:**
- `src/app/dashboard/projects/p-and-l/actions.ts`: `logCostAction` gains `cost_status?: "actual" | "committed"` param (defaults `"actual"`); new `upsertSectionForecastAction(projectId, tradeSection, forecastCost | null)` upserts `project_section_forecasts` on conflict `(project_id, trade_section)`
- `src/app/dashboard/projects/p-and-l/page.tsx`: fetches `project_section_forecasts`; splits expenses into `actualExpenses` (status=actual) and `committedExpenses` (status=committed); computes `committedTotal`, `committedBySection`; `actualMap` built from actualExpenses only; all passed as new props to `ClientPLDashboard`
- `src/app/dashboard/projects/p-and-l/client-pl-dashboard.tsx`: 3 new props (`committedTotal`, `committedBySection`, `sectionForecasts`); `totalExposure = costsPosted + committedTotal`; `isOverBudget` uses totalExposure; 6th KPI card "Committed" (amber, ShieldAlert icon); stacked burn bar (solid blue = actual, translucent amber = committed); section table expanded to 7 columns (Budget, Actual, Committed, Forecast Final, Variance, %); `mergedSections` now includes `committed`, `forecastFinal` (override OR actual+committed+remainingBudget), `forecastOverride`, `isOver`; AlertTriangle badge on isOver rows; `SectionForecastPopover` imported; section grid `xl:grid-cols-6`
- `src/app/dashboard/projects/p-and-l/section-forecast-popover.tsx` (NEW): pencil icon (hidden, visible on `group-hover`) expands to inline £ input; Save (Check) calls `upsertSectionForecastAction` + `router.refresh()`; Clear (X) sets forecast to null; Escape closes without saving; Enter submits
- `src/app/dashboard/projects/p-and-l/log-cost-sheet.tsx`: new `SubcontractTab` component with Committed/Actual radio at top; fields: description, supplier, trade section, amount, date; calls `logCostAction` with `cost_type: 'subcontract'` and chosen `cost_status`; tab added between Materials and Overhead

**Build fix:** `AlertTriangle` from Lucide does not accept a `title` prop — removed `title="Forecast over budget"` from JSX (commit `82fb44a`)

### ✅ Sprint 29 — Live Projects: Billing & Valuations (COMPLETE — 8 April 2026)
### ✅ Sprint 30 — Live Projects: Variations (COMPLETE — 8 April 2026)
### ✅ Sprint 31 — Live Projects: Programme Live Tracking (COMPLETE — 8 April 2026)
### ✅ Sprint 32 — Live Projects: Communications (COMPLETE — 8 April 2026)

--- BATCH 2 COMPLETE — LIVE PROJECTS RELEASE (Sprints 27–32) ✅ ---

### ✅ Sprint 33 — Closed Projects: Final Accounts (COMPLETE — 8 April 2026)
### ✅ Sprint 34 — Live Projects: Change Management (COMPLETE — 8 April 2026)
### ✅ Sprint 35 — Closed Projects: Handover Documents (COMPLETE — 8 April 2026)
### ✅ Sprint 36 — Closed Projects: Lessons Learned (COMPLETE — 8 April 2026)
### ✅ Sprint 37 — Live Programme: As-Built vs Baseline Gantt (COMPLETE — 8 April 2026)
- Dual-bar Gantt; delay tracking; revised planned finish; today line; delay reason (9 categories)
- Only one sidebar item still disabled: Archive (Closed Projects)

--- BATCH 3 COMPLETE — CLOSED PROJECTS RELEASE (Sprints 33–37) ✅ ---

### ✅ Sprint 38 — Dashboard Home Rebuild (COMPLETE — 8 April 2026)
Cross-project executive ops dashboard at `/dashboard/home`. Replaces the old static home page.

**Files changed:**
- `src/app/dashboard/home/page.tsx` (REBUILT): 8 parallel Promise.all fetches — projects (with programme_phases), profiles, estimates, invoices (full AfP fields), variations, change_events, rfis, early_warning_notices. All passed to HomeClient.
- `src/app/dashboard/home/home-client.tsx` (REBUILT): `getProjectProgrammeDelay()` helper computes delay per project from programme_phases JSONB. `activeProjectsWithData` map joins all module data per active project (outstanding, overdue count, pending vars, open RFIs, open CEs, programme delay, contract value from estimate).
  - 8 KPI cards in 2 rows: Active Projects, Outstanding Certified, Overdue Invoices, Retention Held, Open RFIs, Pending Variations, CE Exposure, Total Programme Delay
  - 5 conditional alert banners (overdue, retention, RFIs, variations, programme delay) — only shown when relevant
  - Active projects table with inline alert chips (each deep-links to the relevant module)
  - Financial snapshot panel: 5 rows (outstanding, overdue, retention, CE exposure, EWN exposure)
  - 7 quick-action links to all major modules
  - `KpiCard` and `AlertBanner` helper components

--- BATCH 4 COMPLETE — DASHBOARD INTELLIGENCE (Sprint 38) ✅ ---

### ✅ Sprint 39 — Project Archive (COMPLETE — 9 April 2026)
Mark project as closed/archived; Archive sidebar item enabled. Searchable/filterable archive view at `/dashboard/projects/archive`. Financial outcome preserved in `archive_snapshots` table (immutable snapshot at close time). Two-step restore confirmation. Retention alert banner. Archive initiated from Project Overview page via Close & Archive dialog.

**Files changed:**
- `src/app/dashboard/projects/archive/actions.ts` (NEW): `archiveProjectAction` (gathers snapshot → writes `archive_snapshots` → sets `is_archived`), `restoreProjectAction`, `getArchivedProjectsAction`
- `src/app/dashboard/projects/archive/page.tsx` (NEW): server component, calls `getArchivedProjectsAction`
- `src/app/dashboard/projects/archive/archive-client.tsx` (NEW): 3-card KPI strip, retention alert, search + type filter, expandable rows, two-step restore
- `src/app/dashboard/projects/overview/overview-client.tsx` (modified): Archive dialog added at bottom, "Close & Archive Project" link, `archiveReason` state
- `src/components/sidebar-nav.tsx` (modified): Archive NavItem enabled
- `supabase/migrations/` (NEW): `archive_snapshots` table + `is_archived`, `archived_at`, `archived_by`, `archive_reason` columns on `projects`

### ✅ Sprint 40 — Contractor Management Accounts (COMPLETE — 9 April 2026)
Consolidated financial view across all of a contractor's live and closed projects. 7 parallel DB fetches. 6 tabs: Overview (KPI cards + monthly bar chart), P&L by Project, Cash Flow (90-day forecast), WIP Schedule, Key Ratios, Export (CSV). Archive snapshots used as source-of-truth for closed projects. Sidebar Reporting section added (static label + direct NavItem — avoids dead-link accordion bug).

**Files changed:**
- `src/app/dashboard/management-accounts/page.tsx` (NEW): 7 parallel Promise.all fetches (profile, projects, estimates, invoices, expenses, variations, archive_snapshots)
- `src/app/dashboard/management-accounts/management-accounts-client.tsx` (NEW): full 6-tab client component; `calcContractValue()` margin hierarchy; `fyBounds()` FY helper; IIFE pattern for Key Ratios local variable scoping; 13 ratios (Gross Margin %, Mark-up %, Overhead Absorption Rate, Subcontractor Cost %, Debtor Days, Cash Conversion Rate, WIP to Revenue %, Retention %, Invoice Coverage %, Variation Rate %, Win Rate %, Cost Overrun Rate %, Avg Revenue per Project); traffic-light status (good/warn/bad/neutral); Healthy/Monitor/Action Required summary strip; CSV download
- `src/components/sidebar-nav.tsx` (modified): Reporting section (static div label + NavItem to `/dashboard/management-accounts`); `BarChart2` lucide import added
- `src/lib/db/index.ts`, `src/lib/db/schema.ts` (DELETED): orphaned drizzle-orm files that broke Vercel build after drizzle-orm removed from package.json

### ✅ Sprint 41 — CIS Compliance (COMPLETE — 9 April 2026)
**Files:** `src/app/dashboard/cis/` (page.tsx, cis-client.tsx, actions.ts), `supabase/migrations/20260409000000_sprint41_cis.sql`, sidebar updated with HardHat icon.
4-tab page: Overview (KPI strip, unverified warning, recent payments, how-CIS-works explainer), Subcontractors (register CRUD, status badges, UTR/verification), Payments (record with live deduction preview, gross/materials/labour split), Monthly Returns (tax month grouping, CIS300 per-subcontractor table, mark statements sent). CIS settings panel (contractor UTR, PAYE ref, Accounts Office ref). `cis_subcontractors` + `cis_payments` tables with RLS; `tax_month_start` computed in app (`getTaxMonthStart`).

### ✅ Sprint 42 — Data Foundation & Benchmark Layer (COMPLETE — 9 April 2026)
**Files:** `supabase/migrations/20260409100000_sprint42_benchmarks.sql`, `src/app/dashboard/settings/profile/profile-form.tsx` + `actions.ts`.
4 benchmark tables (`project_benchmarks`, `rate_benchmarks`, `variation_benchmarks`, `programme_benchmarks`) — no RLS, no PII, service-role only. Contract value stored as bands (0-50k etc). `fn_benchmark_on_archive()` trigger fires on project archive, writes anonymised outcome if `data_consent = true`. `data_consent` + `data_consent_at` added to profiles. Settings page: "Industry Benchmarking" consent checkbox with GDPR-compliant copy. `fn_cv_band()` immutable helper for Admin Dashboard queries.

### ✅ Sprint 43 — Admin Dashboard Phase 2 (COMPLETE — 9 April 2026)
**Files:** `src/app/admin/tabs/benchmarks-tab.tsx` (NEW), `src/app/admin/tabs/intelligence-tab.tsx` (NEW), `admin-client.tsx` + `types.ts` updated.
Two new superadmin tabs: **Benchmarks** (project_benchmarks viewer, filter by type/band, colour-coded margin/delay, empty state while dataset builds) + **Intelligence** (platform health KPIs, feature usage heatmap with adoption bars, at-risk accounts scored 1–3 with risk reasons). `BenchmarkMetrics` + `IntelligenceMetrics` + `AtRiskDetail` + `FeatureUsageRow` types added. Benchmark data computed server-side, at-risk scoring runs in page.tsx IIFE against auth users + live projects.

### ✅ Sprint 44 — Xero Integration *(COMPLETE — 9 April 2026)*
OAuth2 connect/disconnect flow, auto token refresh (5-min expiry buffer), push ACCREC invoices to Xero, pull PAID status back to Constructa, sync log UI with history table. Env vars (XERO_CLIENT_ID, XERO_CLIENT_SECRET, XERO_REDIRECT_URI) stored in Vercel — activate once developer account is confirmed.

### Sprint 45 — QuickBooks / Sage Integration *(deferred — external dependency)*

### Sprint 46 — Accounting Reconciliation *(deferred)*

### Sprint 47 — LemonSqueezy Billing *(deferred — UAE company setup pending)*

### ✅ Sprint 48 — Market Intelligence Product *(COMPLETE — 9 April 2026)*
`api_keys` + `api_usage_log` tables; SHA-256 hashed keys; `/api/v1/benchmarks` GET endpoint (Bearer auth, rate limit, aggregation, CORS); API key management UI (create/copy-once/revoke); Business Intelligence contractor dashboard (vs benchmarks); `increment_api_key_requests` RPC; sidebar links.

### ✅ Sprint 49 — Progressive Web App *(COMPLETE — 9 April 2026)*
`manifest.json` (installable, shortcuts); `public/sw.js` (offline fallback + nav caching); `/dashboard/mobile` on-site hub (project selector, 4 quick-action tiles, recent feed); `capture="environment"` on receipt upload; install banner; theme-color + apple-touch-icon; SW registered in root layout.

### ✅ Sprint 50 — Material Rates & Procurement *(COMPLETE — 9 April 2026)*
`material_prices` table (RLS: authenticated read). 90 indicative UK trade prices seeded across 10 categories (Groundworks, Brickwork, Roofing, Carpentry, Plastering, Plumbing, Electrical, External Works, Flooring, Windows & Doors, Insulation), with low/mid/high price ranges, regional variants, and source dates. `/dashboard/materials` page: filter by trade + region + search, price range visualisation, expandable row detail. Basket panel with qty controls, running total, "Log all to Job P&L" → passes `basketItems` param to pre-populate cost log. Sidebar: Material Rates under Reporting.

---

## Remaining Sprint Register — Confirmed Order (10 April 2026)

**Codebase at close of Sprint 50:** 230 TypeScript files · ~54,000 lines · 74 migrations · 20 dashboard routes · live on Vercel

### ✅ Sprint 51 — Resource Planning & Portfolio Management *(10 April 2026)*
Portfolio-level labour management. CSS Gantt timeline showing all projects + staff across the full portfolio horizon.

**Delivered:**
- `resource_allocations` table: staff ↔ project date-range assignments, `role_placeholder` for unnamed/bid-stage, `is_confirmed` for tentative, `days_per_week`, RLS
- `staff_absence` table: Holiday/Sick/Training/Other with date range, RLS
- `staff_type` column on `staff_resources`: `direct_labour` | `overhead` (feeds management accounts overhead absorption)
- `/dashboard/resources/portfolio` — 3-tab client component:
  - **Portfolio Timeline** — CSS Gantt; project rows with coloured phase segments; staff rows split into Direct Labour / Overhead sections; gap overlays (amber dashed); conflict rings (red); absence blocks; today line
  - **Manage Allocations** — CRUD form for allocations + quick absence add; grouped by project
  - **Demand vs Supply** — estimate manhours → trade sections vs allocated days; cross-project trade summary table with gap/over-allocation colour coding
- KPI strip (projects, staff, conflicts), conflict alert banner
- `sidebar-nav.tsx` updated — Resources section added above Reporting with Resource Portfolio link
- Migration: `20260410000000_sprint51_resource_planning.sql` applied to Supabase

**Key files:** `src/app/dashboard/resources/portfolio/` (page.tsx, portfolio-client.tsx, actions.ts), migration above

**Future hook:** Management Accounts Key Ratios → query `staff_type = 'overhead'` for overhead headcount / absorption rate

---

### Sprint 52 — LemonSqueezy Billing *(deferred — UAE company + freezone setup pending)*
Subscription checkout, webhook events, feature gating (Free / Pro £49 / Business £99). Admin dashboard switches from estimated MRR to real revenue data. Do not build until: UAE freezone company registered, business bank account open, LemonSqueezy merchant account approved.

**When ready:** Env vars needed: `LEMON_SQUEEZY_API_KEY`, `LEMON_SQUEEZY_WEBHOOK_SECRET`, `NEXT_PUBLIC_LS_STORE_ID`. Add `plan` column to profiles. Gate features by plan in server components.

---

### Sprint 53 — Xero Activation *(env vars, no code needed)*
All code is already built (Sprint 44). Activate by adding env vars to Vercel:
- `XERO_CLIENT_ID`
- `XERO_CLIENT_SECRET`
- `XERO_REDIRECT_URI` = `https://constructa.co/api/xero/callback`
- Register callback URL in Xero Developer app settings
- Test: connect, push 1 invoice, pull payment status

---

### ✅ Sprint 54 — Accounting Reconciliation *(10 April 2026)*
**Delivered:**
- Bank CSV import: column auto-detection (date/description/reference/amount/balance/debit+credit), preview before commit, batch tracking
- Auto-match: credits matched to unpaid invoices by amount (±2p), date proximity (60 days), invoice number in reference (+confidence boost)
- Reconciliation UI: match to invoice / categorise as expense / mark unmatched; edit/unmatch any row
- Company P&L: 12-month revenue (paid invoices), direct costs (project_expenses actual), gross margin, overhead costs, net profit — monthly breakdown table
- Aged Debtors: portfolio view, current / 1-30 / 31-60 / 61-90 / 90+ bands with total outstanding
- VAT periods: output/input VAT, HMRC period key, open/submitted/paid status, net VAT due
- Overhead costs CRUD: category breakdown with bar chart, VAT capture, supplier & reference fields
- Schema: `bank_transactions`, `bank_reconciliation`, `vat_periods`, `overhead_costs` (new); `payment_schedule_milestones` patched (user_id added, RLS enabled); `archive_snapshots` confirmed existing
- `/dashboard/accounting` route, Accounting link added to sidebar under Resources

**Key files:** `src/app/dashboard/accounting/` (page.tsx, accounting-client.tsx, actions.ts), migration `20260410100000_sprint54_accounting_reconciliation.sql`

---

### Sprint 55 — QuickBooks / Sage Integration *(deferred — external dependency)*
Same OAuth2 push/pull pattern as Xero. Unified sync settings page covering all three integrations (one active at a time). Build when there is demand from contractors using QB/Sage.

---

### ✅ Sprint 56 — Drawing Viewer & Measurement *(10 April 2026)*
PDF/image viewer with interactive measurement tools built on existing `pdfjs-dist`. CAD/Revit/IFC deferred to post-launch Stage 2 — PDF is the standard deliverable at tender stage for SME contractors.

**Delivered:**
- Full-screen viewer: PDF (multi-page, 2.5x high-res render) + PNG/JPG/WebP
- **Scale calibration** — click 2 points of known dimension, enter real distance → sets px/m ratio
- **Linear measurement** — click start + end, live distance preview, tick marks, labelled line
- **Area measurement** — polygon tool, double-click or click first point to close, area at centroid
- **Count tool** — click to place markers, running total
- **Text annotation** — click to place labelled text in chosen colour
- **Highlight tool** — drag to draw semi-transparent rectangle overlay in chosen colour
- 6-colour palette for markup tools
- Zoom (scroll wheel + buttons), pan (drag), measurements redraw correctly at any zoom
- Measurements panel: label each, assign trade section, delete individual items
- Add to Estimate: pushes measurements as estimate line items to active estimate
- Save measurements: persists to `drawing_measurements` table
- "View & Measure" button added to existing Drawing AI Takeoff page

**Future (Stage 2):** DXF native rendering (`@dxfom/dxf-viewer`), IFC viewer (`@thatopen/components`)

---

### Sprint 58 — Reporting Module *(client + internal)* ✅ COMPLETE
Construction reporting is currently done in Word/WhatsApp. Constructa should generate branded reports in 2 clicks from live data.

**Delivered:**

**Stream 1 — Site Operations:**
- **Site Photos** — multi-upload to Supabase Storage (`site-photos` bucket, public), grid gallery per project, delete with storage cleanup
- **Weekly Progress Reports** — form captures: week ending, overall % progress, work completed, work planned, issues/risks, instructions received, weather days lost, labour headcount. Save/delete, history list
- **Weekly PDF export** — jspdf branded A4: header strip, project info, progress %, all narrative sections formatted with coloured headings and dividers

**Stream 2 — Project Control Suite:**
- **Project Control tab** — 6 KPI cards (contract value, invoiced, received, outstanding, variations, cost to date), full variations table (approved/pending counts), invoice schedule table, latest progress report summary, resources list
- **Project Control PDF** — jspdf + autotable: KPI block, variations table, invoice schedule
- **Portfolio Overview tab** — aggregate KPIs across all projects (5 cards: total contract value, invoiced, cash received, outstanding, approved variations), per-project breakdown table with progress bars, totals footer row
- **Portfolio PDF** — landscape A4, full project breakdown table with totals row

**Route:** `/dashboard/reporting` (server page with `?projectId` param support)
**Tables:** `site_photos`, `progress_reports` (RLS enabled)
**Actions:** `uploadSitePhotoAction`, `deleteSitePhotoAction`, `upsertProgressReportAction`, `deleteProgressReportAction`
**Sidebar:** "Reports & Photos" link added under Reporting section

**Key design principle:** Reports pull live data — never stale. Contractor clicks "Generate Report", reviews, sends. No data entry.

---

### Sprint 59 — Contract Administration Suite *(post-launch, high-value add-on)*
Universal contract management layer. CEMAR (now Thinkproject) only covers NEC — JCT (the most common form for SME contractors) is completely unserved by any equivalent tool. CEMAR is acknowledged by name in NEC4 contracts and costs £5k–£20k+/year — entirely inaccessible to small contractors.

**Vision:** Multi-contract-suite administration tool + AI claims module. Can also be sold as a standalone product targeting claims consultants and lawyers.

**Contract suites to support:**
- **NEC3 / NEC4** — ECC, PSC, TSC, subcontracts. Compensation events (8-week time bar), early warnings, programme submissions, defined cost, PWDD
- **JCT** — Design & Build, SBC, Intermediate, Minor Works, MTC, subcontracts. Extensions of time, loss & expense, interim valuations, practical completion, defects
- **FIDIC** — Red/Yellow/Silver Book. Engineer's instructions, claims procedure, DAB/dispute board
- **Bespoke contracts** — upload any contract → AI extracts key clauses, notice periods, obligations → builds custom workflow

**Core features:**
- Action dashboard: overdue obligations flagged with days remaining, time bar warnings (NEC 8-week CE notice is a career-saver for small contractors)
- Automated notification drafts: AI pre-populates early warning notices, CE notifications, EoT applications from project data already in Constructa (programme, variations, costs)
- Correspondence register: all contractual communications logged with clause references, sent/received/overdue status
- Delegated authority settings: PM/CA/Engineer authorities per contract
- Audit trail: full record for adjudication

**Claims Module (AI-assisted, per-claim fee):**
- Contractor uploads contract + relevant correspondence/documents
- System already has: programme baseline, as-built dates, variations, costs — 80% of evidence assembled automatically
- SCL Delay Analysis Protocol: As-Planned vs As-Built, Time Impact Analysis, Collapsed As-Built, Windows Analysis
- AI drafts claim narrative, EOT application, loss & expense schedule, adjudication notice
- Seeded with precedent claims corpus to reduce hallucination
- Pricing model: per-claim fee (£50 CE notification → £250 EOT → £500–2,500 L&E → £2,500–5,000 full adjudication bundle)

**Standalone product angle:** `constructa-claims.com` or similar — targeted at claims consultants and lawyers who don't use Constructa but want AI-assisted claim drafting. Same tech, second revenue stream.

**Tech approach:** Contract type selector on project creation. Store as `contract_type` + `contract_data` JSONB (specific clauses, notice periods, parties) on `projects`. Build NEC first (cleanest workflow), then JCT, then bespoke upload.

**Key tables needed:** `contract_obligations`, `contract_communications`, `contract_events` (EW/CE/EoT), `claims`

**Owner notes (11 April 2026) — strategic rationale:**
- NEC is brutal on time bars — miss the 8-week window to notify a CE and you've potentially lost tens of thousands of pounds. Small contractors routinely write this money off because they don't know their obligations or are too busy on site. "You have 6 days left to notify CE #4 or you lose entitlement" is genuinely career-saving.
- SCL Delay Analysis Protocol has four methodologies: As-Planned vs As-Built, Time Impact Analysis, Collapsed As-Built, Windows Analysis. The last two are what adjudicators actually respect. Constructa holds baseline + as-built dates already — it can run these analyses automatically. No specialist claims consultant does this today without Excel.
- AI approach: LLMs hallucinate on technical docs but are excellent at structure and argument framing when given good source material. Seed with 20–30 well-drafted precedent claims (EOT, loss & expense, prolongation, disruption). Give it: contract type + specific clause numbers + factual narrative → output formal notice or claim document.
- Pricing confirmed: CE notification £50 / EOT claim £250–500 / full L&E £500–2,500 / adjudication bundle £2,500–5,000. Fraction of consultant fees (£150–300/hr × 20hr minimum). First draft in minutes.
- Both bolt-in (inside Constructa, knows all project context) AND standalone (upload documents only) make sense simultaneously.

---

### ✅ Sprint 57 — Chrome QA Audit (COMPLETE — 10 April 2026)
Commits `5752d6d` and `c759374`. Full live Chrome walkthrough of all modules. 8 bugs identified and fixed.

**Bugs fixed:**
1. `dashboard-client.tsx` — Removed permanent "HOVER STAGE NAME FOR DETAILS" static `<span>` from pipeline header (was always visible, `text-[#404040]` colour not enough to hide it)
2. `proposal/client-editor.tsx` — `scope` state was falling back to `initialBriefScope`, making Client Introduction and Scope of Works identical; fix: `scope` only uses `initialScope || ""`
3. `proposal/client-editor.tsx` — Scope of Works textarea had `font-mono` class; removed
4. `proposal/client-editor.tsx` — Contract value used raw `estimatedTotal` prop (sum of `total_cost` without multipliers); now computes via `computeEstimateContractSum(activeEst).contractSum`
5. `projects/programme/page.tsx` — Query selected `timeline_phases` (non-existent column) causing entire project row to return null → subtitle blank; fixed by removing bad column, added `.eq("user_id", user.id)`
6. `dashboard/reporting/page.tsx` — Query selected `end_date` (non-existent) and ordered by `updated_at` (non-existent) → projects array null → blank project picker
7. `dashboard/reporting/page.tsx` — Same root cause as #6; Portfolio showed "0 Projects"; fixed by removing bad columns, `updated_at` → `created_at`
8. `proposal/proposal-pdf-button.tsx` — Standalone closing statement block appeared after T&Cs and before always-new-page Why Choose section, creating a near-blank page when T&C right column overflowed; moved closing text into the Why Choose section (PDF now 10 pages not 11)

**Known remaining data issue:** Test project "22 Birchwood Avenue" has identical text saved in both `proposal_introduction` and `scope_text` DB columns (pre-dates bug fix #2). Use "Rewrite with AI" on Client Introduction to differentiate.

---

### ✅ Sprint 57 polish follow-up (COMPLETE — 11 April 2026 evening)
Commit `2b2b5c8`. Triggered by Perplexity + Grok independent reviews and Robert's manual QA notes from the proposal flow. All reports archived at `docs/reviews/2026-04-11/`.

**Proposal PDF refinements (`proposal-pdf-button.tsx`):**
1. Cover title no longer orphans em-dash at line start. `splitTextToSize` was breaking `"22 Birchwood Avenue — Kitchen Extension"` on whitespace and starting line 2 with the dash. Now splits on em/en dash first, then auto-fits font size down from 42pt → 24pt until the widest segment fits `CW - 20`.
2. About Us page no longer shows a large blank strip when `md_message` is absent. When there's no MD message and the column content ends above `CONTENT_BOTTOM - 70`, we now render an "Our Commitment" 2×2 value-prop block (Transparent Pricing / Clear Communication / Programme Certainty / Quality Without Compromise) filling the remaining height.
3. `splitAddress` now inserts a space (not a newline) at camelCase joins so `"18 Jackdaw DriveColchester, Essex, CO3 8WD"` renders as `["18 Jackdaw Drive Colchester", "Essex", "CO3 8WD"]` instead of splitting the street from the town.

**Billing revised contract sum now matches proposal/estimate (`billing/page.tsx`):**
- `/dashboard/projects/billing` was showing `£1,593.90` where the proposal showed `£1,753.29` on the same project. Root cause: `page.tsx` computed `originalContractSum` from `estimates.total_cost + overhead/risk/profit` but forgot the 10% prelims uplift that `computeContractSum()` applies first.
- Rewrote the formula to the canonical QS hierarchy used in `proposal-pdf-button.tsx` and `client-editor.tsx`: `direct → + prelims → + overhead → + risk → + profit → − discount`.
- Now pulls `estimate_lines` so explicit `Preliminaries` lines override the percentage fallback, matching the proposal exactly.

**Silent schema-mismatch sweep (THE MOST SERIOUS BUG IN THE REPO):**
The `projects` table has no `updated_at`, `end_date`, `timeline_phases`, or `validity_days` columns. Supabase returns `{data: null}` silently on any SELECT that includes an unknown column — which is why project pickers, home dashboard, admin page, and the public proposal portal have been showing empty or degraded data in production for weeks. Fixed in:
- 12 project-picker fallbacks (billing, proposal, p-and-l, programme, variations, change-management, communications, final-account, handover-documents, lessons-learned, contracts, contract-admin)
- `dashboard/home/page.tsx` (+ `home-client.tsx` usages fall back to `proposal_sent_at ?? created_at`)
- `dashboard/live/page.tsx` (portfolio list + per-row mapping)
- `dashboard/mobile/page.tsx` (quick-select ordering)
- `admin/page.tsx` (platform subscriber fetch)
- `proposal/[token]/page.tsx` (public client portal select + phases fallback)
- **`schedule/actions.ts updatePhasesAction` — MOST SERIOUS.** Was writing both `timeline_phases` and `programme_phases`. The `timeline_phases` write was causing the whole UPDATE to fail silently, so **users' programme edits were never persisting**. This bug had been live since Sprint 19. Now writes `programme_phases` only.
- `contract-admin/page.tsx` also dropped `end_date` from the two projects selects.

**Proposal editor section flow now mirrors PDF output (`client-editor.tsx`):**
- Removed duplicate "Pre-filled from Brief" banner in Client Introduction.
- Closing Statement moved to the bottom of the main column (matches PDF page 9, just before signature sheet).
- Site Photos moved up to sit directly after Scope of Works (mirrors PDF page 4 where they share a page).
- Case Studies selection moved up to sit after About Us override (reflects PDF page 3, right after About Us).

**Test data cleanup:** Updated 22 Birchwood Avenue `proposal_introduction` in Supabase so it is a genuine opening letter rather than a duplicate of `scope_text` (the legacy of pre-Sprint 57 code that was saving both fields identical).

---

### Sprint 58 — Hardening & Robustness (IN PROGRESS — 11 April 2026 evening)

**Triggered by:** Independent reviews from Perplexity Computer (full technical audit, archived at `docs/reviews/2026-04-11/perplexity-*.{md,pdf}`) and Grok red-team commentary (`docs/reviews/2026-04-11/grok-red-team-notes.md`). Claude's response and synthesis at `docs/reviews/2026-04-11/claude-response.md`.

**Owner direction (locked):**
> "No new functionality in my mind to be incorporated — that is built now. Now I want to be able to test it, break it and see what needs to be strengthened so that it is robust, and then streamline it to keep it simple (i.e. Quick Quote) while retaining stronger functionality for the larger projects."

**Scope:** Zero new features. Test → break → strengthen → streamline.

#### Phase 1 — Safety net before launch (P1, must-have)

1. **Error + loading boundaries.** Add `error.tsx` + `loading.tsx` to `/dashboard` and `/dashboard/projects` route groups. Stops white-screen failures. Perplexity gap #2.
2. **`requireAuth()` helper.** New helper in `src/lib/auth-utils.ts` that wraps `supabase.auth.getUser()` and throws on null. Apply to every mutating server action in `costs/`, `billing/`, `proposal/`, `variations/`, `schedule/`, `programme/`, `final-account/`. Defence-in-depth against RLS bugs (which have happened — see migration `20260324000006`). Perplexity gap #3.
3. **Zod validation on the 8 highest-risk server actions.** Add `zod` dependency. Schemas for: `logCostAction`, `upsertInvoiceAction`, `saveProposalAction`, `createVariationAction`, `updatePhasesAction`, `bulkAddMoMItemsAction`, `saveAsBuiltPhasesAction`, `createProjectFromTemplateAction`. Perplexity gap #4.
4. **Fix RAG status logic.** `overview/page.tsx` must factor forecast-to-complete vs contract sum. Currently shows "On Track" green when a project is forecast to lose money (verified on 22 Birchwood: costs £1,899 vs contract £1,753, but status = On Track). Perplexity live-app issue #2.
5. **Unify "Active Projects" KPI definition.** Three different counts today: home shows 0, pipeline shows 1, management accounts shows 0. Create `isActiveProject(project)` helper in `src/lib/project-helpers.ts` and use it across all three pages. Perplexity live-app issue #9.
6. **Sidebar active-project context sync.** Read `projectId` from URL params as the primary source for the sidebar active-project widget. Today it goes stale on Variations, Reporting, and others. Perplexity live-app issue #6.
7. **Clean test data from production.** Remove or hide the "TEST SCROLL..." / "Mr Test" project from the Estimating column of the live pipeline. Confirm no other test records leak into user-visible views.
8. **Vitest test harness + 20 tests on financial calcs.** Stand up `vitest` + `@testing-library/react`. First tests on pure functions: `computeContractSum()`, `computeEstimateContractSum()`, P&L variance, retention math, CIS deductions, AfP netting. Start with server actions — easiest to test, highest ROI.
9. **Sentry error tracking.** Add `@sentry/nextjs`, wire up `SENTRY_DSN` env var, 10% trace sample rate. Production errors are invisible today.

#### Phase 2 — Streamline for speed (Quick Quote path)

10. **Quick Quote path** — Robert has explicitly requested this based on Grok's red-team analysis. The existing 5-step wizard is excellent for £100k+ jobs but too heavy for the £5k–£50k domestic jobs that make up the majority of SME contractor work.
    - New "Quick Quote" button on `/dashboard/home` and pipeline Kanban header.
    - Template picker: Kitchen Extension / Loft Conversion / Bathroom Refit / Driveway / Garden Room / Custom (6 seed templates for Tripod's preferred trades).
    - Each template seeds: brief scope text, preferred trade sections, default margin setup, placeholder estimate lines drawn from the cost library.
    - One-page view: Project name + client + postcode + scope textarea + estimate table → PDF.
    - Saves everything to the same `projects` + `estimates` + `estimate_lines` + `programme_phases` tables, so large projects can "graduate" to the full 5-step wizard by clicking any pre-construction tab.
    - New `proposal_complexity` column on `projects` (`'quick' | 'full'`, default `'full'`) drives which entry flow loads by default.
    - New seed migration: `project_templates` table (`id, name, description, default_scope, default_trade_sections, default_line_items JSONB, is_system`) with 6 system templates.
    - New server action `createQuickQuoteFromTemplateAction(templateId, projectFields)` — creates project, estimate, lines atomically and returns the new project id.
    - **Keep the existing 5-step wizard for "Full Control" mode.** Quick Quote is additive, not replacement. The Golden Thread stays intact under both flows.

11. **Autosave everywhere in proposal editor.** Debounced (1.5s) save on all textareas in `client-editor.tsx`. No more "did that save?" anxiety.

12. **Forgot-password flow.** Supabase's password reset API is already available. Add UI entry point on `/login` + handler route. Perplexity gap #16.

#### Phase 3 — Break-proofing follow-up (nice-to-have)

13. **Extract shared PDF service** from the 7 generators (single theme / header / footer / table config module in `src/lib/pdf/`). Proposal PDF builder must shrink below 1,000 lines. Only attempt after Phase 1 tests land.
14. **Core domain type interfaces** (`Project`, `Estimate`, `EstimateLine`, `Proposal`, `Profile`) replacing the worst `any` usage — starting with `proposal-pdf-button.tsx` (39 `any`s), `p-and-l/page.tsx` (26), and `contracts/client-contract-editor.tsx` (21). Perplexity gap #5.
15. **Fix reporting project selector** to honour the current active project instead of always defaulting to "14 Maple Close".
16. **Final Account "£–0.00" formatting** — trivial display fix.
17. **Light mode** — verify it actually switches themes, not just a subtle tint. Fix if broken.

#### What Sprint 58 explicitly does NOT cover

- Bulk refactoring the 13 files >1,000 lines (unsafe without tests first; partially addressed by extracting the PDF service).
- Multi-user / team accounts.
- LemonSqueezy billing (still blocked on UAE company setup).
- QuickBooks / Sage integrations.
- Full Contract Admin Suite polish (Sprint 59 remains scaffolded; evaluate after Sprint 58 completes).

#### Success criteria for Sprint 58

- Zero white-screen failures on any dashboard route.
- Every mutating server action rejects unauthenticated calls at the application layer.
- 20+ passing Vitest tests covering all financial calculation functions.
- "On Track" RAG status honestly reflects forecast margin.
- "Active Projects" count is identical across home, pipeline, and management accounts.
- Quick Quote path: new user can go from "Quick Quote" click to branded PDF in under 5 minutes.
- All previously-hidden bugs from Perplexity's live-app review (items 1-20) are either fixed or consciously deferred with a reason.

---

### Post-Sprint: AI-Assisted Testing & Pre-Launch Hardening
Before sharing with real contractors:
1. Claude Code (Chrome plugin) — systematic walkthrough of every workflow end-to-end
2. Additional AI agents (ChatGPT Codex, Gemini, Perplexity) — independent probing for edge cases and UX friction
3. Robert manual walkthrough
4. Closed beta: 3–5 real contractors, structured feedback
Goal: product that blows people's socks off on first use — not just functional but fast, intuitive, and genuinely better than their current system.

**After beta → Marketing site update** — rebuild/update constructa.co with accurate feature detail, screenshots, pricing, and case studies from beta users. Then go live.

**Post-launch focus:** Make existing functions excellent before adding new ones. Outputs (proposals, reports) are the priority improvement after launch. CAD/Revit viewer, programme tools competing with P6/Asta, estimating competing with CostX/Candy — all Stage 2.

---

### Post-Launch (not yet sprinted — future roadmap)
- **Email/WhatsApp receipt capture** — forward a photo → auto-log cost entry via AI image parsing
- **Voice-to-proposal** — describe job on phone → AI structures estimate
- **Merchant procurement** — Travis Perkins / Jewson / Selco live pricing, one-click order basket (needs formal API agreements)
- **Push notifications** — overdue payments, variation decisions (requires native app or Web Push API)
- **Multi-user / team accounts** — currently single-user per account; add `organisation_members` table and role-based access
- **Client portal** — read-only login for client to view proposals, sign contracts, approve variations, track programme
- **In-house accounting bolt-on** — full financial accounts, corporation tax, balance sheet as a £20/month add-on. Data already exists in Constructa (job P&Ls, overheads, invoices, cost basis). Build when data history is established and Xero integration is proven. Widens moat significantly — switching cost becomes very high.

---

### Long-Term Platform Vision (12–24 months post-launch)
**Phase 1 — nail it for small contractors (current focus)**
UK SME contractors £500k–£3m. Every workflow faster and better than their current cobbled-together system. One-stop shop.

**Phase 2 — scale up-market**
- Programme: compete with P6 / Asta Powerproject — multi-level WBS, resource-loaded programmes, critical path, float analysis
- Estimating: compete with Candy — better UI, AI-assisted takeoff, live material pricing
- CAD/BIM: compete with Bentley viewer, CostX — in-browser measurement, SketchUp-style modelling, rendering
- Commercial: compete with Procore — full contract administration at scale, multi-tier subcontracting, NEC/JCT workflows
- Planning AI: compete with nPlan / AnaPlan — predictive programme analytics, delay risk modelling

**Phase 3 — full financial infrastructure**
- In-house accounting package (bolt-on, see above)
- Working capital / contractor finance
- Client payment escrow

**Key strategic insight:** Procore built upmarket from small contractors using the same playbook. The difference is Constructa is AI-native from day one — the ceiling is higher. Start by serving "Dave" better than anyone else, then grow up with customers as they scale.

---

## Known Bugs

**Fixed in commit `2b2b5c8` (11 April 2026 evening):**
- [x] PDF cover title: em-dash orphaned at line start when project title wraps
- [x] PDF About Us: large blank space at bottom when `md_message` is absent (now fills with "Our Commitment" 2×2 value-prop block)
- [x] PDF address: "18 Jackdaw DriveColchester" missing space (`splitAddress` camelCase fix)
- [x] Billing: Revised Contract Sum showed `£1,593.90` vs `£1,753.29` shown elsewhere (formula was missing 10% prelims uplift)
- [x] Test project "22 Birchwood Avenue": `proposal_introduction` was a duplicate of `scope_text` (rewritten via Supabase MCP to a proper opening letter)
- [x] Proposal editor section flow reordered to match PDF output (Case Studies after About Us, Site Photos after Scope, Closing Statement at the end)
- [x] Duplicate "Pre-filled from Brief" banner in Client Introduction
- [x] `schedule/actions.ts updatePhasesAction` was silently failing all programme edits (`timeline_phases` unknown column)
- [x] 14 project-picker queries selecting non-existent `updated_at`/`end_date`/`timeline_phases` columns (home, admin, live, mobile, 12 project sub-pages)

**Pre-existing, verified still present (deferred from immediate QA — to be fixed in Sprint 58):**
- [ ] **`Plant resource calcPlantDailyChargeout` in `log-cost-sheet.tsx`** — Handover claim was it needed a `rate_mode` branch, but on inspection the `PlantResource` interface at `log-cost-sheet.tsx:55-73` already has `rate_mode` + `daily_chargeout_rate` and `calcPlantDailyChargeout()` at line 124 already branches `if (p.rate_mode === "simple") return p.daily_chargeout_rate;`. This was fixed in Sprint 16 (commit `5d66a40`) and the old handover entry was stale. **No action needed.** Added here so future sessions don't chase a ghost.
- [ ] **"On Track" RAG status ignores forecast loss** — verified on 22 Birchwood (costs £1,899 forecast vs £1,753 contract, still shows green "On Track"). Sprint 58 Phase 1 item #4.
- [ ] **"Active Projects" KPI mismatch** — home shows 0, pipeline shows 1, management accounts shows 0. Sprint 58 Phase 1 item #5.
- [ ] **Sidebar active-project widget** goes stale on Variations and Reporting pages (shows "Select a project..." despite URL having `projectId`). Sprint 58 Phase 1 item #6.
- [ ] **Test data in production pipeline** — "TEST SCROLL..." / "Mr Test" card visible in Estimating column. Sprint 58 Phase 1 item #7.
- [ ] **Reporting page loads wrong project** — opens with "14 Maple Close" instead of the current active project. Sprint 58 Phase 3 item #15.
- [ ] **Final Account shows "£–0.00"** for negative zero. Trivial display fix. Sprint 58 Phase 3 item #16.
- [ ] **Light mode toggle may not fully switch theme** — needs verification. Sprint 58 Phase 3 item #17.
- [ ] **No Forgot Password link on `/login`.** Sprint 58 Phase 2 item #12.
- [ ] **`Mr Bob Jovi` staff record has all-zero rates.** Test data — either populate or remove.
- [ ] **Masonry estimate line** on 22 Birchwood has `£0.00` rate producing no budget, but `£699.24` in actual costs logged against it. Legitimate data inconsistency in test project only; not a product bug.

---

## Target User Profile — "Dave"

UK SME contractor, £1–3m turnover, 5–8 subcontractors, does extensions/loft conversions/commercial fit-outs.

Dave's problems in order of pain:
1. Doesn't get paid on time — clients dispute invoices, go quiet
2. Signs contracts he doesn't understand — gets hammered by unfair clauses
3. Doesn't know if he's making money mid-job — finds out too late
4. Spends 4+ hours pricing jobs he doesn't win
5. Proposals look amateur — Word docs with no branding

Constructa currently solves: 3, 4, 5 (and partially 1 and 2 via Contract Shield + billing).

---

## Monetisation (planned)

- **Free:** 3 proposals/month, watermarked
- **Pro £49/month:** unlimited, all AI, estimating, Gantt, Job P&L
- **Business £99/month:** multiple users, custom branding, contract review AI, resource catalogues

---

## Product Vision

**Mission:** One-stop shop for contractors to run their entire business — from first estimate to final account and beyond.

**Stage 1 (now):** SaaS for UK SME contractors £500k–£3m. Nail the core workflow. Ship reporting. Harden UX. Go live.
**Stage 2:** Scale up-market — programme, estimating, CAD/BIM tools that compete with P6, Candy, CostX, Procore for larger contractors.
**Stage 3:** Financial infrastructure — in-house accounting bolt-on (corporation tax, balance sheet, VAT), working capital, escrow stage payments.

**Strategic positioning:** AI-native construction OS. Not a feature-add to existing tools — a replacement for the entire stack.

Target: UK SME contractors £500k–£10m turnover (Stage 1), major contractors (Stage 2+)
Entry hook: Proposal tool → win work faster with professional proposals
Key metric: First sent proposal under 10 minutes from signup

---

## Strategic Decisions Log *(8 April 2026)*

### Billing timing — owner decision
LemonSqueezy billing is intentionally deferred beyond the immediate sprint backlog. Owner is based in UAE and needs to establish a freezone company, business bank account, and LemonSqueezy merchant account before going live with payments. This is infrastructure, not a product decision. Building the full product first is a deliberate choice:

- All functionality will be built and locally tested before any billing gate is applied
- On the live site, unfinished or unbilled features can be hidden via disabled nav items or feature flags — the codebase already uses this pattern (Archive is currently disabled)
- Once the full product is complete, a structured testing pass will run through the full Brief → Final Account workflow with real data before any contractor is charged
- The marketing site will be updated once the full feature set is known — building to completion first means the marketing site gets written once accurately, not revised every sprint

**Overrides:** Perplexity Computer's recommendation to move billing to Sprint 40. Owner's call, rationale accepted.

### Testing strategy — owner decision
Formal test suite (Playwright, Jest) will be introduced after full feature completion, not sprint-by-sprint. The structured testing approach will be:
1. Full workflow test: new project → estimate → programme → proposal → live project → billing → P&L → final account → handover → lessons learned — run with real numbers that can be manually verified
2. Financial logic specifically: contract value, invoice netting, retention, P&L margin — these are the highest-risk outputs
3. Known bugs resolved before any contractor is given access

**Rationale:** Testing a half-built product generates false signal. Testing the complete integrated product gives cleaner diagnostics.

### Build momentum — owner instruction
Priority is completing the full remaining sprint backlog at pace. Some rework is acceptable and expected. The bigger vision (full lifecycle, AI-native, differentiated from legacy tools) is the goal. Refactoring and polish come after completion, not during.

---

## Sprint Plan — Full Status (10 April 2026)

Current status: **Sprint 50 complete.** Core product is functionally complete. Remaining sprints are enhancements, integrations, and the strategic moat.

| Sprint | Module | Status |
|--------|--------|--------|
| ✅ **39** | **Project Archive** | COMPLETE — 9 Apr 2026 |
| ✅ **40** | **Management Accounts** | COMPLETE — 9 Apr 2026 |
| ✅ **41** | **CIS Compliance** | COMPLETE — 9 Apr 2026 |
| ✅ **42** | **Benchmark Data Layer** | COMPLETE — 9 Apr 2026 |
| ✅ **43** | **Admin Dashboard Phase 2** | COMPLETE — 9 Apr 2026 |
| ✅ **44** | **Xero Integration** | COMPLETE — code done, env vars pending |
| ✅ **48** | **Market Intelligence / API** | COMPLETE — 9 Apr 2026 |
| ✅ **49** | **PWA** | COMPLETE — 9 Apr 2026 |
| ✅ **50** | **Material Rates & Procurement** | COMPLETE — 9 Apr 2026 |
| 🔜 **51** | **Resource Planning & Staff Allocation** | **START HERE** |
| ⏳ **52** | **LemonSqueezy Billing** | Deferred — UAE company setup |
| ⏳ **53** | **Xero Activation** | No code needed — just env vars |
| ⏳ **54** | **QuickBooks / Sage** | Deferred — external dependency |
| ⏳ **55** | **CAD / BIM / Drawing Viewer** | Strategic moat — longer horizon |
| ⏳ **56** | **Bank Reconciliation** | Deferred — post billing launch |
| ⏳ **57** | **Polish, Testing & Pre-Launch QA** | Final sprint before go-live |

### What "done" looks like
Full product is complete when a UK SME contractor can:
1. Film a site walkthrough → get a structured estimate in under 1 minute
2. Win the job → proposal to client → digital acceptance
3. Run the job → billing, variations, change management, programme tracking, communications
4. Close the job → final account, handover documents, lessons learned
5. See everything → home ops dashboard, management accounts, resource availability
6. Connect their accountant → Xero/QB/Sage sync
7. Stay compliant → CIS returns handled within the platform

That is a product with no direct equivalent in the UK SME construction market.
