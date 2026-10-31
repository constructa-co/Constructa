# cq-0430 A001 — shared address primary controls (source review)

**Authority:** Rob via Constructa CTO 31 Oct 03:10 (`rob0310-actual-directions-20261031.json`).  
**Worktree branch:** `cq/cq-0430-a001-shared-controls`  
**Base commit:** `b27539067fdc5882bbc617c58ad0af3508242772`  
**Verdict:** PRODUCT_DELTA (bounded brand repair on two shared components; not NO_PRODUCT_DELTA — blue action classes were present in source).

## Scope and caller / cascade inspection

| File | Control | Pre-change classes | Caller override? |
|------|---------|-------------------|------------------|
| `src/components/manual-address-entry.tsx` | **Use this address** (`#${idPrefix}-use`) | `border-blue-500/60`, `text-blue-400` | No — `JobAddressField` / settings / new-project pass `inputCls` to **inputs** only; button classes are internal. |
| `src/components/postcode-address-picker.tsx` | **Find addresses** (`#${idPrefix}-find`) | `bg-blue-600`, `hover:bg-blue-700`, `text-white` | No — same; `inputCls` applies to postcode input only. |

`<summary>` / details chrome for manual entry uses slate/gray only (no brand-blue). Candidate list buttons use slate borders (unchanged). Status reds and semantic colors untouched. Postcode `lookup` still optional; no provider wired by this change.

**Repair:** import `coreSuggestionPrimary` + `coreFocusVisibleRing` (manual Use) and `corePrimaryButton` + `coreFocusVisibleRing` (Find) from `src/lib/core-editing-palette.ts` — same tokens as workspace primary (`#c9efcf` / `#182c1b`, emerald focus).

## Source blobs (post-change, `git hash-object`)

| Path | SHA-1 |
|------|-------|
| `src/components/manual-address-entry.tsx` | `e950a89265be1fa21827c91e0302070af3860626` |
| `src/components/postcode-address-picker.tsx` | `110e90d9355182ce9fd129ae29f1a8098831ac43` |
| `src/components/manual-address-entry.test.tsx` | `073a21a15c6f5d1df4cdbb82d29f29463cd4995b` |
| `src/components/postcode-address-picker.test.tsx` | `d39389386bbe27ee1ed4b4ce515cc8592a0b8155` |

## Tests added

- `ManualAddressEntry` — **Use this address control uses core sage primary tokens, not brand blue** (SSR markup + `#c9efcf` / `#182c1b`; existing cases retain disabled/apply/pending behavior).
- `PostcodeAddressPicker` — **Find addresses control uses core sage primary tokens, not brand blue** (SSR markup + enabled Find when postcode present; existing lookup/onSelect cases unchanged).

## Commands (literal)

Environment workaround: Cursor sandbox blocks writes to repo-root `node_modules/.vite-temp` and default system temp outside the worktree. Local vitest shim + in-worktree temp:

```bash
WT=/Users/robertsmith/dev/constructa-fresh-20261025/.cq-wt/cq-0430-a001-shared-controls
ROOT=/Users/robertsmith/dev/constructa-fresh-20261025
mkdir -p "$WT/node_modules/.vite-temp"
ln -sf "$ROOT/node_modules/vitest" "$WT/node_modules/vitest"
ln -sf "$ROOT/node_modules/vite" "$WT/node_modules/vite"
ln -sf "$ROOT/node_modules/vite-node" "$WT/node_modules/vite-node"
ln -sf "$ROOT/node_modules/@vitest" "$WT/node_modules/@vitest"
export TMPDIR="$WT/.tmp-test-run"
mkdir -p "$TMPDIR"
cd "$WT"
node ./node_modules/vitest/vitest.mjs run \
  src/components/manual-address-entry.test.tsx \
  src/components/postcode-address-picker.test.tsx
```

### Baseline RED (before component palette edit; new tests only)

```
 Test Files  2 failed (2)
      Tests  2 failed | 14 passed (16)
```

Failures (abbreviated; full assertion output retained in run log):

- `ManualAddressEntry > Use this address control…` — received `border-blue-500/60` … `text-blue-400` on `#test-manual-use`.
- `PostcodeAddressPicker > Find addresses control…` — received `bg-blue-600 hover:bg-blue-700` … `text-white` on `#test-picker-find`.

### Post-fix GREEN

```
 Test Files  2 passed (2)
      Tests  16 passed (16)
   Duration  323ms
```

Typecheck (root-installed TypeScript, no Next build):

```bash
cd "$WT"
node "$ROOT/node_modules/typescript/bin/tsc" --noEmit
```

Exit code **0** (no output).

## Limitations

- **Not run:** `next build`, full vitest suite, Playwright, ESLint sweep, gitleaks, backup push, PR/CI.
- **Vitest:** required worktree-local `node_modules` symlinks + `TMPDIR` under `$WT/.tmp-test-run` (sandbox); plain `npm test` from worktree failed with `EPERM` on root `node_modules/.vite-temp` before shim.
- **Uncommitted:** four product/test paths only; runner owns commit/push. Symlinks / `.tmp-test-run/` are local harness artifacts, not part of the deliverable.
- **Independent Grok CLI check:** not executed in this Cursor session.

## Out of scope (unchanged)

`dashboard/error.tsx`, case-study editors, marketing modules, dashboard-wide palette sweep, postcode provider enablement, semantic/status blues elsewhere.
