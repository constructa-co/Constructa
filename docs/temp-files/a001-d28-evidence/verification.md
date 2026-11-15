# A001 D28 — whole-route palette walkthrough (synthetic follow-up)

**Base SHA:** `527c7cf9f70f5ac84b35e146b9d7248a4fb7b005` (main, merged #160)  
**Branch (this follow-up):** `cursor/a001-d28-evidence-followup-4902`  
**Scope:** Dashboard/core editing palette (`src/lib/core-editing-palette.ts` — sage `#c9efcf` / ink `#182c1b`). Marketing cohort palette (`phase-one.module.css` + cohort module CSS variables). Semantic status/link blues preserved. No marketing source edits; inspection via offline fixtures only. No production writes, auth, hosted navigation, or deploy.

## Palette policies applied

| Surface | Policy | Tokens |
|---------|--------|--------|
| Dashboard / authenticated chrome | Core editing palette | `corePrimaryButton`, emerald focus rings, charcoal active nav (`gray-900`) |
| Phase-one marketing (cohort) | Separate marketing policy | `--accent: #c9efcf`, `--accent-ink: #182c1b`, `--base: #101211` |
| `/customers` (cohort) | Documented exception | Tailwind `bg-white text-black` CTAs (utility, not phase-one module) |
| `/privacy-policy`, `/terms-of-service` | Legal copy pages | Dark prose; no primary action palette walk (content-only) |

## Confirmed deviations corrected (#160, still valid on base)

| Route / surface | Issue | Fix |
|-----------------|-------|-----|
| Contract admin → Delay analysis (`DelayAnalysisTab`) | “Run Analysis” primary used `bg-blue-600 hover:bg-blue-500` | `corePrimaryButton` + `coreFocusVisibleRing` |
| Contract admin → Supervisor invite (`SupervisorInvite`) | “Generate Link” primary used brand blue | Same core palette tokens |
| `/offline` public page | Constructa mark tile used `bg-blue-600` | Sage mark `#c9efcf` / ink `#182c1b` (CTA already on palette) |

No new confirmed palette defects on this follow-up run.

## Screenshot evidence (synthetic, offline CSP)

Artifacts directory: `/opt/cursor/artifacts/a001-d28-palette/`

| Artifact | Route / surface | What it proves |
|----------|-----------------|----------------|
| `navigation-palette-desktop-dark.png` | Dashboard nav chrome | Real `SidebarNav` / `ProjectNavBar` active row: charcoal + sage icons |
| `marketing-palette-home.png` | `/`, `/landing` (cohort body) | Phase-one hero + header Apply CTA on charcoal base |
| `marketing-palette-features.png` | `/features`, `/product` | Product screenshots + sage primaries |
| `marketing-palette-pricing.png` | `/pricing` | Preview access CTAs on marketing palette |
| `marketing-palette-about.png` | `/about` | Cohort about page palette |
| `marketing-palette-contact.png` | `/contact` | Contact primary + accent typography |
| `marketing-palette-apply.png` | `/apply` | Founding cohort form panel accents |
| `marketing-palette-guides.png` | `/guides` | Guides hub cards + intro |
| `marketing-palette-guide-article.png` | `/guides/review-brief-and-price` | Guide article view (representative slug) |
| `marketing-palette-customers-exception.png` | `/customers` | White utility CTAs (documented exception) |

### Playwright computed-style suites (Chromium headless, no network)

| Suite | Result | Fixture build |
|-------|--------|---------------|
| `marketing-palette.spec.ts` | 11 passed | `build-brief-price.mjs … marketing-palette` |
| `navigation-palette.spec.ts` | 4 passed | `compile.mjs … navigation-palette` (Chromium config in `docs/temp-files/a001-d28-playwright-chromium.config.ts`) |

Prior #160 evidence retained: `a003-palette.spec.ts` (estimating line form / build-up) — not re-built in this follow-up (single new phase-1 offline bundle: `marketing-palette` only).

## Static verification

- `src/lib/a001-palette-audit.test.ts` — no `bg-blue-600 hover:bg-blue-700` primary pairs under `dashboard` + shared components (excluding marketing).
- Focused A001 palette Vitest on this run: 28 tests (audit + commercial + resources + standalone controls) — all passed.

## Route inventory (77 `page.tsx` routes)

Full list: `docs/temp-files/a001-d28-evidence/route-inventory.json`.

### Visually verified this follow-up

| Kind | Routes | Method |
|------|--------|--------|
| Marketing (phase-one cohort) | `/`, `/landing`, `/features`, `/product`, `/pricing`, `/about`, `/contact`, `/apply`, `/guides`, `/guides/:slug` (one slug) | Offline `marketing-palette` + screenshots + computed RGB |
| Marketing exception | `/customers` | Same fixture; white CTA documented |
| Navigation chrome | All authenticated dashboard shells (synthetic job context) | Offline `navigation-palette` + screenshot + computed RGB |
| Estimating (#160) | `/dashboard/projects/costs` | Offline `a003-palette` (prior artifacts) |
| Standalone controls | `/offline`, project picker, postcode, install banner, supervisor portal, etc. | `a001-workflow-standalone-controls-brand.test.ts` |
| Commercial hub | accounting, cis, contract-admin client, p-and-l log cost | `a001-commercial-controls-palette.test.ts` |
| Resources | staff, plant, portfolio hubs | `a001-resources-primary-palette.test.ts` |

### Reachable via existing offline fixtures (not re-screenshoted here)

| Routes | Offline scenario |
|--------|------------------|
| `/login` | `signin-native` / `signup-native` |
| `/dashboard/settings/profile` | `profile-sections` |
| Proposal reading surfaces | `reader-styled`, `reading-pages` |
| Multi-step work-winning journey | `journey`, `unseeded-journey`, `pricing-payments-journey` |
| Programme | `programme-styled`, `detailed-geometry`, `programme-mode` |
| Import UI | `import-render` |

### Blocked without session, project data, or dynamic tokens

- **Admin:** `/admin`
- **Auth lifecycle:** `/auth/*` (except offline login fixture above)
- **Onboarding:** `/onboarding` (requires server layout chain)
- **Per-project modules:** overview, billing, variations, full contract-admin page, drawings viewer, live/P&L, reporting, intelligence, data/*, foundations, mobile hub, management-accounts, archive, communications, change-management, final-account, handover, lessons-learned, quick-quote, library template editors, profile interview/import/readiness, integrations, api-keys
- **Dynamic public:** `/proposal/[token]`, `/supervisor/[token]` (token-specific server render)
- **Legal marketing:** `/privacy-policy`, `/terms-of-service` (no phase-one primary controls; copy-only)
- **Full launch profile marketing:** `full` profile home/landing/product pages (not cohort policy; not walked — cohort is production default)

## Harness notes

- `e2e/local-phase1/build-brief-price.mjs`: new `marketing-palette` scenario; static image imports resolve to placeholder modules for offline compile; `next/image` exports `getImageProps` for product screenshots.
- `e2e/local-navigation/compile.mjs` `read()` tolerates GNU/Linux `stat` (macOS `%Sf` dataless probe only).
- Evidence capture: `capture-marketing-screenshots.mjs`, `capture-navigation-screenshot.mjs` under `docs/temp-files/a001-d28-evidence/`.

## Receipts

| Item | Value |
|------|-------|
| Base SHA | `527c7cf9f70f5ac84b35e146b9d7248a4fb7b005` |
| Phase-1 offline bundle | `/opt/cursor/artifacts/a001-d28-palette/phase1-bundle` (`marketing-palette`, 126 modules) |
| Nav offline bundle | `/opt/cursor/artifacts/a001-d28-palette/nav-bundle` (`navigation-palette`, 29 modules) |
| Marketing Playwright | 11/11 pass |
| Navigation Playwright (Chromium) | 4/4 pass |
| A001 Vitest (focused) | 28/28 pass |
| Deviations fixed this run | None |
| PR | Left to Codex (branch pushed only) |