# D124 — Brand visual review (PR 281 lane)

**Branch:** `codex/d123-brand-consistency-20261128`  
**SHA:** `5a65d1b45cea73ea068a9fcf77dc1dc87410aaca`  
**Capture date:** 2026-11-28 (local VM, unpublished)  
**Server:** `npm run dev -- --port 3010 --hostname 127.0.0.1` (no `CONSTRUCTA_REVIEW_ONLY` — review backend not configured on VM)  
**Harness:** `docs/temp-files/d124-brand-visual-capture.spec.ts` + `d124-playwright.config.mjs`  
**Output:** `temp-files/d124-brand-review/`

## Viewports

| Tag | Width | Height |
| --- | ---: | ---: |
| `375` | 375 | 812 |
| `1440` | 1440 | 900 |

## Route coverage

| Route ID | Path | 375 PNG | 1440 PNG | Result |
| --- | --- | --- | --- | --- |
| landing | `/` | `landing_375.png` | `landing_1440.png` | **Rendered** — charcoal + sage CTAs; Avenir body |
| product | `/product` | `product_375.png` | `product_1440.png` | **Rendered** |
| pricing | `/pricing` | `pricing_375.png` | `pricing_1440.png` | **Rendered** (unpublished local only) |
| login | `/login` | `login_375.png` | `login_1440.png` | **Rendered** — sage primary sign-in |
| dashboard | `/dashboard/home` | `dashboard_375.png` | `dashboard_1440.png` | **RUNTIME_BLOCKED** — Supabase env missing (not auth redirect; out of D124 scope) |
| estimate | `/dashboard/projects/costs` | `estimate_375.png` | `estimate_1440.png` | **RUNTIME_BLOCKED** (same) |
| programme | `/dashboard/projects/schedule` | `programme_375.png` | `programme_1440.png` | **RUNTIME_BLOCKED** (same) |
| proposal | `/dashboard/projects/proposal` | `proposal_375.png` | `proposal_1440.png` | **RUNTIME_BLOCKED** (same) |

Auth redirect was **not** treated as visual coverage. Signed-in workflow surfaces require hosted test backend or offline fixture bundles (existing `e2e/local-navigation` pattern); not exercised here.

## Brand drift inspection (281 @ 5a65d1b4)

| Check | Finding |
| --- | --- |
| Root Inter / `#2563eb` theme | **OK** at this SHA — layout uses charcoal `theme-color` + globals Avenir (post D123 follow-up on branch) |
| Marketing purple decorative (`full-features`) | **OK** — emerald accents in committed sweep |
| Login / landing primary buttons | **OK** — sage `#c9efcf` / ink, not legacy link blue |
| Action required on 281 from captures | **None** — no additional palette commits from this visual pass |

## Re-run (local only)

```bash
npm run dev -- --port 3010 --hostname 127.0.0.1
D124_SHA=5a65d1b45cea73ea068a9fcf77dc1dc87410aaca npx playwright test -c docs/temp-files/d124-playwright.config.mjs
```