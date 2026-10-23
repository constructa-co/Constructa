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

## First Job To Brief And Pricing

This separate leg starts at the actual blank NewProjectForm, not an existing
synthetic project. It exercises required-input validation, the real blank-input
parser/graph/response resolver over a mock creation reply, exact answer/request
retention after refusal, then actual Brief and pricing components for that same
mock-created ID. No scope, activity or price is seeded into the new job.

```sh
node e2e/local-phase1/build-brief-price.mjs /absolute/private/fresh-first-job-output first-job
CONSTRUCTA_LOCAL_PHASE1_OUTPUT=/absolute/private/fresh-first-job-output node node_modules/@playwright/test/cli.js test --config=playwright.local-first-job.config.ts
```

Creation/Brief persistence, page projections, router/theme and ephemeral storage
are explicit stand-ins. The real server actions/RPC/Auth/PostgREST, actual Next
routing, postcode extraction, durable reload, price writes, company-to-Won,
programme and terms/PDF/client-response stages remain NOT_RUN. The mocked
creation response uses the form request ID, not a database-created identity.
Strict CSP/offline/abort-all and coordinator process-network/write guards remain.
These independent legs do not establish a continuous hosted or release journey.

Because about:blank is not a secure origin, this leg supplies its missing
crypto.randomUUID API using getRandomValues and the existing client-id helper's
v4 algorithm. IDs are not fixed or reused across separate fixtures. This is an
explicit fixture adapter, not native secure-origin API or product-form proof.
