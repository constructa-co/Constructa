# Sprint 5 — Proposal Polish — Status

**Date:** 2026-03-29  
**Status:** ✅ Complete

## Changes Delivered

### FIX 1 (URGENT): Company Profile Save Bug ✅
- **Migration:** `20260329000001_sprint5.sql` — adds `UPDATE` RLS policy `update_self_profile` on `profiles`
- **Action:** `src/app/dashboard/settings/profile/actions.ts` — removed `active_organization_id`, added `business_type` field, returns `{ success: true }`
- **Page:** Converted to server + client split (`profile-form.tsx`) — shows `sonner` toast "Profile saved ✓" on success

### FIX 2: Colour Scheme — Proposal Editor Readability ✅
- Warning banner updated to `bg-amber-950/40 border border-amber-700` with `text-amber-200`/`text-amber-300` for clear contrast

### CHANGE 3: Contractor Onboarding Flow ✅
- **`src/app/onboarding/page.tsx`** — server component, checks if onboarding complete, redirects if so
- **`src/app/onboarding/onboarding-client.tsx`** — 4-step wizard (light mode, max-w-2xl centered):
  - Step 1: Business details (name, phone, address with postcode lookup, website, years trading)
  - Step 2: Trade radio cards (10 trades with emoji)
  - Step 3: Capabilities (specialisms, AI capability statement, accreditations, insurance table)
  - Step 4: Standard T&Cs (editable, toggle standard/custom)
- **`src/app/onboarding/actions.ts`** — `saveOnboardingAction` (saves all fields, redirects), `generateCapabilityStatementAction` (Gemini 2-paragraph statement)
- **Middleware:** Redirects authenticated users with no `company_name` from `/dashboard` → `/onboarding`

### CHANGE 4: UK Address Autocomplete ✅
- **`src/components/postcode-lookup.tsx`** — calls postcodes.io, populates address on success, dark/light theme support
- Added to new project wizard (client address + site address) and onboarding (company address)

### CHANGE 5: Trade-Specific Project Types ✅
- **`src/lib/project-types.ts`** — `PROJECT_TYPES_BY_TRADE` mapping + `getProjectTypes()` helper
- **New project wizard** — fetches user's `business_type` from profile (server component), passes to client wizard, populates project type dropdown
- Shows note "Based on your trade profile" when a trade is set

### CHANGE 6: Contract Value Optional ✅
- Removed `required` attribute from contract value field
- Added helper text: "Optional — you can set this after pricing in the estimator"

### CHANGE 7: Template Filtering by Project Type ✅
- Added `projectTypes: string[]` to each template in `src/lib/templates.ts`
- New templates: Loft Conversion, Driveway, Consumer Unit Upgrade, Full Bathroom
- Step 2 of wizard filters templates to match selected project type
- Falls back to showing all templates if no specific match, with note

### CHANGE 8: Fix AI Scope — Works Without Estimates ✅
- `generateAiScopeAction` no longer returns error when no estimates found
- Builds context from: project type, scope_text, client details, site address, gantt phases, estimates (if available)
- New `rewriteIntroductionAction(projectId, currentText)` — Gemini rewrites introduction text

### CHANGE 9: Timeline — Duration Units + Sequential Mode ✅
- **Colour picker removed** — colours auto-assigned cycling: blue, green, orange, purple, slate, teal
- **Duration unit selector** per phase: Hours | Days | Weeks (default Weeks)
- **Sequential toggle** — when ON, each phase's start date auto-calculates from previous end
- `duration_unit` stored on `GanttPhase` interface

### CHANGE 10: Payment Schedule — Auto-populate from Estimates ✅
- `proposal/page.tsx` calculates `estimatedTotal` from all estimate totals
- Banner shown when `estimatedTotal > 0` and no `potential_value`: "Your estimator total is £X — use this as the contract value? [Yes, use it]"
- Contract value used for £ amount calculations in payment schedule
- Added "£ amounts calculated from contract value" note

### CHANGE 11: Site Photos — File Upload ✅
- Replaced URL inputs with drag-and-drop upload zones (6 slots, 2-column grid)
- Uses Supabase JS client directly to upload to `proposal-photos` bucket
- Shows thumbnail preview after upload, loading spinner during upload
- Caption input below each slot

### CHANGE 12: T&Cs — Add Custom Clauses ✅
- "+ Add Custom Clause" button appends new blank clause with auto-incremented number
- Standard clauses: "Reset" + "Hide/Show" buttons (not deletable)
- Custom clauses: "✕" delete button
- Title is editable inline for all clauses

### CHANGE 13: Client Introduction — AI Rewrite Button ✅
- "✨ Rewrite with AI" button shown when introduction.length > 20
- Calls `rewriteIntroductionAction`, replaces textarea content with rewritten text
- Shows loading spinner (Loader2) while rewriting

## DB Migration ✅
`supabase/migrations/20260329000001_sprint5.sql`:
- `business_type`, `insurance_schedule`, `default_tc_overrides` columns on profiles
- RLS UPDATE policy on profiles
- `proposal-photos` storage bucket + policies

## TypeScript ✅
`npx tsc --noEmit` — 0 errors

## Git Commit
feat: Sprint 5 — onboarding, address lookup, trade types, AI fixes, timeline units, photo upload, T&C custom clauses
