# Constructa — Full Project Handover Document
**Last updated:** 3 April 2026  
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
| Supabase project ref | `[SEE .env.local — SUPABASE_PROJECT_REF]` |
| Supabase access token | `[SEE .env.local — SUPABASE_ACCESS_TOKEN]` |
| Vercel project | `[SEE .env.local — VERCEL_PROJECT_ID]` |
| Vercel team | `[SEE .env.local — VERCEL_TEAM_ID]` |
| OpenAI | `OPENAI_API_KEY` env var in Vercel (project level) — uses `gpt-4o-mini` |
| Git user email | `perplexity-computer@constructa.co` |
| Git user name | `Perplexity Computer` |

**Always run before committing:**
```bash
git config user.email "perplexity-computer@constructa.co"
git config user.name "Perplexity Computer"
```

**Push Supabase migrations:**
```bash
SUPABASE_ACCESS_TOKEN=$SUPABASE_ACCESS_TOKEN supabase db push --linked --yes
```

---

## Architecture

```
src/
  app/
    (marketing)/          ← Landing pages — DO NOT TOUCH
    dashboard/
      page.tsx            ← CRM dashboard
      layout.tsx          ← ThemeProvider + DashboardShell
      projects/
        new/              ← New project wizard (2 steps: details → create)
        brief/            ← Step 1: AI-powered project brief
        costs/            ← Step 2: Full BoQ estimating tool
        schedule/         ← Step 3: Programme / Gantt
        contracts/        ← Step 4: T&Cs, risk register, AI contract review
        proposal/         ← Step 5: Proposal editor + PDF export
        billing/          ← Post-contract: invoicing
        variations/       ← Post-contract: scope changes
      settings/
        profile/          ← Company profile, MD message, theme
        case-studies/     ← Case studies management
      library/            ← Cost library browser
      resources/          ← Labour rate management
  components/
    sidebar-nav.tsx       ← Main left sidebar
    project-navbar.tsx    ← Per-project top tabs (Brief→Estimating→Programme→Contracts→Proposal)
    dashboard-shell.tsx   ← Theme-aware wrapper
  lib/
    ai.ts                 ← OpenAI utility: generateText(), generateJSON<T>()
    theme-context.tsx     ← ThemeProvider + useTheme() hook
    supabase/             ← Supabase client helpers
```

---

## Database Schema (key tables)

```sql
profiles          — company info, logo, md_message, md_name, pdf_theme, preferred_trades, capability_statement
projects          — all project data including:
                    name, client_name, site_address, postcode, lat, lng, region
                    project_type, client_type, start_date, potential_value
                    brief_scope, brief_trade_sections, brief_completed
                    proposal_introduction, scope_text, exclusions, clarifications
                    contract_exclusions, contract_clarifications, tc_tier
                    risk_register (JSONB), contract_review_flags (JSONB)
                    programme_phases (JSONB)  ← saved by Programme tab
                    timeline_phases (JSONB)   ← legacy field, use programme_phases
                    payment_schedule (JSONB), payment_schedule_type
                    closing_statement, discount_pct, discount_reason
                    selected_case_study_ids (JSONB)
                    uploaded_contract_text, uploaded_contract_url
estimates         — overhead_pct, profit_pct, risk_pct, prelims_pct (all default 10/15/5/10)
                    is_active (only 1 active estimate feeds the proposal PDF)
estimate_lines    — trade_section, description, qty, unit, unit_rate, pricing_mode ('simple'|'buildup')
estimate_line_components — component_type ('labour'|'plant'|'material'|'consumable'|'temp_works'|'subcontract')
                           qty, unit, unit_rate, manhours_per_unit, total_manhours
labour_rates      — trade, role, day_rate, region, is_system_default
cost_library_items — code, description, unit, base_rate, category, is_system_default
rate_buildups     — saved first-principles rate build-ups (org + system library)
```

---

## Workflow: How the product works

A contractor creates a project and works through 5 tabs:

```
1. BRIEF       → Describe project via AI chat → scope auto-populated → AI suggests estimate lines
2. ESTIMATING  → Full BoQ: trade sections, line items, rate build-up (L+P+M+C per item)
                 Cost hierarchy: Direct Cost → Prelims(10%) → Overhead(10%) → Risk(5%) → Profit(15%)
                 Margins are NEVER shown to client — all-in rates only in PDF
3. PROGRAMME   → Auto-generates Gantt from estimate manhours → contractor adjusts → saves to project
4. CONTRACTS   → Select T&C tier (Domestic/Commercial/Specialist) → AI risk register
                 → exclusions/clarifications → upload client contract for AI review → contract chatbot
5. PROPOSAL    → Pulls everything together automatically → generates PDF
```

**PDF structure (proposal-pdf-button.tsx):**
1. Cover page
2. About Us (company profile, MD message)
3. Case studies (selected, full page each)
4. Project Brief & Scope (two-column: overview left, scope bullets right)
5. Fee Proposal (section totals, margins hidden, TOTAL INC. VAT primary)
6. Project Timeline (Gantt from `project.programme_phases`)
7. Commercial Terms (exclusions left, clarifications right)
8. Risk & Opportunities (from `project.risk_register`)
9. Why Choose Us (closing statement + discount callout if applicable)
10. Acceptance / signature page

---

## Theme System

- `src/lib/theme-context.tsx` — `ThemeProvider` + `useTheme()` hook
- `"system-c"` (default): dark sidebar `#0d0d0d`, white content
- `"dark"`: full dark mode using `#0d0d0d / #1a1a1a / #2a2a2a`
- Marketing site palette: `#0D0D0D` primary, `#1A1A1A` card, `#2A2A2A` border, `#A0A0A0` muted

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
Model: `gpt-4o-mini` via `OPENAI_API_KEY` env var.

AI features currently built:
- Brief AI chat assistant (populates project fields from natural language)
- Scope bullet extraction (5-7 bullets from scope text)
- AI line item suggestions from brief → creates estimate lines
- Introduction / scope AI rewrite
- AI clarifications and exclusions suggestions
- Contract risk analysis (upload T&Cs → AI flags onerous clauses)
- Contract chatbot (risk awareness, not legal advice)
- Risk & opportunities register generation
- Closing statement generation
- Case study AI enhancement
- MD message AI rewrite
- Proposal full generation (intro + scope + exclusions + clarifications)

---

## Estimating Tool — Key Details

**Cost library:** 833 items across 60 trades in `cost_library_items`
**Labour rates:** 260 roles across 60 trades in `labour_rates`
**Plant rates:** 156 items in `cost_library_items` where `category = 'Plant'`
**Consumables:** 46 items in `cost_library_items` where `category = 'Consumables'`

**Rate build-up:** Each estimate line can be in `'simple'` (single rate) or `'buildup'` mode.
Build-up components are in `estimate_line_components` with:
- `component_type`: labour | plant | material | consumable | temp_works | subcontract
- Labour: auto-fills from `labour_rates` table, has `manhours_per_unit` field
- Plant: auto-fills from `PLANT_RATES` constant + DB plant items
- Material: searchable datalist from `cost_library_items` (filtered to raw materials only)
- Rate conversion: day↔week (×5), day↔hr (×8) for labour and plant

**Manhours → Programme:** Labour component `total_manhours` feeds Programme tab auto-generation.

---

## Sidebar Navigation Structure

```
COMPANY PROFILE
  Profile         /dashboard/settings/profile
  Case Studies    /dashboard/settings/case-studies
  Setup Wizard    /onboarding?force=true

WORK WINNING
  Dashboard       /dashboard
  New Project     /dashboard/projects/new

PRE-CONSTRUCTION
  Brief           /dashboard/projects/brief
  Estimating      /dashboard/projects/costs
  Programme       /dashboard/projects/schedule
  Contracts       /dashboard/projects/contracts
  Proposal        /dashboard/projects/proposal
  ── divider ──
  Cost Library    /dashboard/library
  Resources       /dashboard/resources

LIVE PROJECTS
  Overview        /dashboard/live  (placeholder)
  Finance         disabled
  Programme       disabled
  Change Mgmt     disabled
  Billing         disabled
  Variations      disabled

POST-CONSTRUCTION
  Close-Out       disabled
  Final Account   disabled
  Handover Docs   disabled
  Records         disabled
```

---

## Already Built (more than the backlog implies)

- **Billing module** — fully functional: interim/final valuations, Draft→Sent→Paid status tracking, PDF export, percentage or flat-rate billing methods
- **Variations module** — fully functional: logging, approval workflow, approved total flows into billing's revised contract sum
- **Vision Takeoff (AI Drawing Scan)** — already built: upload floor plan or sketch, AI extracts item names and quantities, one-click add to estimate. Currently in the foundations/brief page — needs promoting to a headline feature
- **Critical Path Gantt** — more sophisticated than it looks: genuine forward-pass algorithm with iterative dependency resolution

---

## Sprint Backlog (priority order)

### CURRENT: Finish pre-construction workflow
- Fix remaining data flow issues (Brief→Estimate, address pre-fill etc.)
- Ensure all five tabs work reliably end-to-end

### Sprint 12 — Client Portal (HIGHEST PRIORITY)
- Shareable proposal URL (constructa.co/proposals/abc123)
- Proposal renders beautifully in-browser (not just PDF download)
- "Accept this Proposal" button — name, digital signature, date
- Contractor notified when viewed and when accepted
- Accepted status flows back into project, unlocking billing module
- One-click email send from within Constructa
- Proposal status tracking: sent → viewed → accepted → declined

### Sprint 13 — Contract Shield
- Polish the AI contract review (upload PDF → AI flags clauses as Red/Amber/Green)
- Red = walk away, Amber = negotiate, Green = acceptable
- Plain English explanations for each flagged clause
- Contract chatbot: "what does this clause mean in practice?"
- Market as "The Contract Shield" — promote as a named feature

### Sprint 14 — Programme → Billing Milestone Automation
- Programme phases automatically populate payment milestones in billing module
- Payment schedule tied to programme milestones (protects contractors when invoicing)
- Connects the golden thread: Estimate → Programme → Billing

### Sprint 15 — Job P&L Dashboard
- Live project P&L: original estimate margin, approved variations, invoiced to date, costs logged, projected final margin
- Single view answering "which of my current jobs are making money?"
- No other SME contractor tool currently provides this

### Sprint 16 — Proposal Versioning + Status Tracking
- Up-rev proposals (v1, v2, v3) with change tracking
- Proposal status visible on dashboard

### Sprint 17 — Promote Vision Takeoff to Headline Feature
- Move from buried button to prominent onboarding feature
- Add to hero section of marketing site
- First-time tooltip in estimating
- Demo flow centres around it

### DEPRIORITISED (do after launch with real user data)
- Gantt drag-and-drop and logic links (SS/FS) — not painful enough to sprint now
- Mobile responsive pass — do post-launch based on real usage patterns  
- Regional pricing intelligence — too risky without real transaction data to back it
- Voice-to-proposal wizard — Brief AI chat covers same intent; keep in long-term vision

### LONG-TERM VISION (V2+)
- Native mobile app + voice site walkthrough ("walk the site, talk to the app")
- Video walkthrough AI (GPT-4o Vision reads site video)
- Merchant procurement layer (Travis Perkins partnership)
- Financial infrastructure (escrow, contractor lending, client property finance)
- Accountancy software integration

### KNOWN BUGS
- [ ] Address concatenation still showing "18 Jackdaw DriveColchester," in About Us PDF (company address, not project address)
- [ ] About Us page has whitespace when MD message not set
- [ ] Programme: "From: From Brief" subtitle shows even when phases are from estimate

---

## Target User Profile — "Dave"

UK SME contractor, £1-3m turnover, 5-8 subcontractors, does extensions/loft conversions/commercial fit-outs.

Dave's problems in order of pain:
1. Doesn't get paid on time — clients dispute invoices, go quiet
2. Signs contracts he doesn't understand — gets hammered by unfair clauses  
3. Doesn't know if he's making money mid-job — finds out too late
4. Spends 4+ hours pricing jobs he doesn't win
5. Proposals look amateur — Word docs with no branding

Constructa currently solves problems 4 and 5 brilliantly.
Problems 1, 2, and 3 are the next frontier (Sprints 12-15).

Key metrics that matter:
- First proposal sent within 10 minutes of signup
- Proposals that result in client acceptance through the platform (needs portal)
- Jobs where billing is managed through Constructa (retention + data flywheel)

---

## Product Vision (for context)

**Stage 1 (now):** SaaS subscription tool for UK SME contractors  
**Stage 2:** Merchant procurement layer (Travis Perkins etc.) — group buying, price transparency  
**Stage 3:** Financial infrastructure — contractor working capital, client property finance, escrow stage payments, accountancy software  

Target customer: UK SME contractors £500k–£10m turnover  
Entry hook: Proposal tool → win work faster with professional proposals  
Key metric: First sent proposal under 10 minutes from signup  

Monetisation tiers (planned):
- Free: 3 proposals/month, watermarked
- Pro £49/month: unlimited, all AI, estimating, Gantt
- Business £99/month: multiple users, custom branding, contract review AI

---

## Important Rules

1. **NEVER modify `src/app/(marketing)/`** — that's the constructa.co landing page
2. **Always run `npx tsc --noEmit`** before committing — 0 errors required
3. **No `revalidatePath` in estimating actions** — breaks optimistic UI state
4. **PDF margins are NEVER shown to client** — all-in rates only (overhead/profit/risk baked in)
5. **Use `gpt-4o-mini` only** for all AI — no other models
6. **Supabase migrations** — always create a new file in `supabase/migrations/` with timestamp prefix
7. **RLS** — all new tables need RLS enabled + policies for `organization_members` join or `user_id` direct check
