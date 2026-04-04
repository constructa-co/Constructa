# Constructa — Claude Code Project Context

> This file is auto-loaded by Claude Code at session start.
> Read this before making any changes to the codebase.
> Last updated: 4 April 2026 — Claude Code session (evening)
> Previous sessions: Perplexity Computer (morning, commits 0c7c830→1790fbd)

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

## PDF Fixes Applied (April 4 — commit d833388 + a8d6511)

1. **Gantt dedicated page** — Gantt chart always gets its own full page (`doc.addPage()`). Previously shared a page with Fee Proposal and was squeezed. Row height 11→13mm, header 14→16mm, label col 55→60mm, max weeks 20→26.
2. **Commercial Terms y-sync** — `y = Math.max(termLeftY, termRightY) + 6` added after `tcClauses.forEach`. Previously the closing statement rendered on top of the T&C columns.
3. **Theme fresh-fetch** — PDF button now fetches fresh `profile` from Supabase at click time (commit a8d6511). All three themes (Slate/Navy/Forest) confirmed generating distinct colour outputs.

---

## Sprint Backlog (priority order)

### IMMEDIATE — Bug fixes (do these first)
- [ ] **BUG-001** Fix duplicate `md_name` input in profile-form.tsx line 615
- [ ] **BUG-003** Investigate and fix wrong company name ("Tripod Construction Ltd") in proposal editor banner
- [ ] **BUG-004** Fix PDF download to use `<a download>` instead of `window.open()` (popup blocker bypass)
- [ ] **BUG-002** Add "link not active yet" UX when proposal_token not generated

### Sprint 12 — Close the Loop (NEXT after bugs)
- [ ] Viewed tracking — notify contractor when client opens the proposal link
- [ ] Acceptance notification to contractor (email or in-app notification)  
- [ ] Project status updates on dashboard/pipeline when proposal accepted
- [ ] Email send from within Constructa (currently: copy link, paste in email)
- [ ] Email confirmation sent to client on acceptance (Supabase email or Resend.com)

### Sprint 13 — Contract Shield Polish
- [ ] Contract Shield flagging calibrated (done) — needs real-world testing
- [ ] Dismiss/accept flags stores to DB correctly
- [ ] Upload PDF contracts — text extraction for AI analysis
- [ ] Market as named feature "Contract Shield" on the proposal page

### Sprint 14 — Home Dashboard Improvements
- [ ] Win rate calculation needs proposal_status tracking to be reliable
- [ ] Outstanding invoices KPI needs billing module to be wired
- [ ] Activity feed: add colour-coded status pills
- [ ] "Expiring soon" alert for proposals nearing their validity date

### Sprint 15 — Job P&L Dashboard
- [ ] Live project P&L: original estimate margin vs costs logged
- [ ] Which jobs are making money (most important question for "Dave")
- [ ] Connects billing module (invoiced) to estimate (budgeted)

### Sprint 16 — Proposal Versioning
- [ ] Up-rev proposals (v1, v2, v3) with change tracking
- [ ] Discount feature already built — versioning enables tracking discounts per revision

### Sprint 17 — Billing Module Polish
- [ ] Already functionally built — needs connecting to payment stages from Proposal
- [ ] Programme → Billing milestone automation (phases → payment schedule)

### Sprint 18 — Vision Takeoff Promotion
- [ ] Wired into Brief tab as a primary workflow option
- [ ] Demo on marketing site hero section
- [ ] Library rate matching already built

### DEPRIORITISED (post-launch with real user data)
- Gantt drag-and-drop / SS-FS dependencies
- Mobile responsive pass
- Regional pricing intelligence (needs real transaction data first)
- Voice-to-proposal wizard

### LONG-TERM VISION (V2+)
- Native mobile app + site walkthrough voice wizard
- Video walkthrough AI (GPT-4o Vision reads site video)
- Merchant procurement layer (Travis Perkins partnership)
- Financial infrastructure: escrow stage payments, contractor lending, client property finance
- Accountancy integration
- Staff financial products

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
