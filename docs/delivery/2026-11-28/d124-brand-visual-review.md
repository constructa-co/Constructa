# D124 — Brand visual review (PR 281 lane)

**Branch:** `codex/d123-brand-consistency-20261128`  
**Source SHA:** `5a65d1b45cea73ea068a9fcf77dc1dc87410aaca`  
**Evidence pack:** `docs/evidence/d124-brand-review/` (committed PNGs, manifest, contact sheets)  
**Capture date:** 2026-11-28 (local VM, unpublished)

## Viewports

| Tag | Width | Height |
| --- | ---: | ---: |
| `375` | 375 | 812 |
| `1440` | 1440 | 900 |

## Per-route render class (R1: inspect committed PNGs)

| Route ID | Path | Class | Brand coverage? | Capture method |
| --- | --- | --- | :---: | --- |
| landing | `/` | **REAL_RENDER** | Yes | Local `next dev` @ 3010 |
| product | `/product` | **REAL_RENDER** | Yes | Same |
| pricing | `/pricing` | **REAL_RENDER** | Yes (local only) | Same |
| login | `/login` | **REAL_RENDER** | Yes | Same |
| dashboard | `/dashboard/home` | **SYNTH_COMPONENT_VISUAL** | Yes (component) | Offline `d124-brand-home` → **HomeClient** |
| estimate | `/dashboard/projects/costs` | **SYNTH_COMPONENT_VISUAL** | Yes (component) | Offline `a003-palette` → **EstimateClient** |
| programme | `/dashboard/projects/schedule` | **SYNTH_COMPONENT_VISUAL** | Yes (component) | Offline `detailed-geometry` → **ClientSchedulePage** |
| proposal | `/dashboard/projects/proposal` | **SYNTH_COMPONENT_VISUAL** | Yes (component) | Offline `proposal-view` → **ReviewSendClient** |

### Distinctions

- **REAL_RENDER:** Full public route in Chromium against local dev. Not authenticated.
- **SYNTH_COMPONENT_VISUAL:** Actual dashboard components with synthetic TEST DATA, compiled Tailwind/CSS modules, offline CSP page — **not** a signed-in Next route, **not** Supabase, **not** persistence. Login redirect does **not** count as workflow coverage.
- **SYNTHETIC_RENDER_ERROR:** If fixture compile/render fails, harness writes a labelled error PNG (not coverage).

## Workflow fixtures (local/test only)

| Workflow PNG | Compiler scenario | Entry |
| --- | --- | --- |
| dashboard | `d124-brand-home` | `e2e/local-phase1/d124-brand-home-entry.tsx` |
| estimate | `a003-palette` | `e2e/local-phase1/a003-palette-entry.tsx` |
| programme | `detailed-geometry` | `e2e/local-phase1/detailed-geometry-entry.tsx` |
| proposal | `proposal-view` | `e2e/local-phase1/proposal-view-entry.tsx` |

Bundle metadata (no committed JS): `docs/evidence/d124-brand-review/fixture-bundles/*/source-manifest.json`  
Build: `node docs/temp-files/d124-build-fixture-bundles.mjs` → `/tmp/constructa-d124-fixture-bundles/`

## Contact sheets

| File | Contents |
| --- | --- |
| `contactsheet-real-routes-375.png` / `-1440.png` | landing, product, pricing, login |
| `contactsheet-synth-workflow-375.png` / `-1440.png` | dashboard, estimate, programme, proposal (component fixtures) |

## Brand drift inspection (281 @ 5a65d1b4)

Workflow SYNTH PNGs reviewed at this pass: sage/emerald KPI and CTA chrome on Home and Estimate; planner sage bars on Programme; proposal editor dark workspace. **No additional palette code changes** required from this pass.

## Re-run (local only)

```bash
node docs/temp-files/d124-build-fixture-bundles.mjs
npm run dev -- --port 3010 --hostname 127.0.0.1   # public routes only
D124_SHA=5a65d1b45cea73ea068a9fcf77dc1dc87410aaca npx playwright test -c docs/temp-files/d124-playwright.config.mjs
python3 docs/temp-files/d124-build-contact-sheets.py
```