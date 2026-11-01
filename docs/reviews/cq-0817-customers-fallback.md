# cq-0817 customers fallback (Cursor composer-2.5, fast=false)

## Prior failure (unchanged fact)

- Claude authorised attempt **2026-11-01 08:09:04–08:10:12 / PID 34035** ended on **monthly spend limit FAIL** before durable source landed.
- Handoff base at session start: branch `cq/cq-0815-customers-preview`, **HEAD `adbe860ba3163054474be22ebfb8aa65b40f42b1`**, working tree **clean** (verified once).

## Task scope (cq-0815-customers-preview)

Repair cohort/default `/customers` journey: remove nonexistent **Join the waitlist → /** CTA; add truthful phase-one / not-live-customer-work copy plus **Get in touch → /contact** and **Preview access → /pricing**. Preserve **full** launch profile rendering (original copy + contact + waitlist links) via `getLaunchProfile() === 'full'` branching.

Owned files only:

- `src/app/customers/page.tsx`
- `src/app/customers/customers-preview-status.test.tsx`
- This review doc

No marketing chrome, routes, config, runner, changelog, or build copies.

## Source summary

| File | Intent |
|------|--------|
| `src/app/customers/page.tsx` | `FullCustomersPage` keeps pre-change CTA block; `CohortCustomersPage` mirrors About phase-one honesty + `/pricing` + `/contact`; default export branches on `getLaunchProfile()`. |
| `src/app/customers/customers-preview-status.test.tsx` | Static SSR markup tests (cohort + full), `vi.mock` on `getLaunchProfile`, same patterns as `about-preview-status.test.tsx`. |

## Commands and exits

Environment: Node via `/usr/local/bin/npx`, repo root this worktree, **no** `npm install`, **no** `next build`, **no** network/auth/SQL.

### Vitest (owned file)

First attempt (default TMPDIR under `constructa-queue`):

```text
npx vitest run src/app/customers/customers-preview-status.test.tsx
```

- **Exit 1** — suite load failed: `EPERM: operation not permitted, mkdir '.../constructa-queue/tmp/cq-0817-customers-fallback/.../ssr'`

Second attempt (worktree-local TMPDIR only):

```text
TMPDIR="$(pwd)/.tmp/vitest-cache" npx vitest run src/app/customers/customers-preview-status.test.tsx
```

- **Exit 0** — 1 file, **2 tests passed**

### ESLint (owned files)

```text
npx eslint src/app/customers/page.tsx src/app/customers/customers-preview-status.test.tsx
```

- **Exit 0** — 1 pre-existing pattern warning on full-profile `href="/"` waitlist anchor (`@next/next/no-html-link-for-pages`); same as original page, not introduced for cohort path.

### TypeScript

```text
npx tsc --noEmit --incremental false
```

- **Exit 0**

## Limits respected

NO PR / NO MAIN / NO DEPLOY / NO LIVE SQL / NO SETTINGS OR KEYS / NO NEW BUILD COPIES / NO INSTALL. Changes left **uncommitted** for runner `cq` commit/push.

## Base vs working tree

- Base commit: `adbe860ba3163054474be22ebfb8aa65b40f42b1`
- Uncommitted at doc write: modified `page.tsx`, new `customers-preview-status.test.tsx`, new this file.
