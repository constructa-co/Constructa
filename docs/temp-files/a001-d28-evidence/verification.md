# A001 D28 — whole-route palette walkthrough (synthetic)

**Branch:** `cursor/a001-d28-route-palette-walkthrough-2527`  
**Scope:** Approved charcoal/sage primary palette (`src/lib/core-editing-palette.ts`). Semantic status/link blues preserved. Marketing `(marketing)/` not edited (inspection only). No production writes, auth, or hosted navigation.

## Confirmed deviations corrected

| Route / surface | Issue | Fix |
|-----------------|-------|-----|
| Contract admin → Delay analysis (`DelayAnalysisTab`) | “Run Analysis” primary used `bg-blue-600 hover:bg-blue-500` | `corePrimaryButton` + `coreFocusVisibleRing` |
| Contract admin → Supervisor invite (`SupervisorInvite`) | “Generate Link” primary used brand blue | Same core palette tokens |
| `/offline` public page | Constructa mark tile used `bg-blue-600` | Sage mark `#c9efcf` / ink `#182c1b` (CTA already on palette) |

## Screenshot evidence (synthetic, offline CSP)

Computed-style Playwright (Chromium headless, no network):

| Artifact | What it proves |
|----------|----------------|
| `/opt/cursor/artifacts/a001-d28-palette/navigation-palette-desktop-dark.png` | Real `SidebarNav` / `ProjectNavBar` active row: charcoal + sage icons |
| `/opt/cursor/artifacts/a001-d28-palette/a003-palette-line-form-*.png` | Advanced estimating line form primary / focus sage |
| `/opt/cursor/artifacts/a001-d28-palette/a003-palette-build-up-*.png` | Build-up panel Apply + selection accent |

Playwright suites: `navigation-palette.spec.ts` (4 passed), `a003-palette.spec.ts` (4 passed).

## Static verification

- `src/lib/a001-palette-audit.test.ts` — no `bg-blue-600 hover:bg-blue-700` primary pairs under `dashboard` + shared components (excluding marketing).
- 53 focused A001 palette/brand Vitest cases under `src/**/a001-*.test.*` — all passed this run.

## Route inventory (77 `page.tsx` routes)

Full list: `docs/temp-files/a001-d28-evidence/route-inventory.json`.

### Verified in this run (representative / harness)

| Kind | Routes / surfaces | Method |
|------|-------------------|--------|
| Navigation chrome | All authenticated dashboard shells (synthetic job context) | Offline navigation-palette fixture + computed RGB |
| Estimating | `/dashboard/projects/costs` (advanced line + build-up) | Offline `a003-palette` fixture + screenshots |
| Standalone controls | `/offline`, project picker, postcode, install banner, supervisor portal, etc. | `a001-workflow-standalone-controls-brand.test.ts` |
| Commercial hub | accounting, cis, contract-admin client, p-and-l log cost | `a001-commercial-controls-palette.test.ts` |
| Resources | staff, plant, portfolio hubs | `a001-resources-primary-palette.test.ts` |
| Remaining dashboard TSX | Whole-tree scan | `a001-palette-audit.test.ts` |

### Not screenshot-verified in this run (named gaps)

These require authenticated Supabase session, project fixture data, or multi-step server rendering not mounted in offline bundles:

- **Admin:** `/admin`
- **Auth lifecycle:** `/auth/*`, password reset flows
- **Onboarding:** `/onboarding`
- **Per-project modules without offline entry:** overview, billing, variations, contract-admin full page (tabs beyond extracted components), drawings viewer, live/P&L dashboards, reporting, intelligence, data/*, foundations, mobile hub, management-accounts, archive, communications, change-management, final-account, handover, lessons-learned, quick-quote, programme (standalone path), library templates editor, case-study library editor routes, profile interview/import/readiness, integrations, api-keys
- **Dynamic public:** `/proposal/[token]`, `/supervisor/[token]`, `/guides/[slug]` (token/slug-specific rendering)
- **Marketing cohort pages:** `/`, `/landing`, `/about`, `/apply`, etc. — A001 register notes marketing palette is intentionally separate; not visually walked here (no marketing source changes)

**Note:** Static audits cover primary-action blues across dashboard TSX; unlisted routes are “not visually verified” not “known failing.”

## Harness note

`e2e/local-navigation/compile.mjs` `read()` tolerates GNU/Linux `stat` (macOS `%Sf` dataless probe only) so cloud agents can build offline palette fixtures.