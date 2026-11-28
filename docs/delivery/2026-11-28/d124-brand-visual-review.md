# D124 — Brand visual review (PR 281 lane)

**Branch:** `codex/d123-brand-consistency-20261128`  
**Source SHA:** `5a65d1b45cea73ea068a9fcf77dc1dc87410aaca`  
**Evidence pack (committed):** `docs/evidence/d124-brand-review/` (`manifest.json`, `png/`, contact sheets)  
**Capture date:** 2026-11-28 (local VM, unpublished)  
**Server:** `npm run dev -- --port 3010 --hostname 127.0.0.1` (no hosted DB writes; no signup)  
**Harness (local/test only):** `docs/temp-files/d124-brand-visual-capture.spec.ts`, `d124-playwright.config.mjs`

## Viewports

| Tag | Width | Height |
| --- | ---: | ---: |
| `375` | 375 | 812 |
| `1440` | 1440 | 900 |

## Per-route render class (R1: inspect actual PNGs)

| Route ID | Path | Class | Counts as coverage? | 375 PNG | 1440 PNG |
| --- | --- | --- | :---: | --- | --- |
| landing | `/` | **REAL_RENDER** | Yes | `png/landing_375.png` | `png/landing_1440.png` |
| product | `/product` | **REAL_RENDER** | Yes | `png/product_375.png` | `png/product_1440.png` |
| pricing | `/pricing` | **REAL_RENDER** | Yes (local only) | `png/pricing_375.png` | `png/pricing_1440.png` |
| login | `/login` | **REAL_RENDER** | Yes (empty public form) | `png/login_375.png` | `png/login_1440.png` |
| dashboard | `/dashboard/home` | **SYNTHETIC_RUNTIME_BLOCKED** | **No** | `png/dashboard_375.png` | `png/dashboard_1440.png` |
| estimate | `/dashboard/projects/costs` | **SYNTHETIC_RUNTIME_BLOCKED** | **No** | `png/estimate_375.png` | `png/estimate_1440.png` |
| programme | `/dashboard/projects/schedule` | **SYNTHETIC_RUNTIME_BLOCKED** | **No** | `png/programme_375.png` | `png/programme_1440.png` |
| proposal | `/dashboard/projects/proposal` | **SYNTHETIC_RUNTIME_BLOCKED** | **No** | `png/proposal_375.png` | `png/proposal_1440.png` |

### Class definitions

- **REAL_RENDER:** Requested route rendered in Chromium; safe public/marketing (and public login UI). Used for brand drift review.
- **SYNTHETIC_RUNTIME_BLOCKED:** Screenshot file exists for traceability, but the authenticated workflow surface did **not** render (local VM missing Supabase/runtime). **Not** brand coverage.
- **SYNTHETIC_AUTH_BLOCKED:** Harness would label overlays if `requested path → final path` diverged (e.g. login redirect). **Login redirect does not qualify** as dashboard/estimate/programme/proposal coverage. This capture pass did **not** treat redirects as workflow coverage.

## Contact sheets (bounded; full detail in `png/`)

| File | Contents |
| --- | --- |
| `contactsheet-real-routes-375.png` | landing, product, pricing, login @ 375 (thumbnails) |
| `contactsheet-real-routes-1440.png` | same @ 1440 |
| `contactsheet-synthetic-blocked-workflow.png` | representative blocked workflow frames (not coverage) |

## Brand drift inspection (281 @ 5a65d1b4)

| Check | Finding |
| --- | --- |
| Root Inter / legacy blue theme meta | **OK** — charcoal `theme-color`, Avenir body |
| Marketing purple decorative accents | **OK** — emerald sweep on branch |
| Login / landing primary buttons | **OK** — sage / ink, not legacy link blue |
| Code change required from this visual pass | **None** |

## Re-run (local only; does not add product routes or bypass auth)

```bash
npm run dev -- --port 3010 --hostname 127.0.0.1
D124_SHA=5a65d1b45cea73ea068a9fcf77dc1dc87410aaca npx playwright test -c docs/temp-files/d124-playwright.config.mjs
python3 docs/temp-files/d124-build-contact-sheets.py
```