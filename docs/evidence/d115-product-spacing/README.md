# D115 product page spacing — visual evidence (public `/product`)

**Branch:** `codex/d115-product-spacing-20261126`  
**Repair head:** `36b98ba62886f3807d522c7ba5f8e8cb01ac1631` (CSS module `:global(#…)` selector fix)  
**Base:** `ae746fc9ff04015828bbae87349137337f84aa38`

Synthetic review only — no auth, form submit, customer data, pricing changes, or live writes.

## Capture method

| | Before | After |
| --- | --- | --- |
| Host | `https://constructa-nu.vercel.app/product` (production main) | `http://127.0.0.1:3456/product` (local `next start`, candidate build) |
| Viewports | 375×812 and 1440×900 CSS px | Same |
| Settle | `networkidle`, scroll to bottom, scroll top, waits | Same |
| Tool | Playwright (Chrome), public GET | Same |

Untracked full-page PNGs remain under `temp-files/d115-review/*-product-full.png` (not committed).

## Computed padding (proves `productFlow` rules apply after repair)

### 375 CSS px

| Element | Before | After |
| --- | --- | --- |
| `#product-review-guide` padding top/bottom | `0px` / `55px` | `32px` / `16px` |
| `#product-screenshots` padding top/bottom | `0px` / `55px` | `16px` / `12px` |
| `scrollHeight` | 8911 | 8634 |

### 1440 CSS px

| Element | Before | After |
| --- | --- | --- |
| `#product-review-guide` padding bottom | `100px` | `28px` |
| `#product-screenshots` padding bottom | `100px` | `20px` |
| `scrollHeight` | 5819 | 5367 |

Source: `before-hosted-*-metrics.json`, `after-local-repaired-*-metrics.json` in this folder.

## Root cause (compiled CSS)

At `a92b2c44`, CSS modules emitted hashed ID selectors (e.g. `#product-page-spacing-module__…__product-review-guide`) that did not match DOM `id="product-review-guide"`. Repair: `:global(#product-review-guide)` and `:global(#product-screenshots)` in `src/components/marketing/product-page-spacing.module.css`.

Desktop zoom on marketing captures unchanged in intent; viewport probe in `after-local-repaired-1440-viewport-probe.json` (parent frame ~716px, transforms unchanged class of crop).

## Image manifest (committed, lossless PNG)

| File | Description |
| --- | --- |
| `compare-375-product-region-before-after.png` | Stacked before/after **viewport clip** (scroll ≈ y 4300) — guide/screenshots/invitation band |
| `compare-1440-product-region-before-after.png` | Same at 1440 (scroll ≈ y 2100) |
| `before-375-tail-y6300-8400.png` | BEFORE full-page native crop **y 6300–8400** (R1 blank-band band) |
| `after-375-tail-y6300-8400.png` | AFTER same coordinates |
| `before-375-screenshots-y4800-7900.png` | BEFORE `#product-screenshots` vertical span |
| `after-375-screenshots-y4800-7900.png` | AFTER same span |
| `before-1440-screenshots-y2350-5100.png` | BEFORE desktop screenshot frames section |
| `after-1440-screenshots-y2350-5100.png` | AFTER same span |

All crops label **native y** range in the image header strip.

## Build / target guard (repair commit context)

Non-secret env only: Supabase target check **context=unspecified**; compiled projects id **umqtzfsnyoofmgfbnrgv** (no preview enforcement on local build).