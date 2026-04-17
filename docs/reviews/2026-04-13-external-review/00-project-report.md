# Constructa — Comprehensive Project Status Report
**Prepared:** 13 April 2026
**Live URL:** https://constructa-nu.vercel.app
**GitHub:** https://github.com/constructa-co/Constructa (public)
**Purpose:** Handoff package for independent review by ChatGPT (Atlas), Gemini (Antigravity), Grok, and Perplexity.

---

## 1. Executive Summary

Constructa is a full-lifecycle SaaS platform for UK SME construction contractors (turnover £500k–£3m — "Dave" the contractor). It covers: **Brief → Estimate → Programme → Contracts → Proposal → Acceptance → Live Project (Billing, Variations, Change Management, P&L, Programme tracking, Communications) → Close (Final Account, Handover Documents, Lessons Learned) → Cross-project Reporting (Management Accounts, CIS, Business Intelligence, Contract Administration)**.

**Current status: code-complete. 59 sprints shipped. 66/66 Vitest tests passing. 0 TypeScript errors. `next build` clean. Vercel production deployment live.**

Next steps: (1) independent AI QA reviews (this document), (2) test-data cleanup, (3) owner-led manual end-to-end walkthrough, (4) closed beta with 3–5 real contractors.

**What deliberately isn't built yet (owner decisions):**
- LemonSqueezy billing (UAE company setup blocker)
- Xero activation (code ready, just env vars when ready)
- QuickBooks / Sage integrations (build on demand)
- Playwright test suite (deferred until feature-complete and in beta)
- Marketing site rewrite (deferred until after beta feedback)

---

## 2. Project Origin — Pre-Claude (Days 1 → ~Sprint 13, January–March 2026)

### 2.1 The problem

UK SME construction contractors manage projects with a patchwork of disconnected tools:
- **Estimating:** Excel spreadsheets, Candy (enterprise, £££), or nothing at all
- **Proposals:** Word docs, unbranded, 4+ hours per job, and they lose most of the time
- **Programme:** Microsoft Project or paper wall charts — contractors don't own P6/Asta
- **Contracts:** Sign whatever the client puts in front of them without understanding
- **Billing:** Excel → email → hope for payment; no retention tracking; clients dispute invoices
- **P&L:** Find out they lost money only when the job is over
- **CIS compliance:** Manual HMRC returns, easy to get wrong
- **Management accounts:** Don't exist — the contractor's accountant does one at year-end

**The Jobs-to-be-Done:**
1. Win more work by sending better proposals faster
2. Know if each job is making money while it's still running
3. Don't sign contracts with hidden time-bar traps (NEC4 cl. 61.3 is the classic career-killer)
4. Stay compliant with HMRC (CIS, VAT)
5. Get paid on time

### 2.2 Design principles locked in early

- **Mobile-first but desktop-capable** — site-based contractors use phones; office staff use desktops. Dark theme throughout as the primary.
- **AI-native from day one** — not an "AI feature" bolted onto an existing tool. OpenAI GPT-4o/4o-mini used for brief capture, scope bullet extraction, estimate line suggestions, proposal generation, contract risk analysis, drawing takeoff (Vision), video walkthrough analysis, delay analysis narratives, and contract notice drafting.
- **One-stop-shop** — replace the contractor's entire stack, not one tool. This is the competitive moat — Procore took the same playbook upmarket but Constructa is AI-native.
- **UK-specific** — £, HMRC CIS, NEC4/JCT/FIDIC contract forms, SCL Delay Protocol, British construction terminology (not US Procore terminology).
- **SaaS-native** — Next.js 14 App Router on Vercel, Supabase Postgres with RLS, multi-tenant from day one.

### 2.3 Founding stack (set before Claude joined)

- **Frontend:** Next.js 14 App Router, TypeScript, Tailwind CSS
- **Backend:** Supabase (PostgreSQL 15 + Row-Level Security + Auth + Storage)
- **AI:** OpenAI via `src/lib/ai.ts` wrapper (`generateText`, `generateJSON<T>`)
- **Email:** Resend (domain-verified at constructa.co)
- **PDF:** jsPDF + jspdf-autotable (no headless Chrome)
- **CI/CD:** Vercel auto-deploy on push to `main`
- **Repo:** Public GitHub monorepo

### 2.4 Pre-Claude sprints (1–13) — what was built before Claude Code joined

| Sprint | Scope |
|--------|-------|
| 1 | **Estimating engine v1** — trades catalogue, BoQ editor, section subtotals |
| 2 | **Rate buildups** — simple vs full mode for labour, plant, material |
| 3 | **Cost library v1** — 833 items across 60 UK construction trades |
| 4 | **Brief AI chat** — natural-language project capture; extracts scope, trades, est. value |
| 5 | **Programme/Gantt v1** — auto-generated from estimate manhours |
| 6 | **T&Cs + risk register** — 4 T&C tiers (Domestic/Commercial/Public/Custom); AI-generated risk register |
| 7 | **Project wizard** — multi-step new project creation; pipeline stage tracking |
| 8 | **Onboarding flow** — 4-step company profile setup |
| 9 | **Proposal editor v1** — drag-drop sections, brand theme |
| 10 | **Case studies** — CRUD with AI enhancement; selectable per proposal |
| 11 | **Project expenses table** — basic cost logging MVP |
| 12 | **Client Portal** — shareable proposal URL, in-browser render, digital acceptance, Resend notifications, viewed-status tracking |
| 13 | **Contract Shield** — AI contract review (Red/Amber/Green risk flags), plain English explanations, chatbot, contractor response PDF |

At end of Sprint 13 the product was a **pre-construction tool** (estimate → programme → contract review → proposal → digital acceptance). There was no live-project management, no billing, no variations, no P&L, no reporting, no contract admin, no final accounts. That's what Sprints 14–59 built.

---

## 3. Sprint-by-Sprint Register (Sprints 14–59)

### Phase A: Live Project Management (14–38)

| Sprint | Ship Date | What shipped |
|--------|-----------|--------------|
| **14** | Early-April | **Job P&L Dashboard** — KPI strip, budget-vs-actual by trade section with drill-down, 5-tab LogCostSheet (Labour/Plant-Owned/Plant-Hired/Materials/Overhead), invoice tracker. Introduced canonical cost hierarchy: Direct → +Prelims → +Overhead → +Risk → +Profit → −Discount. Plus **Global P&L**, **Live Projects Overview**, **Kanban pipeline** (Lead→Estimating→Proposal Sent→Active→Completed→Lost), sidebar accordion, financial_year_start_month on profiles. |
| **15** | 5 Apr | **Staff Resource Catalogue** — rate modes (Simple = hourly chargeout direct; Full = salary → NI → pension → benefits → overhead% → profit%), 60-item UK job-title autocomplete via `<datalist>`, hourly/daily/annual chargeout table. Fixed simple-rate-mode £0 rendering bug. |
| **15 (part 2)** | 5 Apr | **Plant Resource Catalogue** — Simple (daily chargeout direct) vs Full (depreciation model: capital cost × depreciation rate + running costs + fuel + servicing, divided by utilisation days, × profit uplift). 70-item plant-name autocomplete. Categories: Heavy Plant / Light Plant / Lifting Equipment / Temporary Works / Light Tools / Specialist Tools / Other. |
| **16** | 5 Apr | **Cost Capture Enhancements** — WBS-based cost logging (picks estimate line from the project), Labour time units (hours/half-days/days), Receipt upload to Supabase Storage `receipts` bucket with thumbnail + PDF icon + paperclip in the cost table. Critical `"use server"` 500-error fix. |
| **17** | 5 Apr | **UI/UX Dark Theme Consistency Pass** — applied Contract Shield / Job P&L dark-theme standard to all lagging pages (Brief, project navbar, Programme, Variations, Billing, New Project wizard, Onboarding). |
| **18** | 5 Apr | **Pre-Construction Workflow Polish** — 15 backlog items including Gantt bar width/position fixes, Preliminaries PDF rendering per-line, T&C clauses 10-12 added, Why-Choose-Us formatting, auto-scaffold BoQ from Brief trade selection, TRADE_SECTIONS expanded 15→22. |
| **19** | 5 Apr | **Gantt Drag-and-Drop** — drag bar to reposition (snaps to week), drag right edge to resize, "Starts After" dependencies with SVG amber bezier arrows, critical path highlighting, 4d/5d/6d/7d working week selector, Monday-anchored start dates. |
| **20** | 6 Apr | **Admin Dashboard Phase 1** — `/admin` route with email-based auth guard (`ADMIN_EMAIL` env var). Subscriber list, MRR/ARR KPIs, usage stats. Service role client for bypassing RLS. |
| **21** | 6 Apr | **Comprehensive BI Admin Dashboard** — 9-tab investor-grade dashboard (Overview, Revenue & P&L, Growth, Retention, Engagement, Geography, Costs, Website, Reports). MRR waterfall, cohort retention grid, DAU/WAU/MAU, Rule of 40, LTV/ARPU/churn. OpenAI cost integration. Plausible analytics integration. Automated report generator (daily/weekly/monthly/quarterly/annual). Pure-CSS charts. |
| **22** | 6 Apr | **Proposal Versioning** — `proposal_versions` table with immutable JSONB snapshot. Two-step restore. Version badge in status row. |
| **23** | 6 Apr | **Onboarding Polish + Email Notifications** — `sendContractorViewedNotification` (fires on proposal sent→viewed transition), `sendWelcomeEmail` on first onboarding completion. Getting-started checklist. |
| **25** | 7 Apr | **Drawing AI Takeoff** — upload PDF/image drawings; in-browser render to JPEG via `pdfjs-dist`; multi-image GPT-4o Vision call extracts quantities by trade section and matches to cost library. Results panel with checkboxes + trade-section grouping. Files never stored (process-only architecture). |
| **26** | 7 Apr | **Video Walkthrough AI** — upload site-survey video (MP4/MOV/WebM, 200MB, 2min); extract 20 frames + resample audio to 16kHz mono via Web Audio API; transcribe via Whisper-1; combined GPT-4o Vision call (narration primary, frames context). Full pre-construction workflow (video → brief → estimate → programme) in under 1 minute. |
| **26a** | 7 Apr | **Client BoQ Import** — upload client-provided BoQ (Excel via SheetJS or PDF via Vision); AI parses while preserving client's exact sections + item refs; creates estimate flagged `is_client_boq`; preview grouped by section; **export priced BoQ back** to client as `Priced_<filename>.xlsx`. Critical for NRM2/SMM7 tender responses. |
| **27** | 7 Apr | **Live Projects: Overview** — per-project health dashboard with RAG status, 4-card KPI strip (Contract Value, Budget Cost, Costs Posted, Margin), burn % bar, ProgrammeBar mini-Gantt with today-line, outstanding invoices list, 4 quick-action tiles. |
| **28** | 7 Apr | **Live Projects: Cost Tracking** — committed costs (status: actual/committed), section forecasts (`project_section_forecasts` table), stacked burn bar (solid blue = actual, translucent amber = committed), 7-col section table, SectionForecastPopover for inline per-section forecast overrides, Subcontract tab with Committed/Actual toggle. |
| **29** | 8 Apr | **Live Projects: Billing & Valuations** — AfP accounting (gross → less prev cert → less retention → net due), retention ledger, aged-debt bands (current / 1-30 / 31-60 / 61-90 / 90+), payment milestones. |
| **30** | 8 Apr | **Live Projects: Variations** — VAR-001 auto-numbering, 7 instruction types, Draft→Pending→Approved/Rejected workflow, approval reference capture, per-variation PDF instruction, negative amounts rendered as (£x) for omissions. |
| **31** | 8 Apr | **Live Projects: Programme Live Tracking** — `pct_complete` + `actual_start/finish` on Phase interface, % overlay on Gantt bars, LiveTrackingPanel with per-phase sliders, AI weekly update narrative via GPT-4o stored in `programme_updates` table. |
| **32** | 8 Apr | **Live Projects: Communications** — 4 tables (site_instructions, rfis, early_warning_notices, document_register) with auto-numbered refs. SI + EWN PDF export. RFI respond dialog. Document direction badges. EWN £/time exposure footer. |
| **33** | 8 Apr | **Closed Projects: Final Accounts** — financial settlement (`originalContractSum + variations + adjustments = adjustedContractSum`), status machine (Draft/Agreed/Disputed/Signed), adjustment CRUD, variations schedule, certification history, PDF with signature block. |
| **34** | 8 Apr | **Live Projects: Change Management** — CE-001 register, 8 event types, status workflow (Draft→Notified→Submitted→Assessed→Agreed/Rejected/Withdrawn), financial + time impact tracking (claimed vs agreed), expandable row detail. |
| **35** | 8 Apr | **Closed Projects: Handover Documents** — 16 standard items auto-seeded (O&M manuals, warranties, as-builts, test certs, H&S file, compliance certs). Progress bar. Click-to-cycle status badges. |
| **36** | 8 Apr | **Closed Projects: Lessons Learned** — star ratings (overall + client satisfaction), financial/programme outcome selectors, structured lesson items (Went Well / Improvement / Risk / Opportunity) with impact + action tracking, AI narrative via GPT-4o. |
| **37** | 8 Apr | **Live Programme: As-Built vs Baseline Gantt** — dual-bar Gantt (baseline grey + actual coloured), today line, revised planned finish (dashed amber), delay calculation per phase (forecast from progress rate), delay reason (9 categories), total programme delay summary. |
| **38** | 8 Apr | **Dashboard Home Rebuild** — cross-project ops dashboard at `/dashboard/home`. 8 parallel DB fetches. 8 KPI cards (Active Projects, Outstanding, Overdue, Retention, Open RFIs, Pending Variations, CE Exposure, Total Programme Delay). 5 conditional alert banners. Active projects table with inline module-linked alert chips. Financial snapshot panel. 7 quick-action links. |

### Phase B: Cross-Project Ops + Integrations (39–50)

| Sprint | Ship Date | What shipped |
|--------|-----------|--------------|
| **39** | 9 Apr | **Project Archive** — mark project as closed/archived with retention-held alert. Archive sidebar item enabled. Searchable/filterable archive view. Financial outcome preserved in `archive_snapshots` (immutable snapshot at close time). Two-step restore confirmation. |
| **40** | 9 Apr | **Contractor Management Accounts** — consolidated financial view across all projects. 6 tabs: Overview (KPI cards + monthly bar chart), P&L by Project, Cash Flow (90-day forecast), WIP Schedule, Key Ratios (13 ratios with traffic-light status), Export (CSV). Archive snapshots used as source-of-truth for closed projects. |
| **41** | 9 Apr | **CIS Compliance** — 4-tab page: Overview (KPI strip, unverified warning, recent payments), Subcontractors (register CRUD, UTR/verification), Payments (record with live deduction preview, gross/materials/labour split), Monthly Returns (tax-month grouping, CIS300 per-subcontractor table, mark statements sent). `cis_subcontractors` + `cis_payments` tables. |
| **42** | 9 Apr | **Benchmark Data Layer** — 4 anonymised benchmark tables (`project_benchmarks`, `rate_benchmarks`, `variation_benchmarks`, `programme_benchmarks`). No PII. Service-role only. Contract value stored as bands (£0-50k etc). `fn_benchmark_on_archive()` trigger fires on project archive, writes anonymised outcome if `data_consent = true`. GDPR-compliant consent flow in Settings. |
| **43** | 9 Apr | **Admin Dashboard Phase 2** — two new superadmin tabs: Benchmarks (project_benchmarks viewer, filter by type/band, colour-coded margin/delay) + Intelligence (platform health KPIs, feature usage heatmap, at-risk accounts scored 1–3 with risk reasons). |
| **44** | 9 Apr | **Xero Integration** — OAuth2 connect/disconnect flow, auto token refresh (5-min expiry buffer), push ACCREC invoices to Xero, pull PAID status back. Sync log UI. Env vars deferred until developer account confirmed. |
| **48** | 9 Apr | **Market Intelligence / API** — `api_keys` + `api_usage_log` tables, SHA-256 hashed keys, `/api/v1/benchmarks` GET endpoint (Bearer auth, rate limit, CORS). API key management UI (create/copy-once/revoke). Business Intelligence dashboard (contractor vs benchmarks). |
| **49** | 9 Apr | **Progressive Web App** — `manifest.json` (installable, shortcuts), `public/sw.js` (offline fallback + nav caching), `/dashboard/mobile` on-site hub (project selector, 4 quick-action tiles, recent feed), `capture="environment"` on receipt upload (opens camera on phones), install banner, theme-color + apple-touch-icon. |
| **50** | 9 Apr | **Material Rates & Procurement** — `material_prices` table. 90 indicative UK trade prices across 10 categories with low/mid/high bands and regional variants. Filter by trade + region + search. Basket panel with qty controls; "Log all to Job P&L" pre-populates cost log. |
| **51** | 10 Apr | **Resource Planning & Portfolio Management** — portfolio-level labour management. CSS Gantt timeline showing all projects + staff across the full portfolio horizon. `resource_allocations` + `staff_absence` tables. 3-tab client: Portfolio Timeline / Manage Allocations / Demand vs Supply. Conflict detection (red rings), gap overlays (amber dashed), absence blocks, today line. |

### Phase C: Final Build-Out + Hardening (54–59)

| Sprint | Ship Date | What shipped |
|--------|-----------|--------------|
| **54** | 10 Apr | **Accounting Reconciliation** — Bank CSV import with column auto-detection. Auto-match credits to unpaid invoices by amount (±2p) + date proximity + invoice number in reference. Reconciliation UI (match/categorise/unmatched). Company P&L (12-month). Aged Debtors portfolio view. VAT periods with HMRC period keys. Overhead costs CRUD. `bank_transactions`, `bank_reconciliation`, `vat_periods`, `overhead_costs` tables. |
| **56** | 10 Apr | **Drawing Viewer & Measurement** — PDF/image viewer with interactive measurement tools on `pdfjs-dist`. Scale calibration (click 2 points of known dimension → sets px/m ratio). Linear + Area (polygon) + Count + Text + Highlight tools. 6-colour palette. Zoom/pan. Measurements panel with trade-section assignment. Add to Estimate pushes measurements as line items. `drawing_measurements` table. |
| **57** | 10 Apr | **Chrome QA Audit** — full live walkthrough. 8 bugs identified and fixed (pipeline static label removal, proposal scope/intro differentiation, contract value computation, programme page column query, reporting page column query, PDF blank-page before Why-Choose-Us). |
| **57 follow-up** | 11 Apr | **Silent schema-mismatch sweep** — triggered by Perplexity + Grok independent reviews. Fixed `updatePhasesAction` (was silently failing all programme edits since Sprint 19 due to non-existent `timeline_phases` column). Fixed 14 project-picker queries selecting non-existent `updated_at`/`end_date` columns. Fixed billing page £1,593.90 vs £1,753.29 prelims-uplift skip. Proposal editor section flow reordered to match PDF output. |
| **58** | 11 Apr | **Hardening, Quick Quote & Polish** — 17 commits across three phases: **Phase 1 (safety net):** error/loading boundaries on every route group (global, dashboard, projects), `requireAuth()` helper applied to ~40 mutating server actions across 42 files, Zod validation on 8 highest-risk actions, honest three-dimensional RAG (budget + programme + forecast margin), unified Active Projects KPI via `isActiveProject()` helper, sidebar active-project URL sync, Vitest harness + 35 tests on canonical financial functions, Sentry observability seam. **Phase 2 (streamline):** Quick Quote path with 6 seed templates (Kitchen Extension, Loft Conversion, Bathroom, Driveway, Garden Room, Custom), proposal editor autosave, forgot-password flow. **Phase 3 (polish):** shared PDF theme + money formatter with 19 tests, core domain type interfaces in `src/types/domain.ts`, proposal editor + PDF builder migrated to canonical `computeContractSum`. |
| **59 (Phase 1, in place at session start)** | 11 Apr | **Contract Administration Suite foundation** — 5 DB tables (`contract_settings`, `contract_obligations`, `contract_events`, `contract_communications`, `claims`), `src/lib/contracts-config.ts` config-driven engine covering NEC4/NEC3/JCT SBC/FIDIC Red 1999/FIDIC Red 2017/FIDIC Yellow 2017/Bespoke variants (terminology, options, on-award obligations, event chains, response steps, payment cycles). `setupContractAction`, `raiseEventAction` with automatic `time_bar_date = addDays(date_aware, contractorTimeBarDays)`, `logCommunicationAction`, `raiseClaimAction`, `draftNoticeAction`, `draftClaimAction` — all `requireAuth()`-gated. 1,108-line contract-admin client with 5 tabs (dashboard, obligations, events, communications, claims) and per-event time-bar pills. |
| **59 (Phase 2, 11 Apr)** | 11 Apr | **Contract Alerts push+pull loop** — three new red/amber AlertBanners on home dashboard (time bars ≤14 days, overdue obligations, obligations due this week) deep-linking to contract-admin. Daily Vercel cron `/api/cron/contract-alerts` at 07:00 UTC sweeping all open events + obligations per user and sending `sendContractAlertEmail` digest via Resend. `contract_alert_notifications` idempotency table with cadence rules (first alert on window entry, weekly re-warn, daily in final 3 days, stop after completion or bar+7 days). `CRON_SECRET` auth on the cron route. |
| **59 (Phase 3, 11 Apr)** | 11 Apr | **Per-event AI drafting guidance** — optional `aiGuidance?: string` field on `EventConfig`. Populated for 6 high-value events: NEC4 CE (cl. 61.3 — 8-week hard bar), NEC4 EW (cl. 15.1), NEC3 CE (cl. 61.3 derived from NEC4), JCT SBC Variation (cl. 3.10), JCT SBC EoT (cl. 2.27.1 referencing Walter Lilly v Mackay on "forthwith"), JCT SBC L&E (cl. 4.20 covering Hudson/Emden/Eichleay heads), FIDIC Red 1999 Claim (cl. 20.1 referencing Obrascon v AG of Gibraltar on hard 28-day bar). `draftNoticeAction` appends guidance to system prompt when present. |
| **59 (Phase 4, 13 Apr — today's session)** | 13 Apr | **Sprint 59 complete + gap-fillers + QA** — 10 commits shipped today: (1) Proposal PDF decomposition: 1,922-line monolith split into 9 per-section modules + orchestrator, all theme/money/geometry delegated to shared libraries. (2) Login + onboarding redirect → `/dashboard/home` (not CRM kanban). (3) Quick-log cost FAB on `/mobile` hub with 3-field slide-up form. (4) 3-step welcome tour on home dashboard for new users with 0 projects; `onboarding_seen_at` migration. (5) Light-mode fix on staff + plant resource pages (49 hardcoded slate classes → semantic CSS variables). (6) BRAND migration across 3 PDF generators (28 hardcoded RGB tuples eliminated). (7) FIDIC `engineer_instruction` aiGuidance for Red 1999 cl. 13.1/20.1 + 2017 override with cl. 20.2.1 renumbering. (8) Supervisor / sub-contractor read-only portal: `supervisor_tokens` table with RLS, `/supervisor/[token]` public route, acknowledge button, invite UI in contract-admin, Resend invite email. (9) SCL Delay Analysis Protocol: 4 methodologies (As-Planned vs As-Built, Time Impact Analysis, Collapsed As-Built, Windows Analysis) with 12 Vitest tests; `runDelayAnalysisAction` + `draftDelayNarrativeAction` using GPT-4o-mini with SCL Protocol 2nd Edition context; 6th tab in contract-admin UI with methodology picker, results tables per methodology, AI narrative generation. (10) QA walkthrough caught `£1,593.90` bug on Final Account page — last inline QS formula in the codebase eliminated by delegation to `computeContractSum`. |

---

## 4. Current Codebase Stats (13 April 2026)

- **230+ TypeScript files, ~54,000+ lines**
- **77 Supabase migrations**
- **20+ dashboard routes + public supervisor/proposal portals**
- **66/66 Vitest tests** passing (35 on `src/lib/financial.ts`, 19 on `src/lib/pdf/pdf-money.ts`, 12 on `src/lib/delay-analysis.ts`)
- **0 TypeScript errors** (strict mode)
- **`next build` clean**
- **Zero known launch-blocking bugs**
- **Live on Vercel** with daily cron, Resend email, OpenAI, Supabase service role all configured

---

## 5. Known Non-Issues (Test Data)

The demo user account has several test projects that will be cleaned up before beta — please **do not** report these as bugs:

- `l;'` / `;l'` (garbled test)
- `Flower Power` / `Mr Flower`
- `Banana joe` / `Mr Joe`
- `ABD` / `Mr Jones`
- `Al Zeina` (two duplicate entries)
- `Test Scroll Fix`
- `Mr Bob Jovi` staff record (legitimate simple-rate mode, £18/hr — not a bug despite £0 annual salary)

The canonical demo project is **22 Birchwood Avenue — Kitchen Extension & Loft Conversion** (Mr & Mrs Patel). Use this as the reference project for walkthroughs.

---

## 6. What Reviewers Should Focus On

**Not in scope for this review:**
- LemonSqueezy billing (deferred)
- Xero live connection (code ready, env vars pending)
- Playwright E2E tests (deliberately deferred)
- Marketing site at constructa.co (separate project)

**In scope for this review:**
1. **Core workflow correctness** — does every pre-construction → live → close workflow work end-to-end for a real SME contractor?
2. **Financial math correctness** — the canonical contract sum (£1,753.29 for 22 Birchwood) should be identical everywhere: Estimate, Proposal editor, Proposal PDF, Billing, Overview, Job P&L, Final Account. Any drift = bug.
3. **UK construction domain accuracy** — are the NEC4/JCT/FIDIC clause references, SCL Protocol methodologies, CIS deduction rates, retention handling, and QS terminology correct for a UK contractor?
4. **Onboarding / first-use experience** — can a contractor get from signup to first sent proposal in under 10 minutes?
5. **Mobile / PWA experience** — does the site work on a phone, and does the `/mobile` hub cover the field-contractor use case?
6. **Contract Admin career-saving check** — NEC4 compensation events have an 8-week hard time bar. The daily alert cron + home dashboard red banners are specifically meant to prevent the contractor losing entitlement. Does that work end-to-end?
7. **Accessibility and visual polish** — anything that feels "prototype-y" or "AI-built" rather than "professional SaaS".
8. **Code quality** (Grok only, see §8) — identify structural weaknesses, remaining `any` usage, missing error handling, N+1 queries, missing indexes, RLS gaps, etc.

---

## 7. Deliverable Format

Each reviewer should return:

1. **Bugs** — severity (P0/P1/P2/P3), steps to reproduce, expected vs actual, suspected file
2. **UX friction** — moments where the user would get stuck, confused, or lose trust
3. **UK construction domain corrections** — any clause references, terminology, or calculations that are wrong
4. **Polish gaps** — inconsistent spacing, typos, label mismatches, anything that makes it feel unfinished
5. **Strategic suggestions** — one or two "if I had to pick the single biggest improvement before inviting real contractors" comments

Output as Markdown with findings numbered and file paths where relevant. Brevity over exhaustiveness — please flag the top 10-20 items, not a 200-item list.

---
