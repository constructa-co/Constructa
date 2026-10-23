# Local Phase 1 Scaffold

This is the first leg, not a replacement for `e2e/phase1-journey.spec.ts`.
It runs the actual company setup and readiness components in an offline browser.
Save persistence, Next routing and theme are injected stand-ins; the real setup
validator and readiness model are reused. It creates no account, calls no server
action and makes no application/provider network request. No new application
route or guard is added or weakened.

Prepare a fresh output directory outside the checkout, then run the existing
installed Playwright CLI with the dedicated config:

```sh
node e2e/local-phase1/build-company.mjs /absolute/private/fresh-output
CONSTRUCTA_LOCAL_PHASE1_OUTPUT=/absolute/private/fresh-output node node_modules/@playwright/test/cli.js test --config=playwright.local-phase1.config.ts
```

The compiler reuses the existing offline component-bundle approach; no install,
Next build, server start, environment-file loading or hosted fixture is needed.
For controlled execution the coordinator additionally denies external network
and source/dependency writes at the process boundary.

| Stage | Evidence Boundary |
| --- | --- |
| Company setup | Actual component inputs/validation, simulated save |
| Readiness handoff | Actual component, simulated Next routing/profile |
| Auth, real save/reload, email | NOT_RUN |
| First job, Brief, estimating, programme | NOT_RUN |
| Terms/PDF, client response, Won | NOT_RUN |

The normal hosted journey remains separately gated. A local fixture must not
be reported as Auth/PostgREST/publication/Won or whole-company journey acceptance.
The browser screenshot is fixture evidence, not a served app URL or release proof.

## Brief To Pricing

The separate second-leg fixture renders the actual Brief and simple estimating
components/controllers. A mock save records the existing Brief payload and a
mock router passes that saved description/activities to the pricing component.
It verifies that saved activity names can be chosen without automatic prices or
lines. Price persistence refuses; Advanced/video, AI, real server actions, Auth,
PostgREST, Next routing and later programme/PDF/response/Won stages are NOT_RUN.
This starts from a synthetic existing job, not the first-job creation flow, and
does not establish a continuous company-to-price or durable save/reload journey.

```sh
node e2e/local-phase1/build-brief-price.mjs /absolute/private/fresh-brief-output
CONSTRUCTA_LOCAL_PHASE1_OUTPUT=/absolute/private/fresh-brief-output node node_modules/@playwright/test/cli.js test --config=playwright.local-brief-price.config.ts
```

The compiler uses installed real Zod/React modules, with Zod's interpreted
validation path in this fixture so CSP can continue to prohibit unsafe-eval.
This does not change application configuration or schemas. Framework routing/theme,
server-action transports and unvisited lazy Advanced/video boundaries are
explicit fixture adapters, not production guard changes or feature acceptance.
Since about:blank has no storage origin, this fixture also supplies an ephemeral
in-memory sessionStorage stand-in, not real browser-storage or reload proof.
Each config selects only its own scenario and requires its own prepared output.
