# Constructa Development

## Supported Toolchain

- Node.js 24 LTS
- npm 11
- Install from `package-lock.json` with `npm ci`

Node 24 is pinned in `.nvmrc` and `package.json`. Do not use the damaged legacy
checkout at `/Users/robertsmith/Documents/GitHub/constructa`; create a fresh
clone or a Git worktree from the canonical GitHub repository.

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

Four contradictory inclusive-date assertions in `delay-analysis.test.ts` are
skipped under GitHub issue `#34`. The other delay-analysis tests remain active.
The delay/claims module is outside Release 1 and must not be enabled until the
date convention is agreed and all skipped tests are replaced.
