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
| programme | `/dashboard/projects/schedule` | **SYNTH_COMPONENT_VISUAL** | Yes (component) | Offline `detailed-geometry` → **ClientSchedulePage** (no `ThemeProvider`; light planner chrome **pre-existing** — see provenance) |
| proposal | `/dashboard/projects/proposal` | **SYNTH_COMPONENT_VISUAL** | Yes (component) | Offline **`d124-brand-proposal`** → **ReviewSendClient** + `ThemeProvider` + compiled Tailwind |

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
| proposal | **`d124-brand-proposal`** (D124 only) | `e2e/local-phase1/d124-brand-proposal-entry.tsx` — `proposal-view` **unchanged** (still no Tailwind per legacy scope) |

Bundle metadata (no committed JS): `docs/evidence/d124-brand-review/fixture-bundles/*/source-manifest.json`  
Build: `node docs/temp-files/d124-build-fixture-bundles.mjs` → `/tmp/constructa-d124-fixture-bundles/`

## Contact sheets

| File | Contents |
| --- | --- |
| `contactsheet-real-routes-375.png` / `-1440.png` | landing, product, pricing, login |
| `contactsheet-synth-workflow-375.png` / `-1440.png` | dashboard, estimate, programme, proposal (component fixtures) |

## Capture limitations (not a whole-app PASS)

| Topic | Finding |
| --- | --- |
| Landing `#review-captures` | **Prior** full-page shots could show large empty bands below the hero because `data-reveal` sections stayed hidden and below-fold `img` were lazy-decoded before screenshot. **Corrected in harness only:** force `reveal-in`, scroll, wait for both review-capture images (`capture-notes.json`). Home figures do **not** use the product `.viewport` padding box (`heldViewportBoxOnHome: false`). |
| Product `#product-screenshots` | **Intentional held CSS spacing:** `.viewport` `padding-top: 62.5%` (estimate `70%`); programme crop `translateY(-29%)` in `product-screenshots.module.css`. May look like empty margin above the visible crop — **not** treated as missing assets when images report `complete` in notes. |
| Workflow SYNTH | Component fixtures only; no signed-in Next route; see manifest `SYNTH_COMPONENT_VISUAL`. |
| Brand palette | Workflow SYNTH frames show sage/emerald/dark chrome consistent with 281. **No product spacing/CSS/marketing copy changes** in this pass. **No blanket “zero drift whole app” verdict** — public pages still need human R1 pass on contact sheets + individual PNGs. |

Diagnostic log: `docs/evidence/d124-brand-review/capture-notes.json`

## Capture defects fixed / remaining (not whole-app PASS)

| Item | Root cause | D124 action |
| --- | --- | --- |
| **Proposal SYNTH** (R1 e554) | `build-brief-price.mjs` Tailwind gate (line ~249) included `a003` / `detailed-geometry` / `d124-brand-home` but **not** `proposal-view` → CSS modules only → serif/blue/native chrome in PNG | New scenario **`d124-brand-proposal`** + Tailwind compile; recaptured `proposal_375/1440.png`; provenance JSON |
| **Programme SYNTH (375)** | Bare `FIXTURE_HTML` `<body>` omitted `layout.tsx` `bg-black text-white antialiased` → white canvas, grey panels looked like drift | Harness root body classes + recapture programme/proposal; **not** production palette |
| **Programme inner chrome** | `detailed-geometry` no `ThemeProvider` (A059) | Inner slate planner tokens remain product truth; provenance `theme` + `body` explicit |
| **Landing public** | lazy `img` + `data-reveal` | Harness timing fix (`capture-notes.json`) — bounded, not marketing CSS change |

## Brand drift inspection (281 @ 5a65d1b4) — bounded

Spot-check only on corrected PNGs. Proposal fixture defect was **capture/compiler**, not production palette authority.

## SYNTH workflow receipt (bounded)

| Workflow | Status | Notes |
| --- | --- | --- |
| dashboard / estimate / proposal | **SYNTH OK** | Proposal recaptured via `d124-brand-proposal` (Tailwind); provenance JSON on disk |
| programme | **SYNTH OK** (post-bundle fix) | Blank render fixed (`sessionStorage` shim). **Contrast:** light planner chrome is **pre-existing** `detailed-geometry` scope — see programme `capture-provenance-*.json`; not a D124 palette commit |

**N2.6 / Home:** No UI repair on 281 for unused enriched contract display; `fa9e4919` branch preserved per R1.

## Actual limitations (final report)

| Limitation | Detail |
| --- | --- |
| Scope | Bounded D124 evidence on **these** PNGs + fixtures — **not** whole-app brand PASS, not production palette authority |
| Proposal prior defect | Capture/compiler omission (no Tailwind on `proposal-view`) — **fixed in fixture only** |
| Programme contrast | SYNTH uses A059 planner without dark `ThemeProvider`; low-contrast lanes may remain in captures — **labelled pre-existing**, no fixture paint-over |
| Public routes | Lazy/reveal timing handled in harness (`capture-notes.json`); marketing CSS held values (-29% / 62.5%) unchanged |
| Provenance | `fixtureRootContext` + `theme` + computed `body` bg/font in `capture-provenance-*.json` (programme + proposal) |
| Home / Estimate PNGs | **Reused** without recapture; prior captures may have used bare `<body>` — see `manifest.json` `fixtureRootContext.pngReuseWithoutRecapture` |
| Bundles | Full `components.js` not committed; rebuild via `d124-build-fixture-bundles.mjs` |

## Re-run (local only)

```bash
node docs/temp-files/d124-build-fixture-bundles.mjs
npm run dev -- --port 3010 --hostname 127.0.0.1   # public routes only
D124_SHA=5a65d1b45cea73ea068a9fcf77dc1dc87410aaca npx playwright test -c docs/temp-files/d124-playwright.config.mjs
python3 docs/temp-files/d124-build-contact-sheets.py
```