# Phase 1 browser release proof

One Playwright journey that takes a synthetic contractor from sign-up to a
recorded client response, in a real browser, against the production build.

```
sign up → sign in → company setup → proposal readiness → first blank project → guided brief
→ simple estimate (explicit Preliminaries, risk 7.5%) → programme (three stages)
→ review and send: payment preset, pre-send PDF, acknowledgement
→ anonymous public proposal and PDF
→ client confirms receipt → contractor history and pipeline
→ second version asking for a non-binding intention to proceed
```

A second, short spec covers guided activation on its own
(`activation.spec.ts`): the free-text work answer and its optional
suggestions, a dropped connection and retry on both setup steps, Back, the
single welcome email, proposal readiness with both of its actions, and a
contractor who is already set up coming back to change an answer. It runs
under the same guards and in the same commands, uses 1280×800 for the
`desktop` project, and in evidence mode writes to
`docs/evidence/stage2-tranche-2g/`.

## Where it runs, and where it cannot

The journey writes real rows, so it runs only against the disposable Supabase
project `constructa-e2e-pr79`. This is enforced, not assumed:

| Check | Where | What stops the run |
| --- | --- | --- |
| Project sentinel | `support/env.ts` | `E2E_SUPABASE_PROJECT_REF` missing, or not the approved disposable reference |
| Supabase URL | `support/env.ts` | Host is not the approved project |
| Both API keys | `support/env.ts` | A key whose `ref` claim is another project, or whose role is wrong |
| Base URL | `support/env.ts` | Anything but an `http` loopback address. The harness only tests a server it started itself |
| Application guard | `next.config.mjs`, `scripts/verify-build-supabase-target.mjs` | The server is started in the `e2e` context, so the application itself refuses to build or start against any project but the one declared, and the compiled build is checked before the server starts. The same guard protects preview deployments (`DEVELOPMENT.md`) |
| Compiled build | `support/global-setup.ts` | The build names any Supabase project other than the approved one |
| Browser traffic | `phase1-journey.spec.ts` | Every request to a host other than the app and the approved project is aborted and recorded |
| New account | `phase1-journey.spec.ts` | The sign-up request went to another host, or the account is not in the approved project |

| AI budget and Brief AI state | `support/global-setup.ts`, `support/brief-ai-mode.ts` | After the target is proved and before any account is created: the AI budget's tables or functions are missing from the disposable project, or the Brief suggestion is not in the state this run's mode names. Read-only |

A failure of any of the first five, or of the last, prints `E2E CONFIGURATION FAILURE`. That
is a configuration result. It is never a product pass and never a skip.

The AI model and the email service are replaced by a loopback stub
(`support/provider-stubs.mjs`). The application is not changed for this: both
provider SDKs read their endpoint from the environment, and the server is
started with those endpoints pointing at the stub and with synthetic keys. No
prompt reaches a model and no email can leave the machine. The stub refuses
any recipient that is not `@example.com`.

The harness creates data and deletes none. Published proposals are immutable
records, so each run's synthetic contractor stays in the disposable project
until that project is deleted. Every run uses a new `@example.com` identity
and a password generated for that run.

## Running it

Required environment:

| Variable | Value |
| --- | --- |
| `E2E_SUPABASE_PROJECT_REF` | The disposable project reference. Stated by the operator, never derived |
| `NEXT_PUBLIC_SUPABASE_URL` | The disposable project's URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Its anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Its service-role key. Used by the server for the public proposal, and by the harness to read back what was recorded |

### Brief AI mode

The Brief's AI suggestion is behind a usage budget and ships switched off.
The journey has two explicit modes, chosen with `E2E_BRIEF_AI_MODE`:

| Mode | The disposable project must have | What the journey does at the Brief |
| --- | --- | --- |
| `disabled` (the default on this branch, and what CI names) | the budget migrations applied, and `brief.suggest` switched **off** | Presses the button, requires exactly the "isn't switched on for this yet" message, no suggestion, the description unchanged, no request to the provider stub and no budget attempt. Then writes the brief by hand, picks the trades by hand, and carries on through estimate, programme, proposal and client response. **AI suggestions are not tested in this mode**, and the results file says so (`provider.aiSuggestionTested: false`) |
| `enabled-with-stub` | the same, with `brief.suggest` switched **on** by an owner-approved change | Requires a pending suggestion from the stub, applies it, and requires one provider request and one budget attempt |

The mode is not a switch. The harness never turns the feature on or off and
never applies a migration. Before any account is created it reads the
disposable project and stops with `E2E CONFIGURATION FAILURE` if:

- a budget table or function is missing (the migrations
  `20261009090000_ai_generation_budget.sql`,
  `20261010090000_company_narrative_ai_attempt.sql` and
  `20261011090000_cohort_ai_features.sql` have not been applied there). A
  missing function makes the application say "not available", which is a
  different message from "not switched on", so this is never treated as off;
- the feature is on in `disabled` mode, off in `enabled-with-stub` mode, or
  in a state that is neither.
- a read could not be made or understood: it timed out (each read has a
  10 second limit), or the API's description of its functions is in a form
  the check does not recognise. That is reported as "could not be checked",
  which says nothing about whether the function exists.

Applying those migrations to the disposable project, and switching the
feature on there, are owner-approved changes made outside this harness.

Optional: `E2E_BASE_URL` (default `http://127.0.0.1:3100`), `E2E_STUB_URL`
(default `http://127.0.0.1:3199`), `E2E_RUN_ID`, `E2E_SYNTHETIC_PASSWORD`,
`E2E_SKIP_BUILD=1` (reuse an existing build while iterating; its backend is
still proved before any test runs).

On the owner's Mac the values are in the Keychain and never touch a file:

```bash
E2E_SUPABASE_PROJECT_REF=<disposable ref> scripts/e2e-with-keychain.sh npm run e2e:smoke
E2E_SUPABASE_PROJECT_REF=<disposable ref> scripts/e2e-with-keychain.sh npm run e2e:evidence
```

| Command | Projects | Use |
| --- | --- | --- |
| `npm run e2e:smoke` | `desktop` 1440×900, `phone` 390×844 | Routine and pull-request run |
| `npm run e2e:evidence` | plus `tablet` 768×1024 and `desktop-keyboard` | Release run. Writes `docs/evidence/stage2-tranche-2f/` |

Both build the application first. They use the installed Google Chrome; no
browser is downloaded. Screenshots and a trace are kept only for a failing
run, under `test-results/`, which is ignored by Git.

## What each run asserts

- **Journey**: every step above, with the hard assertions in
  `phase1-journey.spec.ts`. A brief suggestion stays pending until Apply;
  an incomplete proposal cannot be sent; acknowledgement is the default
  response; no control offers binding acceptance; later modules redirect.
- **Truth across boundaries**: the totals are worked out in
  `support/journey-data.ts` from the inputs, then required on the estimate,
  the review screen, the client's preview, the pre-send PDF, the public page
  and inside the sent PDF's text. The same goes for the programme: all three
  stages by name, in order, each with its own dates, and never a stage the
  contractor did not write. And for the payment stages and their amounts,
  and the response wording. Overhead, risk and profit must not appear in
  anything the client sees.
- **The programme is the contractor's**: opening the detailed planner on a
  job with no programme saves nothing; opening it on a saved programme
  changes nothing; it is not opened over unsaved stages; a reload shows the
  same stages.
- **Readiness can be acted on**: beside the disabled tick box and Send
  button, each missing item is named with a link to where it is fixed. A
  payment preset is chosen without working out percentages, and readiness
  answers before anything is saved.
- **Reviewed is what is sent**: the pre-send PDF is downloaded and read
  before publishing, and nothing is published by downloading it. Its check
  code is the one shown when the version is published.
- **Failure and retry**: a programme save whose connection is dropped keeps
  everything typed and saves on retry; a proposal email that fails leaves the
  publication standing and is sent on retry; a client response without a name
  is refused and can be corrected.
- **Layout** at every checkpoint: no sideways scroll, nothing past the
  viewport, every primary control at least 44×44 px, and on touch viewports
  nothing under a pinned bar. Three things are measured and reported but
  not enforced: controls inside the two optional advanced workspaces
  (Advanced estimating, Detailed programme planner), and, on the pointer
  desktop only, the side navigation and the compact pipeline board. On touch
  viewports the side navigation and the pipeline are enforced like the rest.
- **Accessibility** at every checkpoint: an axe scan against WCAG 2.2 A and
  AA, in the default theme. Any critical or serious violation fails the run.
  The full-dark theme is checked for the proposal document staying light,
  not scanned screen by screen.
- **Keyboard** (`desktop-keyboard`): the core path, sign-up to recorded
  acknowledgement, using Tab, Shift+Tab, Enter, Space, arrows and typing
  only. Every control reached must show a visible focus indicator.

Layout and accessibility findings are soft failures: the journey carries on
so one run lists every finding, and the run still fails.

Results are written per project as `results-<project>.json`.
