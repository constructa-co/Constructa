# Constructa — Full Project Handover Document
**Last updated:** 8 April 2026 (end of Sprint 38 — Dashboard Home Rebuild: cross-project ops dashboard, fully committed)
**For:** Any AI coding assistant (Claude Code, ChatGPT Codex, Cursor, etc.) picking up this project

---

## Project Overview

**Constructa** is a SaaS platform for UK SME construction contractors.
- **Live app:** https://constructa-nu.vercel.app
- **GitHub repo:** https://github.com/constructa-co/Constructa (public)
- **Marketing site:** https://www.constructa.co (SEPARATE project — do NOT modify)
- **Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Supabase (PostgreSQL + RLS + Auth + Storage), OpenAI gpt-4o-mini, Vercel CI/CD

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

## Sidebar Navigation (current state)

```
COMPANY PROFILE
  Profile         /dashboard/settings/profile
  Case Studies    /dashboard/settings/case-studies
  Setup Wizard    /onboarding?force=true
  Resources
    Staff         /dashboard/resources/staff
    Plant         /dashboard/resources/plant

WORK WINNING
  Dashboard       /dashboard  (Kanban: Lead/Estimating/Proposal Sent/Active/Completed/Lost)
  New Project     /dashboard/projects/new

PRE-CONSTRUCTION  (accordion, auto-expands on project select)
  Brief           /dashboard/projects/brief?projectId=X
  Estimating      /dashboard/projects/costs?projectId=X
  Drawings        /dashboard/projects/drawings?projectId=X  ← Sprint 25
  Programme       /dashboard/projects/schedule?projectId=X
  Contracts       /dashboard/projects/contracts?projectId=X
  Proposal        /dashboard/projects/proposal?projectId=X

Project navbar tabs: Brief / Estimating / Drawings / Programme / Contracts / Proposal
  ── divider ──
  Cost Library    /dashboard/library

LIVE PROJECTS
  Project Overview    /dashboard/projects/overview?projectId=X   ← Sprint 27
  Billing & Invoicing /dashboard/projects/billing?projectId=X    ← Sprint 29
  Variations          /dashboard/projects/variations?projectId=X ← Sprint 30
  Job P&L             /dashboard/projects/p-and-l?projectId=X
  Change Management   /dashboard/projects/change-management?projectId=X  ← Sprint 34
  Programme           /dashboard/projects/programme?projectId=X  ← Sprint 37 (as-built)
  Communications      /dashboard/projects/communications?projectId=X     ← Sprint 32

CLOSED PROJECTS
  Archive             (disabled — Sprint 39 pending)
  Final Accounts      /dashboard/projects/final-account?projectId=X      ← Sprint 33
  Handover Documents  /dashboard/projects/handover-documents?projectId=X ← Sprint 35
  Lessons Learned     /dashboard/projects/lessons-learned?projectId=X    ← Sprint 36
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
4. Project Brief & Scope
5. Fee Proposal (section totals, margins hidden, TOTAL INC. VAT primary)
6. Project Timeline (Gantt from `project.programme_phases`)
7. Commercial Terms (exclusions + clarifications)
8. Risk & Opportunities
9. Why Choose Us (closing statement + discount callout)
10. Acceptance / signature page

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

### 🔜 Sprint 39 — Project Archive ← NEXT
Mark project as closed/archived; enable Archive sidebar item (currently the only disabled nav item). Freeze edits on archived projects. Searchable/filterable archive view at `/dashboard/projects/archive`. Preserve key financial outcome (contract value, final account amount, margin). Enables "similar projects" pattern matching for future bids and the benchmark layer in Sprint 41.

### Sprint 40 — Contractor Management Accounts
Consolidated financial view across all of a contractor's live and closed projects — the equivalent of a management accounts pack generated automatically from Constructa data. Consolidated P&L (revenue, costs, gross margin by project), cash flow forecast (projected inflows from outstanding invoices vs committed outflows from project expenses), WIP schedule, overhead absorption report, year-to-date summary by month, per-project comparison table. PDF and CSV export. Financial year / calendar year / custom date range filter.

### Sprint 41 — Data Foundation & Benchmark Layer
Pure database migration — no changes to contractor-facing app. Creates the anonymised aggregation layer for cross-contractor intelligence.

Benchmark tables (no RLS, service-role only, no PII): `project_benchmarks`, `rate_benchmarks`, `labour_benchmarks`, `plant_benchmarks`, `material_benchmarks`, `programme_benchmarks`, `variation_benchmarks`, `contract_risk_benchmarks`. Supabase triggers fire on project close / invoice paid / variation approved to populate tables. GDPR consent gate (`contractors.data_consent`) added to onboarding and Settings before any trigger writes fire.

### Sprint 42 — Admin Dashboard Phase 2
Superadmin tooling for Constructa staff only — not visible to contractors. Data intelligence explorer, benchmark browser, market rate maps (choropleth by region/trade), anonymous percentile positioning, platform analytics (MAU/DAU/proposals), churn prediction, at-risk account scoring, feature usage heatmap. Builds on existing Sprint 21 admin dashboard tabs.

### Sprint 43 — Xero Integration
OAuth2 connection flow → push invoices on send → pull payment status daily → push expenses on cost log → trade section to Xero tracking category mapping (configurable) → sync log with retry → disconnect/reconnect without losing history.

### Sprint 44 — QuickBooks / Sage Integration
Same OAuth2 push/pull pattern extended to QuickBooks Online and Sage Business Cloud — the two next most common accounting packages for UK SME contractors. Single unified sync settings page covers all three integrations (Xero / QuickBooks / Sage), one active at a time, with field mapping UI per platform and a sync health indicator (last synced, error count, items pending).

### Sprint 45 — Accounting Phase 2: Reconciliation
Bank feed import (CSV or Plaid open banking), transaction parser, auto-match bank transactions to Constructa invoices by amount + reference, manual match for unmatched items, reconciliation dashboard, VAT return preparation grouped by VAT period, MTD-compatible CSV export for HMRC Making Tax Digital, full audit trail of every match/unmatch.

### Sprint 46 — LemonSqueezy Billing Integration *(deferred from Sprint 24)*
OAuth subscription management: checkout flow, webhooks for subscription events, subscription status gating (restrict or show upgrade prompt on feature access). Admin dashboard shows real revenue data replacing estimated MRR. `PLAN_PRICE_GBP` constant updated once pricing confirmed.

### Sprint 47 — Market Intelligence Product
Constructa's benchmark data as a sellable B2B data product for QS firms, developers, lenders and insurers. REST data API (authenticated, rate-limited, paid tier), quarterly construction cost index by region/trade, B2B subscriber portal, tiered subscription pricing, white-label PDF report generator ("East Midlands Construction Cost Report Q2 2026"), data consent audit confirming all benchmark data passes through the Sprint 41 consent gate.

### Sprint 48 — Native Mobile App
React Native (Expo) or PWA — technology decision first. Core on-site workflows: log cost (all 5 types), view project P&L, raise variation, check invoice status. Camera receipt capture (photo → Supabase Storage → cost entry). Push notifications for overdue payments and variation decisions. Offline mode with local queue (SQLite). Biometric auth. App Store and Google Play submission.

### Sprint 49 — Regional Pricing Intelligence + Merchant Procurement Layer
Regional rate benchmarks surfaced to contractors with percentile positioning and rate adjustment suggestions. Travis Perkins, Jewson and Selco integrations for live materials pricing linked to estimate lines — one-click order basket with pre-filled quantities, Constructa group pricing, delivery tracking auto-logged as cost entries, merchant analytics and referral fee model for admin.

### Sprint 50 — Resource Planning & Staff Allocation
Cross-project resource management — lets contractors see whether they have the people available to deliver their pipeline. Solves over-committing labour across overlapping projects and surfaces conflicts before they become on-site crises.

Staff allocation calendar (per person, per project), cross-project Gantt overlay, resource availability calculator (free days vs contracted days), red flag alerts for over-allocation, holiday and absence register (planned leave blocks availability automatically), demand vs supply aggregate view, under-resourcing alerts where allocated days fall short of estimated manhours, subcontractor slot allocation, weekly resource schedule export (PDF/CSV).

### Sprint 47 — In-App CAD / BIM / SketchUp Viewer *(Strategic moat — confirmed by owner, 6 April 2026)*
Embed a browser-native drawing viewer supporting the main construction file formats, giving contractors
basic measurement and markup capability inside Constructa without switching to external tools.

**Phase 1 — View & Measure:**
- DWG/DXF viewer via open-source or licensed renderer (options: `OpenLayers + ol-plot`, Autodesk Platform Services viewer, or `@dxfom/dxf-viewer`)
- Revit (IFC export) viewer via `web-ifc-viewer` or `IfcOpenShell-web`
- SketchUp (GLTF/OBJ export) via Three.js or Babylon.js
- PDF drawing viewer (building on Sprint 25 PDF.js foundation) with scale detection and measurement overlay
- Linear and area measurement tools — click-to-measure with scale calibration

**Phase 2 — Markup & Takeoff:**
- Annotation layer (rooms, elements) persisted per drawing in `drawing_annotations` table
- AI-assisted element detection overlaid on viewer canvas
- One-click: annotated elements → estimate lines
- Drawing revision comparison (highlight changes between Rev A and Rev B)

**Strategic rationale:** No other SME contractor tool offers in-app drawing measurement. This closes the loop between "what the client has sent" and "what goes into the estimate" without the contractor ever leaving Constructa. Significant moat against competitors.

**Tech stack decision needed before build:** Evaluate Autodesk Platform Services (APS/Forge) vs open-source stack. APS supports DWG/RVT natively but has per-view pricing. Open source (web-ifc + dxf-viewer + Three.js) is free but requires more build effort and only works with open formats (IFC/DXF/GLTF).

### Deferred / Post-launch (not yet sprinted)
- Email/WhatsApp webhooks for cost capture (forward receipt → auto-log expense)
- AI image reading for receipts (parse uploaded invoice → auto-populate cost fields)
- Voice-to-proposal wizard
- Full responsive mobile pass (Sprint 17 prevents breakage; full pass later)
- Regional pricing intelligence (needs 50+ active users first)

---

## Known Bugs

- [ ] Address concatenation showing "18 Jackdaw DriveColchester," in About Us PDF (missing space/comma)
- [ ] About Us page has whitespace when MD message not set
- [ ] Programme: "From: From Brief" subtitle shows even when phases are from estimate lines
- [ ] Plant resource `calcPlantDailyChargeout` in log-cost-sheet doesn't yet branch on `rate_mode === "simple"` — simple-mode plant always shows £0 in the owned plant tab (plant_resources.daily_chargeout_rate exists in DB but `PlantResource` interface in log-cost-sheet.tsx is missing `rate_mode` and `daily_chargeout_rate` fields — same pattern as the staff fix in Sprint 16)

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

**Stage 1 (now):** SaaS subscription tool for UK SME contractors
**Stage 2:** Merchant procurement layer (Travis Perkins etc.) — group buying, price transparency
**Stage 3:** Financial infrastructure — contractor working capital, client property finance, escrow stage payments, accountancy software integration

Target: UK SME contractors £500k–£10m turnover
Entry hook: Proposal tool → win work faster with professional proposals
Key metric: First sent proposal under 10 minutes from signup
