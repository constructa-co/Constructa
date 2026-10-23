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

## Programme To Draft PDF

This independent leg uses the actual simple programme editor and proposal review
components, including the frozen snapshot/document builders and installed jsPDF
browser renderer. Programme/inclusion saves and routing are explicit in-memory
stand-ins. The optional detailed planner is excluded, not visited. Synthetic
company, estimate and payment context is supplied, not fetched or approved legal
wording. No real save, publication, delivery, provider or hosted action is allowed.

```sh
node e2e/local-phase1/build-brief-price.mjs /absolute/private/fresh-programme-output programme-pdf
CONSTRUCTA_LOCAL_PHASE1_OUTPUT=/absolute/private/fresh-programme-output node node_modules/@playwright/test/cli.js test --config=playwright.local-programme-pdf.config.ts
```

Strict offline/CSP/abort-all controls remain. Generated draft PDF bytes are local
test artifacts, not published proposals or authoritative terms. This leg does
not establish actual Next routing, Auth/PostgREST, durable persistence, company
facts, original legal terms, client response, Won or whole-journey acceptance.
Because about:blank has no secure-origin SubtleCrypto, the test bridges only
SHA-256 to Node's real WebCrypto. Canonical snapshot hashing and check codes
still use the actual product builders; this is not native secure-origin proof.

## Separate Document Reading View

This independent scenario renders the actual proposal review client and native
document dialog with synthetic data and refusing action/router adapters. It
checks exact unsaved text and mounted-editor retention, native Escape/Back focus,
mobile viewport bounds, refreshed locks and unavailable preview data. Nothing
is saved, sent, downloaded, published or navigated. Full Next/Tailwind styling,
Auth/PostgREST, persistence and pagination accuracy are not established here.

```sh
node e2e/local-phase1/build-brief-price.mjs /absolute/private/fresh-document-view-output proposal-view
CONSTRUCTA_LOCAL_PHASE1_OUTPUT=/absolute/private/fresh-document-view-output node node_modules/@playwright/test/cli.js test --config=playwright.local-proposal-view.config.ts
```

Existing strict CSP, offline/abort-all and process network/source-write guards
remain. This is a reading-mode interaction, not a new terms, readiness, Send or
page-break policy, and not a served application or whole hosted journey.

## Joined Company To Draft PDF Journey

One explicit mock journey joins the company setup/readiness handoff, blank
first-job creation, Brief, pricing (with an in-memory estimate seed because
price persistence refuses), programme, proposal review and local draft PDF.
Client response appears only as frozen preview content; acceptance,
publication, delivery and Won are NOT_RUN.

```sh
node e2e/local-phase1/build-brief-price.mjs /absolute/private/fresh-journey-output journey
CONSTRUCTA_LOCAL_PHASE1_OUTPUT=/absolute/private/fresh-journey-output node node_modules/@playwright/test/cli.js test --config=playwright.local-journey.config.ts
```

Strict offline/CSP/abort-all and coordinator process network/source-write
guards remain. This is not Auth/PostgREST, durable reload, hosted routing,
publication, client acceptance or whole company-to-Won acceptance.

## Preparation Before Final Review

The actual proposal client now opens in Prepare proposal. Review document shows
the finished preview and existing Send controls separately while keeping the
editor mounted. Switching does not save or send. Existing in-page fix links
reveal preparation, and the existing dirty/readiness/confirmation gates remain.
The earlier programme/PDF and document-dialog scenarios enter Review explicitly.

```sh
node e2e/local-phase1/build-brief-price.mjs /absolute/private/fresh-proposal-stage-output proposal-view
CONSTRUCTA_LOCAL_PHASE1_OUTPUT=/absolute/private/fresh-proposal-stage-output node node_modules/@playwright/test/cli.js test --config=playwright.local-proposal-stage.config.ts
```

This offline scenario covers stage separation, exact raw draft/response retention,
fix-link targets, an existing deliberate payment shortcut, an explicit pending
mock-save refusal, lock refresh and native keyboard switching. All normal actions
refuse; only the pending-save case uses a labelled in-memory mock. No hosted
write, real Auth/Next/database, legal approval, pagination or release acceptance.

## Section-Based Web Reading Pages

The separate document dialog offers Previous/Next and a direct page selector.
Cover, actual document sections and the actual response are logical web reading
pages. They are explicitly not predictions of physical PDF page breaks. Every
section stays complete; long wording scrolls instead of being clipped. The
default continuous/public renderer and downloaded PDF content are unchanged.

```sh
node e2e/local-phase1/build-brief-price.mjs /absolute/private/fresh-reading-pages-output proposal-view
CONSTRUCTA_LOCAL_PHASE1_OUTPUT=/absolute/private/fresh-reading-pages-output node node_modules/@playwright/test/cli.js test --config=playwright.local-reading-pages.config.ts
```

The offline scenario uses actual reader/document/client components with refusing
mock actions/router/context. It covers page boundaries, selection, exact draft
retention, long synthetic terms, omitted programme and mobile keyboard controls.
It does not establish exact PDF pagination, real Next/Auth/database/save-reload,
full Tailwind/assistive/layout acceptance, original legal wording or release.
