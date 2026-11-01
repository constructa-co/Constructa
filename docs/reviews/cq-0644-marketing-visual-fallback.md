# cq-0644 marketing visual fallback (Composer source)

## Verdict

**PASS** — bounded A084 source gap closed in this worktree; material tests, ESLint on owned paths, and full `tsc --noEmit` succeeded after one sandbox TMPDIR failure (retried with worktree-local TMPDIR).

## Task authority and prior attempt

- Brief: `/Users/robertsmith/constructa-queue/prompts/cq-0640-marketing-business-visual.md`
- Authorised route: Cursor Composer 2.5 (`fast=false`); no Claude retry (Claude `cq-0640-marketing-business-visual` run ~06:36–06:38 exit 1, monthly spend limit, no source artifact).
- Branch: `cq/cq-0640-marketing-business-visual`
- Worktree: `/Users/robertsmith/dev/constructa-fresh-20261025/.cq-wt/cq-0431-a038-upload-outcomes`
- Task base cited in brief: `1f3703e9625aceef2d8a6fa03a3fb59a17adb05b` (ancestor of current HEAD)
- Clean baseline before edits: `408f18ca2b756cea491fdf44f5f01324942a45da` (working tree clean)

## Source delta (this session)

| Path | Change |
|------|--------|
| `src/components/marketing/phase-one.tsx` | Import `HomeBusinessVisual`; replace story-panel `next/image` `about-hero.png` with `<HomeBusinessVisual />`; remove unused `next/image` import |
| `src/components/marketing/home-business-visual.tsx` | Already on branch (charcoal/sage editorial figure: Company profile → Relevant past work → Proposal) |
| `src/components/marketing/home-business-visual.module.css` | Already on branch |
| `src/components/marketing/home-business-visual.test.tsx` | Already on branch |

Uncommitted after work: `phase-one.tsx` only (+2/−2 lines vs `408f18ca`). Runner owns commit/push.

## Commands and exits

Environment note: shell reported `node v26.12.1` (package `engines` require `>=24.19 <25`); no install/build run.

### Vitest (material tests)

```text
cd /Users/robertsmith/dev/constructa-fresh-20261025/.cq-wt/cq-0431-a038-upload-outcomes
npx vitest run src/components/marketing/home-business-visual.test.tsx src/components/marketing/phase-one.test.tsx
```

| Attempt | TMPDIR | Exit | Result |
|---------|--------|------|--------|
| 1 | default (sandbox) | 1 | EPERM mkdir `.../constructa-queue/tmp/cq-0644-marketing-visual-fallback/.../ssr` — suites failed to load, 0 tests executed |
| 2 | `$(pwd)/.tmp/vitest-cache` | 0 | 2 files, **39 passed** |

### ESLint (owned source)

```text
npx eslint src/components/marketing/home-business-visual.tsx src/components/marketing/home-business-visual.test.tsx src/components/marketing/phase-one.tsx
```

Exit **0**.

### TypeScript

```text
npx tsc --noEmit
```

Exit **0**.

## Scope compliance

- Touched only marketing visual module files already on branch plus minimal `phase-one.tsx` story-panel wiring.
- Did not edit `phase-one.module.css`, public assets, about page, changelog, compact/status, runner config, billing/auth, SQL, deploy, or PR/main.

## Limits not exercised here

- No `next build`, whole test suite, npm install, imagegen/capture, or live/hosted verification.
- Independent runner `composer-2.5[fast=false]` check and guarded ROOT build remain out of band for this note.
