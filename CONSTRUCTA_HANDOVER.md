# Constructa — Full Project Handover Document
**Last updated:** 5 April 2026 (end of Sprint 16)
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
        proposal/         ← Step 5: Proposal editor + PDF export
        billing/          ← Post-contract: invoicing
        variations/       ← Post-contract: scope changes
        p-and-l/          ← Job P&L dashboard (Sprint 14+)
          page.tsx         ← Server: fetches all data, computes KPIs
          client-pl-dashboard.tsx  ← Client: tabs (Overview/Budget/Costs/Invoices)
          log-cost-sheet.tsx       ← 5-tab cost logging dialog
          actions.ts               ← Server actions (logCostAction, deleteCostAction, etc.)
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

-- Estimating
estimates         — id, project_id, is_active, overhead_pct, profit_pct, risk_pct,
                    prelims_pct, discount_pct, total_cost

estimate_lines    — id, estimate_id, project_id, trade_section, description,
                    qty, unit, unit_rate, line_total, pricing_mode ('simple'|'buildup')

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

invoices          — id, project_id, invoice_number, type ('Interim'|'Final'),
                    amount, status ('Draft'|'Sent'|'Paid'), created_at

variations        — id, project_id, title, description, amount,
                    status ('Draft'|'Pending Approval'|'Approved'|'Rejected')

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
6. BILLING     → Interim/Final valuations, Draft→Sent→Paid tracking
7. VARIATIONS  → Scope changes, approval workflow, feeds into billing
8. JOB P&L     → Real-time financial position per project + portfolio view
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
  Programme       /dashboard/projects/schedule?projectId=X
  Contracts       /dashboard/projects/contracts?projectId=X
  Proposal        /dashboard/projects/proposal?projectId=X
  ── divider ──
  Cost Library    /dashboard/library

LIVE PROJECTS
  Overview        /dashboard/live
  Job P&L         /dashboard/projects/p-and-l?projectId=X
  Billing         /dashboard/projects/billing?projectId=X
  Variations      /dashboard/projects/variations?projectId=X
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
- Vision Takeoff: upload floor plan → AI extracts items/quantities → one-click add to estimate

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

> ⚠️ **Sprint numbering note (5 April 2026):** Sprints 15 and 16 above are NEW sprints inserted between the original Sprint 14 (P&L) and the originally planned Sprint 15 (UI/UX Consistency Pass). All downstream sprints shift +2. Original roadmap end: Sprint 41. Corrected total: **Sprint 43**.

---

## Sprint Backlog — Complete Roadmap (Sprints 15–43)

### Sprint 17 — UI/UX Consistency Pass
Every page to the Contract Shield / Job P&L dark-theme standard. Currently Brief, Estimating, Programme, Profile and Proposal editor lag behind significantly.
- Audit every dashboard page against the Contracts/Overview benchmark
- Consistent dark-slate base: `bg-slate-900` pages, `bg-slate-800/50` cards, `border-slate-700`
- Hero/identity block on every major section (icon + title + subtitle + AI badge where applicable)
- Tab bars, button styles, input styles unified across all pages
- Typography scale consistent — headings, labels, helper text all matching
- Empty states on every list/table (not just blank space)
- Loading states: spinners/skeletons where AI calls take time
- Mobile: nothing broken on a phone (full responsive is a later sprint)
- Priority pages: Brief → Estimating → Programme → Profile/Settings → Proposal editor

### Sprint 18 — Pre-Construction Workflow Polish
The 5-step workflow functions but doesn't flow end-to-end correctly. Data from earlier steps doesn't reliably pull through to the Proposal.
- Brief → Proposal: audit what scope flows through and what gets lost
- Estimate → Proposal PDF: verify all section totals, line items, payment schedule render correctly
- Programme → Proposal PDF: confirm programme_phases always renders, fallback works
- Contracts → Proposal PDF: T&C tier, exclusions, clarifications, risk register all correct
- Profile → Proposal PDF: logo, capability statement, MD message, case studies — full end-to-end test
- Proposal editor UX: section-by-section review — editable vs auto-populated vs missing
- Full end-to-end test: new project → all 5 steps → PDF → document any gaps
- AI suggestions: each step should have AI assistance matching the quality of Brief/Contracts

### Sprint 19 — Gantt Drag-and-Drop & Programme Polish
- Drag bars left/right to adjust start offset (sequencing)
- Drag right edge to resize duration
- Dependencies: Finish-to-Start linking between phases (visual connector lines)
- Snap to week grid
- Critical path highlight — longest chain
- Programme summary: total duration, key milestones, auto-updated on drag
- Export to PDF reflects drag-adjusted programme

### Sprint 20 — Constructa Admin Dashboard Phase 1
- Protected route (`/admin`) — service role key, separate from contractor auth
- Subscriber list: name, signup date, plan, last active, project count
- Revenue estimate (MRR/ARR based on subscriber count × plan price)
- Usage stats: proposals sent, estimates created, contracts reviewed
- Platform health: DB size, API call counts, error rates

### Sprint 21 — Proposal Versioning
- Up-rev proposals (v1, v2, v3) with change tracking
- Discount feature already built — versioning enables tracking discounts per revision
- Show diff between versions (what changed in scope/price)

### Sprint 22 — Billing Module Polish
- Already functionally built — needs connecting to payment stages from Proposal
- Programme → Billing milestone automation (phases → payment schedule)
- Application for Payment form with retention calc

### Sprint 23 — Drawing Upload & AI Takeoff (Headline Feature)
- Promote Vision Takeoff from buried button to headline feature
- Annotation overlay on uploaded drawings
- Multi-page PDF support, scale detection
- Drawing register (store multiple drawings per project)
- Add to marketing site hero

### Sprint 24 — Video Walkthrough AI
- Upload site survey video → GPT-4o Vision processes frames
- Extracts rooms/areas/scope items, maps to cost library
- Generates site survey report PDF, pre-fills Brief scope

--- BATCH 1 COMPLETE — LAUNCH POINT (Sprints 14–24) ---

### Sprint 25 — Live Projects: Overview
Project health dashboard for on-site delivery — budget RAG, programme %, outstanding invoices, quick-action buttons.

### Sprint 26 — Live Projects: Cost Tracking
Log actual costs vs estimate sections in real time. Committed costs, forecast final, over-budget alerts.

### Sprint 27 — Live Projects: Billing & Valuations
Payment schedule from Proposal, Application for Payment form, retention ledger, overdue alerts, formal PDF.

### Sprint 28 — Live Projects: Variations
Raise/price/approve variations, client approval tracking, variation log, Final Account incorporation, formal PDF.

### Sprint 29 — Live Projects: Programme (Live Tracking)
Planned vs actual Gantt, % complete per phase, delay recording, EOT log, early warning notices, AI weekly update narrative.

### Sprint 30 — Live Projects: Communications
Site instruction log, RFI tracker, Early Warning Notices, formal letter templates, document register (timestamped, non-editable).

--- BATCH 2 COMPLETE — LIVE PROJECTS RELEASE (Sprints 25–30) ---

### Sprint 31 — Closed Projects: Final Accounts
Final Account summary, retention release tracker, agreement status, disputed amounts, formal PDF for client signature.

### Sprint 32 — Closed Projects: Handover Documents
Document pack builder (O&Ms, warranties, test certs, as-builts), client handover portal, Defects Liability Period tracker.

### Sprint 33 — Closed Projects: Archive
Project archiving, search, key data preserved, reuse estimate from archive, "Similar projects" matching for new bids.

### Sprint 34 — Closed Projects: Lessons Learned
Structured retrospective, AI analysis (estimated vs actual margin, programme vs actual), insight cards, win/loss analysis, feeds cost library rate suggestions.

--- BATCH 3 COMPLETE — CLOSED PROJECTS RELEASE (Sprints 31–34) ---

### Sprint 35 — Data Foundation
Pure database migration — no changes to contractor-facing app. Creates the anonymised
aggregation layer that makes cross-contractor intelligence possible.

Benchmark tables (no RLS, service-role only, no PII): `project_benchmarks`, `rate_benchmarks`,
`labour_benchmarks`, `plant_benchmarks`, `material_benchmarks`, `programme_benchmarks`,
`variation_benchmarks`, `contract_risk_benchmarks`. Supabase triggers fire on project close /
invoice paid / variation approved to populate tables. GDPR consent gate (`contractors.data_consent`)
added to onboarding and Settings before any trigger writes fire.

### Sprint 36 — Admin Dashboard Phase 2
Superadmin tooling for Constructa staff only — not visible to contractors. Data intelligence
explorer, benchmark browser, market rate maps (choropleth by region/trade), anonymous percentile
positioning, platform analytics (MAU/DAU/proposals), churn prediction, at-risk account scoring,
feature usage heatmap.

### Sprint 37 — Contractor Management Accounts
Consolidated financial view across all of a contractor's projects — the equivalent of a
management accounts pack generated automatically from Constructa data. Consolidated P&L,
cash flow forecast (projected inflows vs committed outflows), WIP schedule, overhead absorption
report, year-to-date summary by month, per-project comparison table, PDF and CSV export,
financial year / calendar year / custom date range filter.

### Sprint 38 — Xero Integration
OAuth2 connection flow → push invoices on send → pull payment status daily → push expenses on
cost log → trade section to Xero tracking category mapping (configurable) → sync log with retry
→ disconnect/reconnect without losing history.

### Sprint 39 — QuickBooks / Sage Integration
Same OAuth2 push/pull pattern extended to QuickBooks Online and Sage Business Cloud — the two
next most common accounting packages for UK SME contractors. Single unified sync settings page
covers all three integrations (Xero / QuickBooks / Sage), one active at a time, with field mapping
UI per platform and a sync health indicator (last synced, error count, items pending).

### Sprint 40 — Accounting Phase 2: Reconciliation
Bank feed import (CSV or Plaid open banking), transaction parser, auto-match bank transactions to
Constructa invoices by amount + reference, manual match for unmatched items, reconciliation
dashboard, VAT return preparation grouped by VAT period, MTD-compatible CSV export for HMRC
Making Tax Digital, full audit trail of every match/unmatch.

### Sprint 41 — Market Intelligence Product
Constructa's benchmark data as a sellable B2B data product for QS firms, developers, lenders
and insurers. REST data API (authenticated, rate-limited, paid tier), quarterly construction cost
index by region/trade, B2B subscriber portal, tiered subscription pricing, white-label PDF report
generator ("East Midlands Construction Cost Report Q2 2026"), data consent audit confirming all
benchmark data passes through the Sprint 35 consent gate.

### Sprint 42 — Native Mobile App
React Native (Expo) or PWA — technology decision first. Core on-site workflows: log cost (all 5
types), view project P&L, raise variation, check invoice status. Camera receipt capture (photo →
Supabase Storage → cost entry). Push notifications for overdue payments and variation decisions.
Offline mode with local queue (SQLite). Biometric auth. App Store and Google Play submission.

### Sprint 43 — Regional Pricing Intelligence + Merchant Procurement Layer
Regional rate benchmarks surfaced to contractors with percentile positioning and rate adjustment
suggestions. Travis Perkins, Jewson and Selco integrations for live materials pricing linked to
estimate lines — one-click order basket with pre-filled quantities, Constructa group pricing,
delivery tracking auto-logged as cost entries, merchant analytics and referral fee model for admin.

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
