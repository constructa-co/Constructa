# CON-074 browser contrast evidence

Offline Playwright + `@axe-core/playwright` on **actual** `DashboardClient` (default selected **This Month** and **List** pills) and **EstimateClient** (`totalDock` sticky bar). Styles come from the installed Tailwind compile of `globals.css` plus real CSS modules (`project-chooser.module.css`, `estimating.module.css`). No hosted app, no hand-built HTML.

## Reproduce (does not install or build the Next app)

```sh
OUT=/absolute/private/con074-browser-output
node e2e/local-phase1/build-brief-price.mjs "$OUT" con074-contrast
CONSTRUCTA_LOCAL_PHASE1_OUTPUT="$OUT" node node_modules/@playwright/test/cli.js test --config=playwright.local-con074-contrast.config.ts
```

## Artifact index

| File | Role |
|------|------|
| `provenance.json` | `gitHead`, bundle/css SHA-256, full `sourceHashes` from fixture compiler |
| `pipeline-pills-{system-c,dark}.png` | Selected period + List pills |
| `estimate-total-bar-{system-c,dark}.png` | Estimate total dock |
| `*.json` beside screenshots | Computed contrast ratio + axe `color-contrast` result |
| `axe-wcag2aa-scoped-*.json` | Per-target axe runs on period bar, view toggle, total dock |
| `full-fixture-*.png` | Full fixture page both regions |

## Limits

- Synthetic job data only; list/board data minimal.
- Pipeline list/board bodies and unopened Radix dialogs are compiler stubs; the measured pills and total bar remain actual components. These stubs apply only to this scenario.
- Scoped to CON-074 surfaces — not whole-dashboard or whole-estimating WCAG sign-off.
- Fixture uses `about:blank` + in-memory storage; not proof of production routing or save paths.
