# cq-0030 marketing responsive (Cursor / composer-2.5 fast=false)

## Scope

- **Branch:** `cq/cq-0030-marketing-responsive`
- **Base commit (unchanged):** `671ff23de34084cc3f3dc346fd67a72ef8a24e21`
- **Owned files:** `src/components/marketing/phase-one.module.css`, `src/components/marketing/phase-one-responsive.test.ts` (new)
- **Not touched:** `phase-one.tsx`, contact/Kimi paths, app globals, tokens, JS menu, build/deploy/SQL/settings

## Problem (Rob 01 Nov 00:05)

Shared marketing header nav stayed a single non-wrapping flex row with fixed gaps at ~320px; `.root { overflow: clip }` could clip overflow instead of reflowing. All three main nav links must remain visible in source (no hidden-menu pattern).

## CSS changes (static intent)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `phase-one.module.css` | `@media (max-width: 800px)` block | `.headerInner` `min-width: 0`; `.nav` `flex-wrap`, full-width flex basis, `min-width: 0`, responsive column/row gaps; `.nav a` `min-width: min-content`, touch height; `.signIn` shrink guard; `.footerBottom` / `.pageIntro > a` wrap guards | Let main nav links wrap to additional rows at narrow widths so they are not clipped under `overflow: clip` on `.root` |
| `phase-one.module.css` | `@media (max-width: 450px)` block | `.nav` tighter gaps; `.footerTop nav` `gap: 12px 16px`; `.signIn` slightly smaller type | 320px-class width and zoomed narrow layouts |
| Unchanged | L13–14, L104 | Sage `--accent` focus outline, `--accent` primary, `prefers-reduced-motion` | A001 palette / motion policy preserved |

**Static note:** `.root` still declares `overflow: clip`; evidence is declaration-level only, not computed layout or browser proof that clipping no longer occurs.

## Tests

### Command (materially affected only)

```bash
cd /Users/robertsmith/dev/constructa-fresh-20261025/.cq-wt/cq-0432-a091-error-recovery
TMPDIR="$PWD/.tmp" node /usr/local/bin/npx vitest run \
  src/components/marketing/phase-one-responsive.test.ts \
  src/components/marketing/readability.test.ts
```

### Result

- **Exit code:** 0
- **Vitest:** 2 files, **22 tests passed** (6 new responsive + 16 readability)
- **Not run:** `next build`, full CI, `phase-one.test.tsx`, Playwright, npm install

### File hashes (SHA-256)

| Path | SHA-256 |
|------|---------|
| `src/components/marketing/phase-one.module.css` | `fa45492d037816c10d97e94957054c5fa07816a35b9c5863c228cefb401fd4e0` |
| `src/components/marketing/phase-one-responsive.test.ts` | `c157d1832842f7e0c83f775e26ddd3c8d1334b96c0f84427887fe41b886ddc00` |

## Limits

- PostCSS parse of authored CSS + static read of `MarketingHeader` links in `phase-one.tsx`; **not** layout engine, viewport, or accessibility audit in a browser.
- No verification that Claude-owned TSX/guide changes align (out of scope for this diff).
- Changes left **uncommitted** for runner; `.tmp/` used only as vitest temp under worktree (untracked).

## Checker

Independent Claude checker requested on this branch diff (CSS + new test only).
