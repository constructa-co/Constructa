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
