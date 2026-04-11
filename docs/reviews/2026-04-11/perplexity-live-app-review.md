# Constructa — Live Application Review
**Reviewed:** Saturday, 11 April 2026  
**Reviewer:** Automated review agent  
**Account:** robert.smith4@icloud.com — Tripod Construction Ltd  
**Base URL:** https://constructa-nu.vercel.app

---

## 0. Login Page (`/login`)

**Status:** ✅ Loads correctly  
**Observations:**
- Clean, minimal dark-themed login form (full black background, dark card).
- Email and password fields pre-filled by the browser's autofill — login worked on first attempt.
- No "Forgot password?" link visible on the login screen — **potential UX gap** for users who need password recovery.
- No visible social/SSO login options (Google, etc.).
- "Don't have an account? Sign up" link present.
- After successful login, redirects to `/dashboard` (Kanban/Pipeline view) rather than `/dashboard/home` — may be intentional but slightly inconsistent with having a dedicated home page.

---

## 1. Dashboard/Home (`/dashboard/home`)

**Status:** ✅ Loads correctly  
**Observations:**

### Alert Banner
- Green alert banner at top: *"Proposal accepted! → 22 Birchwood Avenue — Kitchen Extension & Loft Conversion · £85k — set up billing & programme"*
- Banner is prominent and includes an actionable CTA. Well implemented.

### KPI Cards (8 cards, 2 rows)
**Row 1:**
- **Pipeline Value** — £0 / 0 active proposals *(Note: the pipeline view at /dashboard showed £182k — discrepancy between this "home" KPI and the main pipeline view KPI. This seems to be because the home page KPIs may refer specifically to "active" pipeline only, while the pipeline page KPI includes all open stages.)*
- **Active Projects** — 0 none on site *(Inconsistency with pipeline showing 1 Active job)*
- **Certified Outstanding** — `—` / all invoices paid
- **Retention Held** — `—` / none outstanding

**Row 2:**
- **Pending Variations** — 0 / 0 awaiting approval
- **CE Exposure** — `—` / 0 open change events
- **Open RFIs** — 0 / none overdue
- **Win Rate (90d)** — **100%** / 1 of 1 decided — *this is a positive KPI, well highlighted in teal/green*

**Issues noted:**
- The "Active Projects" card shows 0 despite the pipeline having a project marked as "Active" (22 Birchwood Avenue). This creates confusion. The home KPIs seem to only count projects in the **live projects module**, not the pipeline stage.
- "Pipeline Value" shows £0 on the home page but £182k on the pipeline page — the difference is likely due to filtering (home shows "active contract values" not pipeline estimates). The labelling is identical ("Pipeline Value") which is confusing.
- `—` dashes for Certified Outstanding, Retention Held, CE Exposure are appropriate empty states but could benefit from a tooltip explaining what the `—` means (vs showing a zero).

### Active Projects Table
- Shows "No active projects yet." with a "View pipeline →" link.
- Intentionally empty — the project is in the pipeline but not yet in live construction. Well designed empty state.

### Financial Snapshot Panel
- Shows: Total certified outstanding (£0), Overdue invoices (`—`), Retention held (`—`), CE exposure (claimed) (`—`), EWN exposure (`—`)
- Clean layout, appropriate empty state.

### Quick Actions
- "New Project" and "View Pipeline" CTAs visible at bottom right.

### Navigation
- Left sidebar clearly structured: Overview → On-site Hub → Active Project → Company Profile → Work Winning → Pre-Construction → Live Projects → Closed Projects → Resources
- Date correctly shows Saturday, 11 April 2026.

---

## 2. Pipeline/Kanban (`/dashboard`)

**Status:** ✅ Loads correctly  
**Observations:**

### Header KPIs (5 cards, time-filtered)
- Period selector: This Week / **This Month** / This Quarter / This Year
- Cards: **£182k Pipeline Value** (open opportunities), **2 Proposals Sent** (awaiting client decision), **1 Projects Won** (accepted proposals), **1 Active Jobs** (currently on site), **33% Win Rate** (proposals accepted), **£85k Revenue Signed** (contracted value)
- Clean, well-formatted currency cards.

### Search & Filter Bar
- Search: "Search by client or project name..." — functional text input
- Filter dropdowns: "All Types" and "All Stages"
- View toggle: **Board** (active) | **List** — both views available

### Kanban Board
Pipeline stages shown as columns:
1. **Leads** — 0 cards, £0 — shows "New projects start here" empty state with ghost icon
2. **Estimating** — 15 cards(?), £172,625 — contains "TEST SCROLL..." (test project visible)
3. **Proposal Sent** — 2 cards, £115,000
4. **Active** — 1 card, £85,000 — "22 BIRCHWO..." card (22 Birchwood Avenue)
5. **Completed** — 0 cards, £0 — EMPTY state
6. **Lost** — 0 cards, £0 — EMPTY state

**Issues noted:**
- **Test data visible:** A card labelled "TEST SCROLL..." by "Mr Test" appears in the Estimating column — this is test/dummy data that appears to be live in the production environment. Should be removed or filtered.
- Card truncation: Project names are cut off ("TEST SCROLL ...", "14 MAPLE CLO...", "22 BIRCHWO...") — the truncation works but the full names aren't visible. Hovering could show a tooltip (untested).
- Cards display: project type badge (e.g., "RESIDENTIAL EXTENSION"), client name, value, status badge (e.g., "Estimating", "Proposal...", "Active"), time since last update ("5d", "6d").
- Stage count for "Estimating" showing **15** seems very high for a demo account — likely includes the 15 test/placeholder projects.
- Drag-and-drop was not tested (requires mouse interactions).

---

## 3. Company Profile (`/dashboard/settings/profile`)

**Status:** ✅ Loads correctly  
**Observations:**

### Personal Details Section
- Fields: Full Name (Robert Smith), Email (robert.smith4@icloud.com), Phone (01255 830178), Sales Contact Email (robert@constructa.co), Sales Contact Phone (01234 555666), Accounts/Credit Control Email (accounts@constructa.co)
- All fields populated with demo data.
- Clean two-column layout on desktop.

### Company Profile Section
- Fields: Company Name (Tripod Construction Ltd), Company Registration Number (1243342), VAT Number (GB 1234 565 34), Trading Address (18 Jackdaw Drive, Colchester, Essex, CO3 8WD), Website (www.tripod.co.uk), Years Trading (10), Financial Year Start, Primary Trade / Business Type, Specialisms (Driveways, Asphalt, Utilities, Drainage), Insurance Details, Accreditations (NHBC, Airside Accreditation), Capability Statement (text area)
- **Financial Year Start** — field present but label says "Used for financial year period breakdowns" — no value shown in review, worth verifying it's populated.

### Company Logo
- Upload area: "PNG or JPG, max 2MB recommended"
- No current logo uploaded (or it may be set — not visible in screenshot).

### Proposal Theme
- Three colour choices: **Slate** (Modern & Premium), **Navy** (Established & Traditional), **Forest** (Craft & Heritage)
- Clean tile-based selector — good UX.

### Past Projects & Case Studies (embedded)
- Two case studies shown within the profile page (James House, BP Service Station) — same content as `/settings/case-studies`.
- "+ Add Case Study" button present.
- **Duplication concern:** The Case Studies section appears both on the Company Profile page AND has its own dedicated page at `/settings/case-studies`. These seem to be the same data shown in two places, which could confuse users as to where to manage this content.

### MD Message Section
- Two fields: MD / Director Name, Personal Message
- Both appear blank in the demo — intentional empty state, no error.

### Industry Benchmarking
- Checkbox consent for contributing anonymised benchmark data.
- Clear explanation text. Good privacy practice.

**Issues noted:**
- The "Trading Address" field content in page text shows "18 Jackdaw DriveColchester" (missing space/newline between street and city) — possible minor data formatting issue.
- No explicit Save button visible at the top — save button(s) presumably appear at the bottom of each section (not fully reviewed by scrolling every section).

---

## 4. Case Studies (`/dashboard/settings/case-studies`)

**Status:** ✅ Loads correctly  
**Observations:**
- Dedicated page for managing case studies.
- Header: "Case Studies — Showcase your past projects. These appear in proposal PDFs to build client confidence."
- Each case study has an expand/collapse chevron and a trash/delete icon.
- "AI Enhance" button on each case study (with AI wand icon) — nice value-add feature.
- Fields per case study: Project Name, Project Type, Contract Value (£), Programme Duration, Client Name, Location, What We Delivered, Value Added, Photos (up to 3 with upload capability).
- Two case studies pre-populated: "James House" (Driveway) and "BP Service Station" (Civils for a substation).
- Photo upload works: Case Study 1 (James House) has 1 photo uploaded, 2 empty upload slots.
- Case Study 2 (BP Service Station) also has 1 photo uploaded.

**Issues noted:**
- No explicit "+ Add Case Study" button visible at top of the dedicated page (it was visible on the profile page but wasn't visible in the screenshot of the dedicated case studies page — may require scrolling past existing studies or may only exist on the profile page).
- The "AI Enhance" feature is an interesting differentiator — worth verifying it functions.

---

## 5. Labour Rates (`/dashboard/resources/staff`)

**Status:** ✅ Loads correctly  
**Observations:**
- Page title: "Labour Resource Catalogue — Build your team cost profiles — salary, on-costs and chargeout rates"
- Sub-section: "Staff & Contractors — Build accurate labour cost profiles for your team"
- Table columns: Name & Job Title, Mode, Hourly, Daily, Annual, Actions
- 3 staff members shown:
  1. **Mr Bob Jovi** (Labourer) — Mode: Simple — £0.00/hr, £0.00/day, £0.00/yr → **All zeros — either incomplete data or test record**
  2. **Mr Jim Bowden** (Plumber) — Mode: Simple — £30.00/hr, £240.00/day, £54,480.00/yr
  3. **Mr Steve Smith** (Electrician) — Mode: **Full Buildup** — £29.14/hr, £233.08/day, £51,744.00/yr (cost: £39,200.00)
- "+ Add Staff Member" button in top right.
- Each row has Edit (pencil) and Delete (trash) action icons.

**Rate modes confirmed:**
- **Simple** — directly enter hourly/daily rate
- **Full Buildup** — calculates chargeout from salary + on-costs (NIC, pension, etc.)

**Issues noted:**
- Mr Bob Jovi has all-zero rates — this is either a test record or incomplete setup data. If this rate is used in an estimate, it would produce incorrect £0 costs.
- No rate categories/trades visible — staff are listed in a flat list without filtering by trade type.

---

## 6. Plant Rates (`/dashboard/resources/plant`)

**Status:** ✅ Loads correctly  
**Observations:**
- Page title: "Plant & Equipment Register — Track owned assets — depreciation, running costs and daily chargeout rates"
- "1 asset registered"
- Table columns: Name, Category, Mode, Half Day, Daily Chargeout, Weekly, Actions
- 1 plant item:
  1. **3T excavator** (Komatsu) — Category: Other — Mode: **Buildup** — £49.50 half day, £99.00/day, £495.00/week
- "+ Add Plant Item" button present.

**Issues noted:**
- Only one plant item registered — minimal data but functionally demonstrates the feature.
- Category shows "Other" — would benefit from seeing the full category list (Earthmoving, Lifting, Compaction, etc.) when adding new items.
- The "Mode: Buildup" tag suggests rates are calculated from owned asset costs (purchase price, depreciation, fuel, maintenance) rather than external hire rates — good feature for contractor self-managed plant.

---

## 7. Cost Library (`/dashboard/library`)

**Status:** ✅ Loads correctly  
**Observations:**
- Page title: "Cost Library — UK market benchmarks across 13 trade categories. Rates shown are market benchmarks — set your own rates to personalise your estimates."
- Search bar: "Search all 330+ items across all trades..." — prominent and accessible.
- Items organised by trade category with accordion-style expand/collapse.
- **First visible category: Preliminaries** (20 items shown)
- Sample items (all with market benchmarks):
  - P.01 Site Manager / Foreman — Day — Market benchmark: £320.00
  - P.02 Site Cabin Hire (6m) — Week — £85.00
  - P.03 Portaloo Hire + Servicing — Week — £35.00
  - P.04 Heras Fencing (per panel/week) — Week — £2.50
  - P.05 Skip Hire (8-yard) — Each — £280.00
  - P.07 Temporary Power Setup — Sum — £450.00 *(P.06 absent or hidden — numbering gap noted)*
  - P.08 Site Signage Pack — Sum — £120.00
  - P.09 Traffic Management (basic) — Day — £180.00
- "Set my rate" pencil icon appears on hover (P.04 shows this).

**Issues noted:**
- Item numbering has a gap: P.01 through P.09 visible but P.06 is missing from the visible list — either it's below the fold or there's a data gap.
- 13 trade categories exist but only "Preliminaries" is expanded in the default view — users need to scroll or expand to find other trades.
- No visible category filter/tab strip — browsing requires either search or manual accordion navigation. For 330+ items, a category sidebar or tab-based filter could improve discoverability.

---

## 8. Pre-Construction Flow

### 8a. Project Brief (`/dashboard/projects/brief`)

**Status:** ✅ Loads correctly  
**Project:** 22 Birchwood Avenue — Kitchen Extension & Loft Conversion  
**Observations:**
- Page title: "Project Brief — AI-Powered — Describe your project. The AI assistant can help you build the brief from a single sentence."
- "Brief Complete" button visible in top right (green/active state).
- Top navigation tabs: Overview | **Brief** | Estimating | Drawings | Programme | Contracts | Proposal | Comms
- **Video Site Survey section:** Upload area for walkthrough video (MP4/MOV/WebM, max 200MB, max 2 minutes). AI extracts scope & trades from video. Innovative feature.
- **Project Details section:**
  - Project Name: "22 Birchwood Avenue — Kitchen E..." (truncated in field)
  - Client Name: Mr & Mrs Patel
  - Client Type: toggle buttons — **Domestic** (selected) | Commercial | Public
- **AI Brief Assistant** panel on right — "Tell me about your project. I'll extract the scope, trades and estimated value automatically." — AI assistant is populated with text excerpt about the project.
- **Location & Dates** section visible (partially below fold).

**Issues noted:**
- Project name appears truncated in the input field. The full name is "22 Birchwood Avenue — Kitchen Extension & Loft Conversion" but the input shows "22 Birchwood Avenue — Kitchen E..." — this may be a display clipping issue rather than a data truncation.
- The AI brief assistant is a strong differentiator for this product.

### 8b. Estimates (`/dashboard/projects/costs`)

**Status:** ✅ Loads correctly  
**Observations:**
- "Estimating" page with "Contract Sum: £1,753.29" displayed in header.
- Action buttons: "View Programme →" and "Next: Programme →"
- Estimate version tabs: **Estimate v1** (starred as active) | "+ New Estimate" | "Import Client BoQ"
- Estimate summary fields: Estimate Name, Prelims %, Overhead %, Risk %, Profit %, Discount %
  - Current values: 10% / 10% / 5% / 15% / 0%
- Status: "★ Active" badge, delete button
- **Cost Summary:**
  - Direct Construction Cost: £1,200.00
  - Preliminaries (10%): £120.00
  - **Total Construction Cost: £1,320.00**
  - Overhead (10%): £132.00
  - Risk (5%): £72.60
  - Profit (15%): £228.69
  - **CONTRACT SUM (exc. VAT): £1,753.29**
  - VAT (20%): £350.66
  - **TOTAL inc. VAT: £2,103.95**
- Line item trades visible: **Groundworks** (Excavate foundation trench, 24 m3, £50.00 "built up", £1,200.00) and **Masonry** (Aircrete block, 1 nr, rate blank, £0.00)
- "Add line item" buttons per trade section.
- "Next: Programme →" sticky button at bottom right.

**Issues noted:**
- Masonry section has a line item (Aircrete block) with quantity 1 but rate = 0 — producing £0.00 total. Potentially incomplete/test data.
- Rate for Groundworks item shows "built up" tag (£50.00 built up) — this is a visual indicator that the rate was built up from resource costs rather than entered directly. Good transparency.
- Multiple estimate versions supported ("+ New Estimate") — good for iterative quoting.

### 8c. Programme/Gantt (`/dashboard/projects/schedule`)

**Status:** ✅ Loads correctly  
**Observations:**
- Page: "Programme — 22 Birchwood Avenue — Kitchen Extension & Loft Conversion · Estimate v1"
- Action buttons: "Regenerate from estimate" and "Save to Proposal"
- Start Date: 19/04/2026 (editable date picker)
- Working Week: **4d** | **5d** (selected) | 6d | 7d | Mon-Fri
- KPI cards:
  - **Duration:** 140d (20 calendar weeks)
  - **Start:** 20 Apr 26 (Monday WC)
  - **Completion:** 7 Sept 26 (estimated)
  - **Manhours:** 768h (96 working days)
- Gantt table columns: Phase/Trade, Calc, Days, Starts After, [Gantt bar area]
- One phase visible: **Groundworks** (20 Apr – 7 Sept · 768h) marked with ★ critical path — 96d
- "+ Add Phase" button
- "★ Live Tracking" button at bottom right
- Gantt bar extends across week columns (W1 through W18+) as expected.

**Issues noted:**
- Only one phase (Groundworks) is defined — the programme is not fully built out. This is expected for a partially populated demo project.
- The Gantt input area for Groundworks has the days field showing "96d" highlighted in blue — appears to be in an edit state by default, which could be confusing.
- "Regenerate from estimate" is a useful feature to auto-populate programme phases from estimate trades.

### 8d. Contracts (`/dashboard/projects/contracts`)

**Status:** ✅ Loads correctly  
**Observations:**
- Page: "Contracts — Managing contracts for: 22 Birchwood Avenue — Kitchen Extension & Loft Conversion"
- Feature branding: **"Contract Shield — AI-Powered — Protect your business with AI contract review, risk management, and UK construction law awareness."**
- Four contract type tabs: **Terms & Conditions** (selected) | Risk & Opportunities | Exclusions & Clarifications | Contract AI
- Four contract type cards:
  1. **Domestic** ✓ (selected/active) — For homeowner clients — Plain English terms for residential projects. RICS Homeowner Adjudication. Simple payment terms. 12 clauses.
  2. **Commercial** — For business clients — JCT Minor Works based. 24 clauses.
  3. **Specialist** — For specialist/trade works — Trade-specific terms. 18 clauses.
  4. **Client Contract** — Contractor's amended response — Review, modify, or reject client clauses. 2 accepted / 6 modified / 0 rejected badge shown.
- Below the cards, the full **Domestic Terms — 12 Clauses** are displayed starting with: "1. Jurisdiction — The law of this Contract is the Law of England and Wales..."

**Issues noted:**
- The "Client Contract" card shows acceptance/modification/rejection counts (2/6/0) suggesting AI has already reviewed a client contract. This is a premium feature.
- The contracts section is comprehensive and well-structured — a genuine differentiator for this product.

### 8e. Proposal (`/dashboard/projects/proposal`)

**Status:** ✅ Loads correctly  
**Observations:**
- Page: "Proposal Editor — Drafting for: 22 Birchwood Avenue — Kitchen Extension & Loft Conversion"
- Info banner: "Data available from Brief & Contracts tabs" with "Sync from Brief & Contracts" button.
- T&C Tier indicator: "T&C Tier: Domestic — Edit in Contracts tab"
- **Project Summary block:**
  - Client: Mr & Mrs Patel
  - Site Address: 22 Birchwood Avenue, Chorlton, Manchester, M21 9LN
  - Project Type: Residential Extension
  - Contract Value: £1,753.29
  - Target Start: 20 April 2026
- "Company profile complete — Tripod Construction Ltd" success banner.
- "About Us — This proposal" section below.
- **Right panel — Status & Actions:**
  - Status: v1 — **Accepted**
  - Completion tracker: 5/7 items complete (✓ Client Introduction, ✓ Scope of Works, ○ Exclusions, ✓ Timeline, ✓ Payment Schedule, ○ Site Photos, ✓ T&Cs)
  - Buttons: **Save Proposal**, **Save Version (v2)**, **Copy Proposal Link**, **Send Proposal via Email**, **✨ AI Assistant**

**Issues noted:**
- Two items not complete: "Exclusions" and "Site Photos" — these are legitimate incomplete items, not bugs.
- The "Accepted" status displayed prominently is clear and useful.
- "Copy Proposal Link" and "Send Proposal via Email" are excellent workflow features for a construction SaaS.
- The 5/7 completion indicator is a great UX pattern for guiding users through the proposal completion.
- The ✨ AI Assistant button in the proposal context is a strong feature.

---

## 9. Live Projects

### 9a. Project Overview (`/dashboard/projects/overview`)

**Status:** ✅ Loads correctly  
**Observations:**
- Page: "22 Birchwood Avenue — Kitchen Extension & Loft Conversion" — Mr & Mrs Patel · 22 Birchwood Avenue, Chorlton, Manchester, M21 9LN · Started 20 Apr 2026
- Status badge: **"On Track"** (top right)
- KPI cards:
  - **Contract Value:** £1,753 (from active estimate)
  - **Budget Burn:** 53% — £699 of £1,320 budget
  - **Programme:** 0% — Currently: Groundworks
  - **Outstanding:** £0 — 0 invoices unpaid
- **Budget Status panel:** Progress bar, £699 costs posted / £1,320 budget, Invoiced £0, Received £0
- **Programme panel:** Mini Gantt showing Groundworks phase, 0% elapsed, with Start → End bar
- **Outstanding Invoices:** "All invoices paid — great work!" — positive messaging
- **Quick Action tiles:** Log Cost (P&L tracker), Raise Invoice (Billing), Add Variation (Variations log), Programme (View Gantt)

**Issues noted:**
- Budget Burn at 53% but Programme at 0% — costs have been posted ahead of programme progress. This is expected (groundworks costs logged before programme has started progressing) but the disparity is notable — the product would ideally flag this as a potential concern.
- The "On Track" status badge is green and appears automatic — it would be worth verifying the logic behind this status (is 53% budget burn at 0% programme actually "on track"?). **Potential issue: the "On Track" status may not account for the budget burn vs programme progress ratio.**
- The overview is clean, well-organised, and information-rich.

### 9b. Billing & Valuations (`/dashboard/projects/billing`)

**Status:** ✅ Loads correctly  
**Observations:**
- Page: "Billing & Valuations — Applications for payment, retention & aged debt — 22 Birchwood Avenue — Kitchen Extension & Loft Conversion"
- KPI cards:
  - **Revised Contract Sum:** £1,753.29
  - **Gross Certified to Date:** £0.00
  - **Net Invoiced (After Retention):** £0.00
  - **Remaining to Valuate:** £1,753.29
- Four sub-tabs: **Valuations** (selected) | Payment Schedule | Retention | Aged Debt
- **Valuations tab:** "Applications for Payment" table with columns: AFP, Period, Gross Valuation, Less Prev Cert, Retention, Net Due, Due Date, Status
- Empty state: "No applications raised yet" — appropriate empty state, not broken.
- Footer totals: Total Paid £0.00, Outstanding £0.00, Retention Held £0.00, Remaining to Valuate £1,753.29
- "+ New AFP" button to create application for payment.

**Issues noted:**
- No issues. Clean implementation of billing functionality. All empty states clearly communicate the next action required.

### 9c. Project Variations (`/dashboard/projects/variations`)

**Status:** ✅ Loads correctly  
**Observations:**
- Page: "Project Variations — Scope changes & extra works — 22 Birchwood Avenue — Kitchen Extension & Loft Conversion"
- KPI cards: Total Logged: 0, Pending Approval: £0.00 (0 variations), Approved Value: £0.00 (0 approved), Rejected: 0 (`—`)
- Variations Log table with columns: Ref, Title, Type/Section, Instructed, Status, Amount
- Empty state: "No variations logged yet"
- "+ Log Variation" button.
- Filter dropdowns: status and type filters.
- **Issue noted:** The "Active Project" dropdown in the sidebar shows "Select a project..." instead of the project loaded via URL query parameter. This is a sidebar context issue — the variations page loaded correctly for the project but the sidebar active project widget didn't update. The page content is correct but the sidebar shows no active project. **UX inconsistency: sidebar active project doesn't always sync with the project in the URL.**

### 9d. Job P&L (`/dashboard/projects/p-and-l`)

**Status:** ✅ Loads correctly  
**Observations:**
- Page: "Job P&L — Financial position for: 22 Birchwood Avenue — Kitchen Extension & Loft Conversion · Mr & Mrs Patel"
- KPI cards:
  - **Contract Value:** £1,753.29 (original contract sum)
  - **Budget Cost:** £1,320.00 (+£73 risk (5%))
  - **Estimated Margin:** £433.29 (+£73 risk, 24.7% margin)
  - **Costs to Date:** £699.24 (50% of budget)
  - **Committed:** £0.00 (no POs placed)
  - **Invoiced to Date:** £0.00 (£0 received)
- Budget Burn bar: 50.2% exposure (incl. £73 risk) — £693 remaining
- Forecast margin at completion: £361 (20.6%)
- Three tabs: **Budget Vs Actual** (selected) | Cost Entries | Invoices
- Budget Vs Actual table:
  - Groundworks: Budget £1,200.00, Actual `—`, Committed `—`, Forecast Final £1,200.00, Variance +£0.00, 0%
  - Masonry: Budget `—`, Actual £699.24, Committed `—`, Forecast Final £699.24, Variance `—`
  - Risk Allowance (5% of cost): Budget £72.60, Actual `—`, Committed +£72.60 (Contingency)
  - **Totals (incl. risk):** Budget £1,392.60, Actual £699.24, Committed `—`, Forecast Final £1,899.24, Variance +£693.36, 50%
- "Click any row to drill down by cost type" tooltip present.
- "Risk allowance shown separately" info notice.

**Issues noted:**
- Masonry has actual costs (£699.24) but no budget allocated — this creates a `—` budget entry and a `—` variance, which is confusing. The actual costs appear to have been logged against Masonry but the estimate has £0 for Masonry (the Aircrete block line item had a zero rate). This is a data consistency issue in the demo, not necessarily a product bug.
- The forecast final total (£1,899.24) exceeds the contract sum (£1,753.29) — this means the project is forecast to lose money. The product doesn't appear to prominently flag this situation on the overview page (which still shows "On Track").
- **Potential product issue:** The "On Track" status on the Overview page may not be correctly calculated when the forecast final cost exceeds the contract sum. Worth investigating the status logic.

### 9e. Change Management (`/dashboard/projects/change-management`)

**Status:** ✅ Loads correctly  
**Observations:**
- Page: "Change Management — Change control register — 22 Birchwood Avenue — Kitchen Extension & Loft Conversion"
- KPI cards: Total Events: 0 (0 open), Total Claimed: £0.00 (0 events), Agreed Value: £0.00 (0 agreed), Time Impact: 0d claimed
- Filter dropdowns: "All Statuses" and "All Types"
- Empty state: "No change events yet. Log compensation events, EOT claims, and contract notices here."
- "+ New Change Event" button.

**Observations:**
- Clean implementation. The description of what to log here (compensation events, EOT claims, contract notices) is helpful for users unfamiliar with contract administration.
- No issues with this page — appropriate empty state.

### 9f. Communications (`/dashboard/projects/communications`)

**Status:** ✅ Loads correctly  
**Observations:**
- Page: "Communications — Site instructions, RFIs, early warnings & document register — 22 Birchwood Avenue — Kitchen Extension & Loft Conversion"
- KPI cards: Site Instructions: 0 (0 issued), Open RFIs: 0, Open EWNs: 0, Documents: 0 (0 received)
- Four sub-tabs: **Site Instructions** (selected) | RFIs | Early Warning Notices | Document Register
- Site Instructions table: Ref, Type, Recipient, Date Issued, Description, Status
- Empty state: "No site instructions yet"
- "+ Issue Instruction" button.

**Observations:**
- Well-structured communications hub covering all standard construction communication types.
- No issues — appropriate empty states.

---

## 10. Reporting

### 10a. Reports & Photos (`/dashboard/reporting`)

**Status:** ✅ Loads correctly  
**Observations:**
- Page: "Reporting — Site photos, progress reports & project control"
- Project selector: "Project: 14 Maple Close — Rear Ex" (dropdown, loads a different project by default — not the 22 Birchwood project)
- Four tabs: **Site Photos** (selected) | Weekly Reports | Project Control | Portfolio Overview
- Site Photos: "No photos yet — Upload site photos to start building your gallery"
- "+ Upload Photos" button.

**Issues noted:**
- The reporting page loads with a different project (14 Maple Close) selected rather than the previously active project (22 Birchwood Avenue). The project context doesn't carry across from project-specific pages to the reporting module. **UX friction: users need to manually re-select their project in the reporting dropdown.**

### 10b. Management Accounts (`/dashboard/management-accounts`)

**Status:** ✅ Loads correctly  
**Observations:**
- Page: "Management Accounts — Tripod Construction Ltd · Consolidated financial view"
- Period selector: **This Financial Year** (dropdown with other options)
- Tabs: **Overview** (selected) | P&L by Project | Cash Flow | WIP Schedule | Key Ratios | Export
- KPI cards:
  - **Period Revenue:** £0 (paid invoices)
  - **Period Costs:** £0 (all expenses)
  - **Gross Margin:** 0.0% (revenue vs costs)
  - **Outstanding:** £0 (awaiting payment)
  - **Active Projects:** 0 (currently live)
  - **Total WIP:** £0 (uninvoiced contract value)
  - **Retention Held:** £0 (by clients)
  - **Total Projects:** 19 (all time)
- Monthly Revenue vs Costs chart: "No financial data for this period."
- Period Summary: Gross Revenue £0, Less: Direct Costs (£0), Gross Profit...

**Issues noted:**
- "Total Projects: 19 (all time)" — this accounts figure is interesting as it shows 19 total projects have been created across the account's lifetime, confirming the test data volume.
- All financial metrics show £0 because no invoices have been raised/paid in the demo. The KPIs populate correctly once financial activity occurs.
- The Management Accounts section is comprehensive with P&L, Cash Flow, WIP Schedule, Key Ratios, and Export tabs — a full accounting overview suite.
- "Active Projects: 0" on Management Accounts yet the Overview shows the project is "Active" in the pipeline — same counting discrepancy as the home page KPIs (see Section 1).

### 10c. CIS Compliance (`/dashboard/cis`)

**Status:** ✅ Loads correctly  
**Observations:**
- Page: "CIS Compliance — UK Construction Industry Scheme — subcontractor deductions"
- "CIS Settings" button top right.
- Tabs: **Overview** (selected) | Subcontractors | Payment Records | Monthly Returns
- KPI cards:
  - **Active Subcontractors:** 0 (0 total registered)
  - **Deductions YTD:** £0 (this tax year, from 6 Apr)
  - **Gross Paid YTD:** £0 (to all subcontractors)
  - **Unverified:** 0 (action required)
- "Recent Payments: No payments recorded yet."
- "How CIS works" educational panel with 3 steps: Verify first → Deduct & pay → File monthly return.

**Issues noted:**
- The "How CIS works" educational panel is a nice onboarding element for new users unfamiliar with CIS.
- No issues — appropriate empty state with educational content.

---

## 11. Closed Projects

### 11a. Archive (`/dashboard/projects/archive`)

**Status:** ✅ Loads correctly  
**Observations:**
- Page: "Project Archive — Closed projects with preserved financial outcomes"
- Search bar: "Search projects, clients, addresses..."
- Filter: "All types" dropdown
- Empty state: "No archived projects — Projects you close and archive will appear here with their full financial record."
- No content — appropriate intentional empty state.

**Issues noted:**
- No issues. Clean empty state.

### 11b. Final Account (`/dashboard/projects/final-account`)

**Status:** ✅ Loads correctly  
**Observations:**
- Page: "Final Account Statement — Complete financial settlement — 22 Birchwood Avenue — Kitchen Extension & Loft Conversion"
- Status: **Draft** badge
- Buttons: Export PDF, Notes, Update Status
- KPI cards:
  - **Adjusted Contract Sum:** £1,593.90
  - **Total Certified:** £0.00
  - **Retention Outstanding:** £0.00
  - **Balance of Account:** £1,593.90
- Final Account Statement table:
  - Original Contract Sum: £1,593.90
  - Approved Variations: £0.00
  - **Adjusted Contract Sum: £1,593.90**
  - Less: Total Certified: £–0.00
  - Add: Retention Outstanding: £0.00
  - **Balance of Account: £1,593.90**
  - **Final Balance Due to Contractor:** £1,593.90 (green, large)
- "+ Add Adjustment" button.

**Issues noted:**
- The Final Account shows Original Contract Sum as £1,593.90 — but the proposal and billing pages show the contract sum as £1,753.29. **Discrepancy: the final account sum (£1,593.90) differs from the contract sum shown elsewhere (£1,753.29).** This could be a data discrepancy in the demo, or the final account may have been manually adjusted.
- "£–0.00" formatting for "Less: Total Certified" is slightly unusual — a negative zero. Could be formatted as "£0.00" or "(£0.00)".

---

## 12. Theme & UI/UX General Notes

### Dark Theme
- App uses a dark theme by default: very dark navy/near-black background (#0a0a0a range), dark card surfaces, muted grey text, white for primary content.
- Light/Dark toggle in the sidebar bottom shows "Light Mode" label (meaning clicking switches to light mode).
- Toggling to light mode shows slightly different shading but the theme switch appeared subtle in testing — the overall appearance remained very dark. **The light mode implementation may need verification** — it may apply a slightly lighter background without a full white-themed switch.

### Typography & Layout
- Clean, consistent typography throughout. Section headers are well-sized.
- Card-based layouts used consistently across KPI sections.
- Two-column layouts on forms work well at desktop widths.

### Navigation
- Left sidebar is well-structured with logical groupings.
- The "Active Project" widget in the sidebar is a useful quick-nav feature but has a **context sync issue** — it doesn't always update when navigating directly to project pages via URL (e.g., on the Variations page it showed "Select a project..." despite the page loading the correct project).
- The breadcrumb within the project module (Overview | Brief | Estimating | Drawings | Programme | Contracts | Proposal | Comms) is well-organised and provides clear workflow guidance.
- No visible back/forward breadcrumb navigation from the sidebar — users rely on the browser back button or re-navigating via the sidebar.

### Mobile Responsiveness
- Not fully tested (reviewing at desktop viewport). The left sidebar takes ~250px and the main content uses the remaining width. On smaller screens this could cause layout issues. The sidebar would ideally collapse or hamburger-menu on mobile.

### Empty States
- Empty states are well-designed throughout: appropriate icons, helpful explanatory text, and clear CTAs.
- Examples: "No active projects yet — View pipeline →", "No variations logged yet", "No applications raised yet", etc.

---

## 13. Summary of Issues Found

### 🔴 Potential Bugs / Data Issues
1. **Contract Sum discrepancy:** Final Account shows £1,593.90 vs Billing/Proposal showing £1,753.29 — unexplained difference.
2. **"On Track" status inaccuracy:** Project Overview shows "On Track" but the Job P&L shows forecast final cost (£1,899.24) exceeds contract sum (£1,753.29) — the project appears to be heading for a loss but is labelled as on-track.
3. **Test data in production:** "TEST SCROLL..." project by "Mr Test" is visible in the Estimating column of the live pipeline.
4. **Mr Bob Jovi — zero labour rates:** Staff record with all £0.00 rates could produce incorrect estimates if used.
5. **Masonry actual cost vs zero budget:** £699.24 in actual costs logged against Masonry but the estimate has £0 budget for Masonry (Aircrete block line item has zero rate).

### 🟡 UX Issues / Friction Points
6. **Active Project sidebar context doesn't sync:** On some project pages (e.g., Variations), the sidebar "Active Project" widget shows "Select a project..." instead of the active project.
7. **Reporting page loads wrong project:** Opens with "14 Maple Close" rather than previously active project.
8. **Dashboard Home KPIs vs Pipeline KPIs inconsistency:** Both show "Pipeline Value" with different values (£0 vs £182k). The labelling should distinguish between "Live Contract Value" (home) and "Total Pipeline Value" (pipeline).
9. **Pipeline and Home show different "Active Projects" counts:** Home shows 0, Pipeline shows 1 Active.
10. **Case Studies duplication:** Content managed in two places (/settings/profile and /settings/case-studies) — potentially confusing.
11. **No "Forgot Password?" link on login page.**
12. **Company Profile Trading Address:** Minor formatting issue — "18 Jackdaw DriveColchester" (missing space).
13. **Cost Library P.06 gap:** Item P.06 missing from Preliminaries list (P.01–P.05, then P.07 onwards).
14. **Light mode theme:** The light mode toggle appears to produce a very subtle change — may not fully implement a "light" theme.
15. **Login redirect:** Successful login redirects to `/dashboard` (Pipeline) rather than `/dashboard/home` — slight inconsistency.
16. **"£–0.00" formatting** in Final Account — minor display issue.

### 🟢 Strengths & Highlights
- **Comprehensive feature set** for construction pre-construction and live project management.
- **AI integration** throughout: AI Brief Assistant, AI Contract Shield, AI Enhance for case studies, AI Proposal Assistant.
- **Proposal generation** with completion tracker, PDF export, shareable links, and email sending.
- **Contract management** with multiple contract types (Domestic, Commercial, Specialist, Client Contract review).
- **Gantt/Programme** with critical path, live tracking, and estimate-driven regeneration.
- **CIS Compliance** module — rare in construction SaaS, genuinely valuable for UK contractors.
- **Management Accounts** suite (P&L by project, Cash Flow, WIP Schedule, Key Ratios, Export).
- **Well-designed empty states** with contextual CTAs throughout.
- **Dark theme** is polished and professional.
- **Labour rates** support both Simple and Full Buildup modes — flexible for different accounting approaches.
- **Plant & Equipment Register** tracks depreciation-based chargeout rates.
- **Cost Library** with 330+ UK market benchmarks across 13 trade categories, personalizable.
- **Communications module** covers Site Instructions, RFIs, Early Warning Notices, Document Register.
- **Billing & Valuations** supports AFP-based billing with retention and aged debt tracking.

---

*Review completed: Saturday, 11 April 2026*
