# D127 quote and programme layout: before and after

Local offline captures of the actual components, at 375 and 1440 wide, with the same synthetic TEST DATA fixtures:
- **BEFORE:** main `c7452b06`.
- **AFTER:** the visual-only change on `codex/d127-quote-programme-layout-20261128`.

These are fixture evidence, not a served page or release proof.

| Screen | Component | Fixture |
|---|---|---|
| Estimate | `EstimateClient` (activity breakdown shown, Running total, in-view total) under `ThemeProvider`, compiled Tailwind and CSS modules | 64 saved simple lines in 8 activities, default adjustments (`e2e/local-phase1/d127-layout-estimate-entry.tsx`) |
| Programme | detailed `ClientSchedulePage` under compiled Tailwind | 48 saved stages over about 20 weeks, with Starts-after links and labour hours (`e2e/local-phase1/d127-layout-programme-entry.tsx`) |

## Files
In each of `before/` and `after/`:
- `estimate_{375,1440}.png` and `programme_{375,1440}.png`: full page.
- Close-ups:
  - `estimate-total_*.png` (Running total);
  - `estimate-subtotal_*.png` (first activity subtotal);
  - `programme-phone-list_375.png` (top of the phone stage list);
  - `programme-viewport_1440.png` (the first screen of the planner).
- `*.json` receipts: page size, nested vertical scroll areas, refused-action calls, network requests and page errors. Every shot has 0 calls, 0 requests and 0 errors.

## What changed (presentation only)
- **Estimate, Running total:** the existing "Total including VAT" row is shown as the emphasised final figure, using the brand total-bar colours already used by the in-view total. The figure is identical before and after.
- **Estimate, activity subtotals:** a stronger rule, tint and figure weight, so section totals stand out in long estimates.
- **Programme, phone:**
  - each stage is a card, with the duration kept on the name line;
  - a small bar places the stage's saved start and end within the whole programme. It uses the same dates already printed on the card.
- **Programme, desktop:** a wider stage-name column (lg and up) and larger, higher-contrast week labels and dates.

No calculation, rounding, VAT, adjustment, date, dependency, save or navigation logic changed. Every existing control and selector is kept.

## How to reproduce (local only)
```sh
node docs/temp-files/d127-build-fixture-bundles.mjs /abs/bundles
D127_BUNDLE_ROOT=/abs/bundles D127_OUT=/abs/out node node_modules/@playwright/test/cli.js test --config=docs/temp-files/d127-playwright.config.mjs
```

## Notes
- **Phone:** no nested vertical scroll area at 375, before or after.
- **Desktop planner:** at 1440 it scrolls inside its own card, under a sticky header. This is main's existing design and is unchanged.
