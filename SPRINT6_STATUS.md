# Sprint 6 Status — Constructa

**Completed:** Sunday 29 March 2026  
**Commit:** `92ff7f5` — feat: Sprint 6 — AI proposal wizard, case studies, PDF premium redesign  
**Branch:** main  

---

## Track A — AI Proposal Wizard ✅

### A1: First-Time Modal
- **File:** `src/app/dashboard/projects/proposal/client-editor.tsx`
- Detects when ALL of `initialScope`, `proposal_introduction`, `gantt_phases`, `payment_schedule` are empty
- Shows full-screen dark-slate modal with "Build with AI →" (blue) and "Fill manually" (ghost) buttons

### A2: AI Chat Wizard
- **New file:** `src/app/dashboard/projects/proposal/ai-wizard.tsx`
- Full-screen modal overlay, dark slate theme, max-w-2xl centered panel
- Chat-style UI: 6 questions (description, client/site, value, start date, duration, extras)
- Pre-fills from project data (client_name, site_address, potential_value, start_date)
- Animated loading states cycling through: "Writing your scope...", "Building timeline...", "Setting payment stages...", "Crafting introduction..."
- Calls `generateFullProposalAction` and fills all editor fields on success
- Saves to DB immediately via action, shows "Proposal pre-filled ✓" toast

### A2: generateFullProposalAction
- **File:** `src/app/dashboard/projects/proposal/actions.ts`
- Added `ProposalAnswers`, `GanttPhaseResult`, `PaymentStageResult`, `GeneratedProposal` interfaces
- Calls Gemini 1.5 Flash with `responseMimeType: "application/json"`
- Normalises gantt phases with `id`, `color` cycling, `duration_unit`
- Persists to DB and revalidates path

### A3: Floating AI Assistant Button
- Added "✨ AI Assistant" button in sidebar above Generate PDF button
- Clicking opens wizard even if proposal already has content (for regeneration)

---

## Track B — Case Studies ✅

### B1: DB Migration
- **File:** `supabase/migrations/20260329200000_sprint6_case_studies.sql`
- `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS case_studies jsonb DEFAULT '[]'::jsonb`
- Applied to remote via `supabase db push`

### B2: Case Studies UI in Profile
- **File:** `src/app/dashboard/settings/profile/profile-form.tsx`
- Added `CaseStudy` interface and `CaseStudyCard` component
- Full section: Project Name, Type, Contract Value, Programme Duration, Client, Location
- What We Delivered (textarea), Value Added (textarea)
- 3 photo upload slots with drag-and-drop to `proposal-photos` bucket
- Collapse/expand toggle per card, Remove button
- "+ Add Case Study" button and empty state
- `updateProfileAction` updated to parse and save `case_studies` JSON

### B3: Case Studies in PDF
- **File:** `src/app/dashboard/projects/proposal/proposal-pdf-button.tsx`
- Rendered after About Us page if `profile.case_studies` has entries
- Navy full-width header bar with project name
- Two-column layout: left 60% (badges + What We Delivered + Value Added), right 40% (first photo)
- Fallback grey box if photo unavailable
- Separator line between each case study
- Auto-adds pages if content overflows

---

## Track C — PDF Premium Redesign ✅

### C1: Cover Page Redesign
- Full-page navy background (entire page)
- Logo: white pill/box centered, 74mm wide, rounded corners
- If no logo: company name in white 32pt bold centered
- Thin white rule after logo
- "PROPOSAL & FEE PROPOSAL" small uppercase centered
- Project name at y=110, 38pt bold white centered
- "Prepared exclusively for" + client name (20pt) + client address centered
- Two side-by-side navy-slightly-lighter boxes at y=230: DATE ISSUED/VALID UNTIL and REFERENCE/CONTRACT VALUE
- Company name + website at very bottom

### C2: About Us Page Redesign
- Large 22pt heading without numbered bar
- Two-column layout (55% left, 45% right)
- Left: capability statement, specialisms as blue pill badges, years trading badge
- Right: contact info box (rounded, slate-50 bg) with label/value rows, accreditations tick-list

### C3: Content Pages — Section Headers
- All content pages use new `renderSectionHeading()` function
- Format: `01` in slate-300 9pt left, section title in navy 18pt bold, full-width thin navy rule
- Section counter auto-increments through the document

### C4: Gantt — Proper Sequential Bars
- Find earliest start date across ALL phases (relative to `earliestStart`)
- Bar X position: `chartX + (startOffset / cappedTotalDays) * chartW`
- Bar width proportional to `duration_days / cappedTotalDays`
- Week headers (W1, W2, W3...) calculated from earliest date
- If no start dates set, phases are sequential from project.start_date or today

### C5: Fee Proposal — Better Total Section
- Full mode: summary box showing Subtotal (cost), Overhead & Profit %, TOTAL EXCL. VAT (large bold navy), VAT @ 20%, TOTAL INCL. VAT (navy bar, largest)
- Summary mode: same structure — TOTAL EXCL. VAT, VAT, TOTAL INCL. VAT navy bar

---

## Technical
- `npx tsc --noEmit` — zero errors ✅
- All existing functionality preserved ✅
- Dark slate theme throughout dashboard ✅
- All server actions use `"use server"`, interactive components use `"use client"` ✅
