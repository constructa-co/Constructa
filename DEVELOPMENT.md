# Constructa Development

## Supported Toolchain

- Node.js 24 LTS
- npm 11
- Install from `package-lock.json` with `npm ci`

Node 24 is pinned in `.nvmrc` and `package.json`. Create a fresh clone or a Git
worktree from the canonical GitHub repository rather than relying on an old
local checkout.

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
npm run typecheck
npm test
npm run build
```

GitHub Actions runs the same checks for pull requests and `main`.

## Known Quarantine

Four date-semantics assertions in `delay-analysis.test.ts` are skipped under
GitHub issue `#34`: three encode an inclusive convention that conflicts with
the implemented exclusive-end convention, and one has inconsistent date
arithmetic. The other delay-analysis tests remain active.

The delay/claims UI and server action are currently reachable. Release 1
excludes them, so issue `#17` must gate both surfaces before cohort access. They
must not be re-enabled until `#34` defines the convention and replaces every
skipped assertion.
