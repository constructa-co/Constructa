# Constructa Development

## Supported Toolchain

- Node.js 24 LTS (24.19.0 for local development and CI)
- npm 11
- Next.js 16.3.7 and React 19.3
- Install from `package-lock.json` with `npm ci`

Node 24.19.0 is pinned in `.nvmrc`; `package.json` accepts later supported Node
24 patch releases so Vercel's managed runtime can roll security updates. Create
a fresh clone or a Git worktree from the canonical GitHub repository rather
than relying on an old local checkout.

## Local Setup

```bash
nvm use
npm ci
cp env.local.example .env.local
npm run dev
```

Fill `.env.local` with owner-provided development credentials. Never commit
secret values. A production build must complete without `.env.local`; runtime
features that need credentials validate them when invoked.

## Health Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

GitHub Actions runs the same checks for pull requests and `main`.

Lint is now executable under Next.js 16. Historical lint violations remain
visible as warnings so the framework/security migration is not coupled to a
large unrelated cleanup. New or existing rules that are still errors fail CI;
the warning baseline should be reduced in focused follow-up work.

## Browser Release Proof

`e2e/` holds one Playwright journey that takes a synthetic contractor from
sign-up to a recorded client response in a real browser, at desktop, tablet
and phone sizes and by keyboard alone.

```bash
npm run e2e:smoke      # desktop and phone
npm run e2e:evidence   # full matrix, writes docs/evidence/stage2-tranche-2f/
```

It writes real rows, so it runs only against the disposable Supabase project
and refuses to start otherwise. `e2e/README.md` lists the required
environment and every isolation check. The `E2E` workflow runs the smoke on
pull requests; without its repository settings it fails as a configuration
failure, never as a pass.

## Preview and E2E database isolation

A preview or E2E build must never be compiled against, or started against,
the production database. This is enforced, not left to how the environment
variables happen to be set.

**The rule.** `src/lib/deployment/supabase-target.mjs` holds the canonical
production project reference and the one rule. In a preview or E2E context:

- `CONSTRUCTA_NONPROD_SUPABASE_PROJECT_REF` must name the disposable project
  that context may use, and must not be production;
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
  `SUPABASE_SERVICE_ROLE_KEY` must all be set and belong to that project;
- no other variable may address production (a database or pooler URL, a
  second Supabase URL, a production key under another name).

Anything missing or unprovable fails. Production is never checked.

**Which context a build is in.** On Vercel, `VERCEL_ENV` decides and nothing
can override it: `production` is production, and everything else that is not
local development is a preview. Away from Vercel the context is declared
with `CONSTRUCTA_DEPLOY_CONTEXT=preview` or `e2e`; the Playwright harness
sets `e2e` itself. A build with neither, such as the CI health build, is not
a preview and is not checked.

**Where it runs.**

| Check | When | What it reads |
| --- | --- | --- |
| Configuration | `next.config.mjs`, so every `next build` and `next start` whatever the build command | The server's environment: the URL, both keys, every other variable |
| Compiled build | `scripts/verify-build-supabase-target.mjs`, chained after `next build` in `npm run build` and before `next start` in the Playwright harness | The browser and server bundles in `.next`: the project the public URL was inlined as |

A failure stops the build with `SUPABASE TARGET CHECK FAILED`. Both checks
print one line each, which is the deployment's evidence of what it is bound
to, for example:

```
Supabase target check: context=preview (from VERCEL_ENV) expected=<ref> url=<ref> anon-key=<ref> service-key=<ref> -> PASS
Compiled Supabase target: context=preview (from VERCEL_ENV) expected=<ref> projects in build=<ref> -> PASS
```

Only project references appear. They are public identifiers (they are in the
URL of every page). No key, password or connection string is ever printed.

**Setting up a preview.** In Vercel, for the Preview environment only (or a
single branch), set the three Supabase variables to the disposable project
and `CONSTRUCTA_NONPROD_SUPABASE_PROJECT_REF` to its reference. Leave the
Production environment's variables as they are. A preview that inherits the
production values, or has none, fails to build. Keep Vercel's build command
as `npm run build` (the default) so the compiled-build check runs too.

**Retiring or rotating a disposable project.**

1. Remove or repoint the Preview variables first, including
   `CONSTRUCTA_NONPROD_SUPABASE_PROJECT_REF`. Previews fail to build until a
   replacement is set, which is the intended state.
2. Delete the preview deployments built against the old project. Their
   bundles still name it.
3. Delete the Supabase project. Its keys die with it; nothing needs
   revoking. To keep the project but rotate its keys, roll them in Supabase
   and update the Preview variables and the E2E secrets together.
4. For the E2E harness, update `APPROVED_DISPOSABLE_PROJECT` in
   `e2e/support/env.ts`, the `E2E_SUPABASE_PROJECT_REF` repository variable,
   the three `E2E_SUPABASE_*` secrets and the Keychain items named in
   `scripts/e2e-with-keychain.sh`.
5. Never copy production data into a disposable project. Use made-up
   contractors and clients only.

If the production project itself ever changes, update
`PRODUCTION_SUPABASE_PROJECT_REF` in the same commit that repoints
production.

## Known Quarantine

Four date-semantics assertions in `delay-analysis.test.ts` are skipped under
GitHub issue `#34`: three encode an inclusive convention that conflicts with
the implemented exclusive-end convention, and one has inconsistent date
arithmetic. The other delay-analysis tests remain active.

The delay/claims UI, Contract Admin actions and alert cron are disabled in the
default cohort launch profile. They must not be re-enabled until `#34` defines
the date convention and replaces every skipped assertion.

## Launch Profiles

`NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE` controls the retained product surface:

- `cohort` is the default and fails closed. It exposes the pipeline, company
  setup, project setup, brief, estimating, programme and proposal journey.
- `full` is for internal testing only. It restores the command-centre landing
  page and retained delivery, finance, reporting and integration modules.

The route proxy, navigation, embedded advanced controls, APIs, cron jobs and
Server Actions all enforce the same profile. Deferred action modules authenticate
through `src/lib/supabase/extended-module-auth-utils.ts`; do not replace that
adapter with the base auth helper unless the module is deliberately promoted
into the cohort journey.

## Proposal Document

A proposal is published as an immutable snapshot (`proposal_publications`).
The client's web page and the PDF are both drawn from that snapshot through
one document model, so they cannot state different prices, dates or terms:

- `src/lib/programme-plan.ts` is the only place a programme date is worked
  out (working days are Monday to Friday).
- `src/lib/proposal-publication.ts` builds the snapshot.
- `src/lib/proposal-document.ts` turns a snapshot into ordered sections.
- `src/components/proposal/proposal-document-view.tsx` renders it as HTML and
  `src/lib/pdf/proposal-brochure.ts` as an A4 PDF with content-aware page
  breaks.
- `src/lib/proposal-response.ts` holds the wording of the client response.
  New publications ask for receipt or a non-binding intention to proceed;
  binding acceptance is not offered.

`npm run test:proposal-response-sql` checks the response rules against the
migrations in a throwaway local Postgres.
