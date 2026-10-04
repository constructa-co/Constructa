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
