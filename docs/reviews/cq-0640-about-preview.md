# cq-0640-about-preview — Cursor composer-2.5 (fast=false) source review

## Scope

Bounded public About page fix: **What's next** copy and preview link only, plus one new static render test. No signup, gates, pricing facts, phase-one component, or other About sections changed.

## Base and branch

| Item | Value |
|------|--------|
| Base commit | `1f3703e9625aceef2d8a6fa03a3fb59a17adb05b` |
| Branch | `cq/cq-0640-about-preview` |
| Worktree | `/Users/robertsmith/dev/constructa-fresh-20261025/.cq-wt/cq-0432-a091-error-recovery` |
| Model | Cursor composer-2.5, fast=false |

## Files touched

| Path | SHA-256 (post-edit, uncommitted) |
|------|----------------------------------|
| `src/app/about/page.tsx` | `3e24d71e1c6c1462070e00042b34e6997b1412ce6e3e01d708e00baf2d346e5d` |
| `src/app/about/about-preview-status.test.tsx` | `6784915afe9e28c6dfe49f3bb473b14f54a2c91e8c1d96968c9dbc4d5db5809c` |

### `src/app/about/page.tsx` (What's next only)

- Import `Link` from `next/link` (line 3).
- Lines ~152–164: Replaced “first release is now live” and “give Constructa a try today” with phase-one review wording, kept roadmap expansion paragraph, added `/pricing` **Preview access →** button matching existing white CTA style on Medium/LinkedIn.

### `src/app/about/about-preview-status.test.tsx` (new)

- Static `renderToStaticMarkup` of `./page` (same pattern as `src/app/privacy-policy/privacy-information.test.tsx`).
- Asserts phase-one review text, live-customer hold, expansion line, `/pricing` preview link, and absence of now-live / try-today claims on full page HTML.

## Commands and results

### Vitest (owned file only)

```bash
cd /Users/robertsmith/dev/constructa-fresh-20261025/.cq-wt/cq-0432-a091-error-recovery
TMPDIR=/Users/robertsmith/dev/constructa-fresh-20261025/.cq-wt/cq-0432-a091-error-recovery/.tmp-vitest \
  node /usr/local/bin/npx vitest run src/app/about/about-preview-status.test.tsx
```

- **First attempt** (default sandbox `TMPDIR`): exit **1** — `EPERM: operation not permitted, mkdir '.../constructa-queue/tmp/cq-0640-about-preview/.../ssr'` (Next/vitest SSR cache path outside worktree).
- **Second attempt** (workspace-local `TMPDIR` as above): exit **0** — 1 file, 1 test passed.

No full vitest suite, no `next build`, no `npm install`.

### ESLint (owned files)

```bash
cd /Users/robertsmith/dev/constructa-fresh-20261025/.cq-wt/cq-0432-a091-error-recovery
node /usr/local/bin/npx eslint src/app/about/page.tsx src/app/about/about-preview-status.test.tsx
```

- Exit **0** (26 **pre-existing** warnings on `page.tsx`: unused `MetricIcon`, `no-img-element`, `react/no-unescaped-entities`; none introduced solely for this task’s new lines beyond the same apostrophe pattern already used on the page).

### TypeScript

```bash
cd /Users/robertsmith/dev/constructa-fresh-20261025/.cq-wt/cq-0432-a091-error-recovery
node /usr/local/bin/npx tsc --noEmit
```

- Exit **0**

## Limits (explicit)

- No commit, push, PR, deploy, SQL, settings, keys, signup enablement, or changelog/register edits from this job.
- No browser/hosted verification; static markup only.
- No change to `src/components/marketing/phase-one.tsx` or other marketing routes.
- Temporary vitest cache used under worktree `.tmp-vitest` for the passing run only (removed after run); not part of the deliverable.
- This update is truthful public copy navigation only—not legal approval or general availability authority.

## Outcome

**PASS** on intended source + owned test + eslint + tsc, with the documented first vitest EPERM limit under default sandbox TMPDIR.
