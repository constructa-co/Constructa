# Marketing public image sweep — 15 Nov 2026 (read-only)

Host: `https://constructa-nu.vercel.app` (production read-only; no deploy or settings changes).

## Routes covered

| Route | Image URLs checked | Broken (HTTP ≥400 or non-image) |
|-------|-------------------|--------------------------------|
| `/` | hero, icon chunks | 0 |
| `/about` | 7× `/images/about-*.png` via `/_next/image` | 0 |
| `/features` | 4× bundled JPG fixtures via `/_next/image` | 0 |
| `/product` | same as features | 0 |
| `/pricing` | hero | 0 |
| `/contact` | — | 0 |
| `/apply` | — | 0 |
| `/guides` | — | 0 |
| `/landing` | hero | 0 |
| `/privacy-policy` | — | 0 |
| `/terms-of-service` | — | 0 |
| `/login` | — | 0 |
| `/offline` | — | 0 |

Total unique image optimizer/static URLs probed: **11** (HTML-derived set on live HTML). **0 broken.**

## About panels (pre-fix observation)

Problem and solution `<img>` tags were present in static HTML with `srcSet` to `about-problem1.png` and `about-solution.png` (HTTP 200). Visible blank-panel risk on cohort About traced to `next/image` sizing: descendant `.figure img` CSS without `className` on `Image`, plus 720×480 hints on 1024² assets. Fix on `cursor/marketing-about-illustrations-e459`.