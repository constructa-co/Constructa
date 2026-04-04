# Constructa — Claude Code Project Context

> This file is auto-loaded by Claude Code at session start.
> Read this before making any changes to the codebase.
> Last updated: 4 April 2026 — Claude Code session (night, Contract Shield sprint)
> Previous sessions: Claude Code (evening), Perplexity Computer (morning, commits 0c7c830→1790fbd)

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

## Session Work Log (April 4 — Contract Shield sprint, commits 5877c6e→39c97ad)

### ⚠️ OUTSTANDING — Verify "Build Contractor Response" works after latest fix

**Commit 39c97ad** (last push tonight) is not yet confirmed working by user.
The fix converts clause parsing from two sequential AI calls → one combined call.
User must test "Build Contractor Response" on the deployed app to confirm resolved.
If still failing, check Vercel function logs for timeout or AI errors.

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

## Sprint Backlog (priority order)

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

### Sprint 13 — Contract Shield Polish — ✅ COMPLETE (pending clause-parsing confirm)
- [x] PDF/DOCX text extraction (unpdf + mammoth, server-side)
- [x] Full contract analysis — parallel 40k-char chunks, not just first 4k
- [x] Dark theme + "Contract Shield" branding with hero section
- [x] Flags → Risk Register one-click import (pre-filled mitigations)
- [x] Flags → Exclusions AI (contextual, not generic)
- [x] All data persists to project (flags, risks, exclusions, clauses)
- [x] Client Contract 4th tier — parse → Accept/Modify/Reject → download formal PDF response
- [x] Toaster fix — ALL dashboard toasts now work (was broken silently)
- [x] Whitespace sanitisation fix — preserves clause structure for AI
- [⚠️] "Build Contractor Response" clause parsing — fix pushed (39c97ad), NOT YET CONFIRMED WORKING
  - Root cause: two sequential AI calls timing out → single-pass fix pushed
  - If still failing next session: check Vercel function logs, consider adding `export const maxDuration = 60` to the contracts page

### Sprint 14 — Job P&L Dashboard — NEXT SPRINT
- [ ] Live project margin: original estimate vs actual costs logged
- [ ] Which jobs are making money — the #1 question for "Dave"
- [ ] Connects billing module (invoiced) to estimate (budgeted)
- [ ] Over-budget alert when costs exceed estimate section by >10%
- [ ] Margin-at-completion forecast from spend-to-date rate

### Sprint 15 — UI/UX Consistency Pass — HIGH PRIORITY
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

### Sprint 16 — Pre-Construction Workflow Refinement
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

### Sprint 17 — Gantt Drag-and-Drop & Programme Polish
**Elevated from deprioritised — important to product quality.**
The Programme tab is a core part of the pre-construction workflow and contractors expect
to be able to adjust their programme interactively, not just via number inputs.

- [ ] Drag bars left/right to adjust start offset (sequencing)
- [ ] Drag right edge to resize duration
- [ ] Dependencies: simple Finish-to-Start linking between phases (visual connector lines)
- [ ] Snap to week grid
- [ ] Keyboard accessibility (arrow keys to nudge)
- [ ] "Critical path" highlight — identify the longest chain
- [ ] Programme summary: total duration, key milestones, auto-updated on drag
- [ ] Export to PDF reflects drag-adjusted programme (reads programme_phases)

### Sprint 18 — Proposal Versioning
- [ ] Up-rev proposals (v1, v2, v3) with change tracking
- [ ] Discount feature already built — versioning enables tracking discounts per revision
- [ ] Show diff between versions (what changed in scope/price)

### Sprint 19 — Billing Module Polish
- [ ] Already functionally built — needs connecting to payment stages from Proposal
- [ ] Programme → Billing milestone automation (phases → payment schedule)

### Sprint 20 — Vision Takeoff Promotion
- [ ] Wired into Brief tab as a primary workflow option (not hidden)
- [ ] Demo on marketing site hero section
- [ ] Library rate matching already built — just needs surfacing

---

## LIVE PROJECTS MODULE (Sprints 21–26)
> All currently showing "Coming Soon" in sidebar. These are the post-contract delivery phase.
> This is the module that solves Dave's #1 pain point: not knowing if he's making money mid-job.
> Sequencing note: Sprint 14 (P&L) lays the data foundations these sprints build on.

### Sprint 21 — Live Projects: Overview
The command centre for a project once it's on site. Replaces the "Coming Soon" placeholder.
- [ ] Project health dashboard: budget RAG status, programme % complete, outstanding invoices
- [ ] Key dates strip: start date, planned completion, weeks remaining, any EOT claimed
- [ ] Quick-action buttons: raise variation, submit application, log cost, update programme
- [ ] Links to all Live Projects sub-modules from one screen
- [ ] Status banner: on programme / at risk / delayed (AI-suggested based on data)

### Sprint 22 — Live Projects: Cost Tracking
Connects to the estimate — tracks actual spend vs budget in real time.
- [ ] Log actual costs against estimate trade sections (labour, plant, materials per section)
- [ ] Budget vs actual bar chart per trade section
- [ ] Committed costs (orders placed, not yet invoiced)
- [ ] Forecast final cost: actual + committed + estimated remaining
- [ ] Over-budget alerts: flag sections >10% over estimate
- [ ] Cost approval workflow: costs above a threshold require confirmation before logging
- [ ] Links to billing module so invoiced amounts net off costs automatically

### Sprint 23 — Live Projects: Billing & Valuations
Currently functionally built — needs polish, connection to proposal, and live data wiring.
- [ ] Payment schedule pulled from Proposal (milestone or % stage payments)
- [ ] Application for Payment form: cumulative valuation, retention calc, net amount due
- [ ] Payment certificate tracking: issue date, due date, final date for payment, Pay Less Notice window
- [ ] Overdue payment alerts: flag when payment date passes without receipt
- [ ] Retention ledger: amount held, release dates (practical completion + defects)
- [ ] PDF: formal Application for Payment document matching Constructa brand standard

### Sprint 24 — Live Projects: Variations
Currently functionally built — needs polish and proper workflow.
- [ ] Raise variation: scope description, reason (client instruction / design change / unforeseen)
- [ ] Pricing: pulls from cost library / rate buildups / manual entry
- [ ] Status workflow: Draft → Submitted → Approved → Rejected → Disputed
- [ ] Client approval tracking: sent date, approved date, approved by
- [ ] Variation log: running total of approved vs pending vs disputed variations
- [ ] Incorporation into Final Account automatically
- [ ] PDF: formal Variation Order document

### Sprint 25 — Live Projects: Programme (Live Tracking)
Separate from the pre-construction Programme tab — this tracks actual vs planned on site.
- [ ] Planned vs actual Gantt: original programme bars vs actual progress bars
- [ ] % complete per phase (contractor updates weekly)
- [ ] Delay recording: cause, days lost, responsible party (client/contractor/neutral)
- [ ] Extension of Time log: claimed, agreed, outstanding
- [ ] Early warning notices: flag delays before they become disputes
- [ ] Programme narrative: AI-drafted weekly site update text based on % complete inputs

### Sprint 26 — Live Projects: Communications
Formal construction communication log — critical for dispute avoidance.
- [ ] Site instruction log: numbered, dated, description, issued by
- [ ] RFI (Request for Information) tracker: raised, responded, outstanding
- [ ] Early Warning Notices: log + PDF generation
- [ ] Letters/formal notices: templates for Pay Less Notice response, termination, extension claims
- [ ] Document register: upload and tag site photos, drawings, reports to the project
- [ ] All communications timestamped and non-editable once issued (audit trail)

---

## CLOSED PROJECTS MODULE (Sprints 27–30)
> All currently showing "Coming Soon" in sidebar.
> This is the retrospective and handover phase — closes the loop on a project financially and operationally.

### Sprint 27 — Closed Projects: Final Accounts
- [ ] Final Account summary: original contract sum + approved variations + agreed adjustments
- [ ] Retention release tracker: half on PC, half on defects expiry — with dates
- [ ] Final Account agreement status: draft → submitted → agreed → signed
- [ ] Any disputed amounts: log and status
- [ ] PDF: formal Final Account Statement document for client signature
- [ ] Link back to billing: confirm all applications reconcile to Final Account total

### Sprint 28 — Closed Projects: Handover Documents
- [ ] Document pack builder: O&M manuals, warranties, test certificates, as-built drawings
- [ ] Checklist: which documents are required vs received vs outstanding
- [ ] Upload and tag documents to the handover pack
- [ ] Client-facing handover portal: share link so client can access their documents (no auth required)
- [ ] Defects Liability Period tracker: start date, end date, items logged, items resolved
- [ ] PDF: Handover Certificate with document list and DLP dates

### Sprint 29 — Closed Projects: Archive
- [ ] Project archiving: move from active to closed with one action
- [ ] Archived project search: find by client, project type, value, year, region
- [ ] Key data preserved: final contract value, margin achieved, duration, client rating
- [ ] Reuse: copy estimate from archived project as starting point for new similar project
- [ ] "Similar projects" matching: when pricing a new job, surface archived projects of same type/value

### Sprint 30 — Closed Projects: Lessons Learned
Turns project data into business intelligence — the flywheel that improves every future bid.
- [ ] Structured retrospective: what went well, what didn't, what to do differently
- [ ] AI analysis: compare estimated vs actual margin, programme vs actual duration, variation frequency
- [ ] Insight cards: "Your groundworks sections run 15% over estimate on average"
- [ ] Win/loss analysis: compare won vs lost proposals — price point, project type, client type
- [ ] Contractor performance data over time: margin trend, on-time delivery %, repeat client rate
- [ ] Feeds back to cost library: suggest rate adjustments where actuals consistently differ from estimates

---

### DEPRIORITISED (post-launch with real user data)
- Mobile responsive full pass (Sprint 15 prevents breakage; full pass later)
- Voice-to-proposal wizard
- SS-FS Gantt dependencies beyond Sprint 17 scope

---

## CONSTRUCTA DATA INTELLIGENCE ARCHITECTURE

### Current State — Honest Assessment
All contractor data is stored correctly but entirely siloed per-contractor via Supabase RLS (Row Level Security). Every table has `user_id` scoping — the owner cannot cross-query contractors using the normal client key. The geographic fields already exist on projects (`lat`, `lng`, `postcode`, `region`) but no cross-contractor aggregation exists yet.

**What is captured per-contractor today:**
- Project location: `postcode`, `lat`, `lng`, `region` ✓
- Project type, value, client type ✓
- Estimate rates: labour (day_rate), materials (unit_rate), trade sections ✓
- Manhours per task ✓
- Proposal win/loss outcome (`proposal_status`) ✓
- Programme duration per phase ✓
- Contract flags, T&C tier ✓
- (Future) Actual costs, invoiced amounts, final margin

**What is NOT captured yet (needs building):**
- No anonymised cross-contractor aggregate tables
- No mechanism to write to a platform intelligence layer as contractors complete work
- Labour rates are all tagged `region = 'national'` — no regional differentiation yet
- No data consent/transparency notice to contractors (legally required before aggregating)

### Architecture Required — Platform Intelligence Layer

**The mechanism:** When a contractor completes a project or closes a record, a Supabase database trigger (or server action) fires and writes an anonymised snapshot to a set of aggregate tables. No PII. No user_id. Just the signal data.

**Access:** These aggregate tables have NO RLS — they are readable only via the Supabase service role key, which is used exclusively by the Constructa admin backend (never exposed to contractors).

**Tables to create (Sprint 31):**

```sql
-- Anonymised project benchmark — one row per completed/closed project
project_benchmarks (
  id, created_at,
  project_type TEXT,           -- 'residential_extension', 'loft_conversion', etc.
  contract_value NUMERIC,      -- £ total
  region TEXT,                 -- 'London', 'South East', 'North West', etc.
  postcode_district TEXT,      -- First 3-4 chars only e.g. 'SW1', 'M14' (not full postcode)
  tc_tier TEXT,                -- 'domestic'|'commercial'|'specialist'|'client'
  duration_weeks INTEGER,      -- Actual programme weeks
  estimated_duration_weeks INTEGER,
  variation_count INTEGER,
  variation_value NUMERIC,
  estimated_margin_pct NUMERIC,
  actual_margin_pct NUMERIC,   -- NULL until costs logged
  proposal_win BOOLEAN,        -- TRUE if proposal_status = 'accepted'
  high_risk_flags INTEGER,     -- Contract Shield high severity count
  -- NO: user_id, client_name, contractor name, site address, project name
)

-- Rate benchmark — one row per estimate line item (anonymised)
rate_benchmarks (
  id, created_at,
  trade_section TEXT,          -- e.g. 'Groundworks', 'Carpentry'
  description TEXT,            -- line item description
  unit TEXT,
  sell_rate NUMERIC,           -- what contractor charged per unit
  cost_rate NUMERIC,           -- actual cost per unit (from cost tracking, if available)
  region TEXT,
  postcode_district TEXT,
  project_type TEXT,
  -- NO: user_id, project_id, client details
)

-- Labour rate benchmark — what contractors actually pay vs cost library
labour_benchmarks (
  id, created_at,
  trade TEXT,
  role TEXT,
  day_rate NUMERIC,            -- actual rate used on a project
  region TEXT,
  postcode_district TEXT,
  -- NO: user_id
)

-- Programme benchmark — actual vs estimated per phase type
programme_benchmarks (
  id, created_at,
  phase_name TEXT,             -- normalised: 'Groundworks', 'Steelwork', etc.
  estimated_duration_weeks NUMERIC,
  actual_duration_weeks NUMERIC,
  project_type TEXT,
  region TEXT,
  contract_value_band TEXT,    -- '<50k', '50-150k', '150-500k', '>500k'
  -- NO: user_id, project_id
)
```

**Trigger pattern (fires on project status → 'closed'):**
```sql
CREATE OR REPLACE FUNCTION capture_project_benchmark()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.proposal_status = 'accepted' AND OLD.proposal_status != 'accepted' THEN
    INSERT INTO project_benchmarks (...) VALUES (...);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Regional intelligence:** As volume grows, rate benchmarks filtered by `region` + `postcode_district` give a genuinely accurate local market rate. London SE1 rates will differ from Manchester M1 rates. This is the data moat — no competitor has real transaction data at this granularity.

**Legal note:** Before launching data aggregation, add a consent clause to the Terms of Service: "By using Constructa, you agree that anonymised, non-identifiable project data may be used to improve platform benchmarks and market intelligence." Standard SaaS practice, but must be explicit.

---

## CONSTRUCTA OWNER DASHBOARD (Admin Backend)

### Overview
A completely separate section of the app — `/admin/*` — locked to a specific admin email address or role. Uses the Supabase **service role key** (bypasses RLS) so it can query across all contractors. Never exposed to contractor-facing routes.

**Auth pattern:** Admin check on every admin route:
```typescript
// In admin layout.tsx
const ADMIN_EMAILS = ['robert@constructa.co']; // locked list, not a DB role
const user = await supabase.auth.getUser();
if (!ADMIN_EMAILS.includes(user.data.user?.email || '')) redirect('/dashboard');
```

### Admin Module 1 — Platform Analytics
Real-time view of the SaaS business metrics.
- [ ] MRR (Monthly Recurring Revenue): subscribers × plan rate
- [ ] Subscriber count: total, by plan (Free/Pro/Business), growth trend
- [ ] Churn: cancellations this month, churn rate %, at-risk accounts (inactive >30 days)
- [ ] New signups: daily/weekly/monthly trend chart
- [ ] DAU/MAU: daily and monthly active users (users who took an action)
- [ ] Feature usage: which modules are being used most (proposals, estimates, Contract Shield, etc.)
- [ ] Conversion: Free → Pro rate, trial-to-paid rate
- [ ] Geographic spread: where are contractors? (map by postcode district)

### Admin Module 2 — User Management
- [ ] All contractors list: email, plan, joined date, last active, project count, proposal count
- [ ] Search/filter by plan, region, trade type, activity
- [ ] Individual contractor view: their usage summary (no access to their actual project data)
- [ ] Manual plan override (for trials, support, partnerships)
- [ ] Account suspension/deletion controls
- [ ] Support notes: log contact history per contractor

### Admin Module 3 — Data Intelligence Dashboard
The platform intelligence layer — reads from aggregate tables only.
- [ ] Rate benchmark explorer: filter by trade, region, project type → see median/P25/P75 sell rates
- [ ] Regional rate map: choropleth map of the UK, colour-coded by average sell rates per trade
- [ ] Win rate by price point: at what contract value do proposals get accepted? What's the sweet spot?
- [ ] Programme accuracy: how reliable are estimated durations vs actuals? By project type?
- [ ] Variation frequency: which project types generate the most variations? What causes them?
- [ ] Margin distribution: what margins are contractors achieving? Where do they lose money?
- [ ] Contract risk: which contract types generate the most high-severity flags?
- [ ] Data volume tracking: how many benchmarks collected, by region, growth rate

### Admin Module 4 — Content Management
- [ ] System cost library editor: update/add/remove items in `cost_library_items` (is_system_default = true)
- [ ] System labour rates editor: update rates in `labour_rates` (is_system_default = true) — add regional variants
- [ ] Bulk rate update: apply a % uplift to all rates in a region (e.g. London +15%)
- [ ] AI prompt management: view/edit the prompts used in Contract Shield, Brief AI, etc.
- [ ] Email template management: edit transactional email templates

### Admin Module 5 — Market Intelligence (the data product)
The eventual sellable data layer. Reads from aggregate benchmark tables.
- [ ] Benchmark reports by region: "South East Residential — Q1 2026 Rate Index"
- [ ] Trade-specific rate cards: what's the market rate for groundworks in Manchester?
- [ ] Seasonal trends: do rates spike in spring/summer?
- [ ] Project type benchmarks: average cost/m² by project type and region
- [ ] Export: CSV / PDF benchmark reports (for sale to developers, QSs, mortgage lenders)
- [ ] API access tier: paid API for third parties to query benchmark data programmatically

### Admin Module 6 — Platform Health & Monitoring
- [ ] Vercel function error rate: flag if AI calls are failing
- [ ] AI spend tracker: OpenAI API costs by day/month, cost per active user
- [ ] Supabase usage: DB size, storage, bandwidth vs plan limits
- [ ] Failed jobs: any background tasks or email sends that errored
- [ ] Slow queries: flag DB queries taking >500ms

---

## Sprint 31 — Data Intelligence Foundation (BUILD BEFORE ADMIN DASHBOARD)
Must be built before admin analytics are meaningful. No UI — pure backend.
- [ ] Create `project_benchmarks`, `rate_benchmarks`, `labour_benchmarks`, `programme_benchmarks` tables
- [ ] No RLS on these tables (service role access only)
- [ ] Database trigger: fire on project status change → 'closed' → write anonymised snapshot
- [ ] Server action: manually trigger benchmark capture when contractor runs Final Accounts
- [ ] Add `postcode_district` extraction function (first 3-4 chars of postcode)
- [ ] Regional tags: ensure every project gets a clean `region` value (South East, London, etc.)
- [ ] Update Terms of Service with data aggregation consent clause
- [ ] Validate: no PII in aggregate tables (test with sample data)

## Sprint 32 — Constructa Admin Dashboard (Phase 1)
- [ ] `/admin` route with email-based auth guard
- [ ] Admin layout: separate sidebar from contractor dashboard
- [ ] Module 1: Platform Analytics (MRR, subscribers, churn, MAU, feature usage)
- [ ] Module 2: User Management (contractor list, search, plan management)
- [ ] Module 6: Platform Health (AI costs, error rates, Supabase usage)

## Sprint 33 — Constructa Admin Dashboard (Phase 2 — Data Intelligence)
- [ ] Module 3: Data Intelligence Dashboard (reads from benchmark tables)
- [ ] Regional rate map (choropleth — use a mapping library like react-simple-maps)
- [ ] Module 4: Content Management (cost library editor, labour rate editor)
- [ ] Module 5: Market Intelligence reports (first sellable data output)

### LONG-TERM VISION (V2+)
- Native mobile app + site walkthrough voice wizard
- Video walkthrough AI (GPT-4o Vision reads site video)
- Merchant procurement layer (Travis Perkins partnership)
- Financial infrastructure: escrow stage payments, contractor lending, client property finance
- Accountancy integration
- Staff financial products
- **Data product:** Sell benchmark reports and API access to developers, QS firms, mortgage lenders, insurers
- **Regional intelligence:** Real-time market rate feed — what's the going rate for a loft conversion in SE London this quarter?

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
