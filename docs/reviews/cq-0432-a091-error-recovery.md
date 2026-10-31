# cq-0432 — A091 truthful dashboard error recovery (source/mock slice)

Authority: Rob via Constructa CTO 31 Oct 03:10 (`rob0310-actual-directions-20261031.json` in constructa-private-20261027).  
Scope: `src/app/dashboard/error.tsx` + `src/app/dashboard/error.test.tsx` only. Not full A091, not hosted journey, deploy, or ROOT packaging.

## Base and branch

| Item | Value |
|------|--------|
| Branch | `cq/cq-0432-a091-error-recovery` |
| Base commit (task) | `b27539067fdc5882bbc617c58ad0af3508242772` |
| Product source anchor | `f9a2f05429e0a5f47390f3d528646414736efedc` (`error.tsx` unchanged since) |

## Material old behavior (base `error.tsx`)

- Body copy asserted **“no data has been lost”** after any dashboard error (unsupported when saves may be in flight).
- **Try again** used `bg-blue-600` / `hover:bg-blue-700` (off-brand vs charcoal/sage primary controls).
- **Reset** remained user-triggered via `onClick={() => reset()}` only (no auto retry/navigation).
- **Dashboard** link used `getLaunchLandingPath()`; digest shown as `ref: {digest}` only (no raw `error.message` in UI).
- **Observability**: `reportError(error, { source: "dashboard-error-boundary", digest })` in `useEffect`.

## Source blobs (post repair, unstaged)

| File | SHA-1 (`git hash-object`) | SHA-256 |
|------|---------------------------|---------|
| `src/app/dashboard/error.tsx` | `5e1565b992b574c62044243cc9b0bb152053422e` | `e4ddb0e81b26c98ea506d3c7d27854f99835cdc06c17abfbe7d89ec8cfe4b2ae` |
| `src/app/dashboard/error.test.tsx` | `3eef7f006a1628836e6fe56ee635f1046aa364f4` | `d016fe06cd54140e9f5f2d787a864dfcaa5115446edd3902d88a9105dab42da7` |

**Byte check:** `diff -q <(git show f9a2f05:src/app/dashboard/error.tsx) src/app/dashboard/error.tsx` → identical (no product delta in this repair pass).

## Test repair (digest selector only)

**Prior honest status:** The slice was **not GREEN** in Vitest — an earlier “PASS on intent” note was wrong once tests could execute. TypeScript alone did not prove the mock tree assertions.

**Root cause:** Pre-order `nodes()` lists the outer layout `<div>` before descendants. `els.find(e => text(e.props.children).includes("ref:"))` matched the root because `text()` on its `children` aggregates the full subtree, including the digest line. The exact `toBe("ref: digest-only-ref")` assertion then failed on that root’s aggregated text.

**Fix (test only, line ~78):**

```diff
-        const refLine = els.find(e => text(e.props.children).includes("ref:"));
+        const refLine = els.find(e => text(e.props.children) === "ref: digest-only-ref");
```

Exact digest-only and no-raw-`internal` assertions unchanged.

## Commands and raw outcomes

Node: `/usr/local/bin/node -v` → `v24.19.0`

Worktree-local Vitest symlinks (parent `node_modules`, no install):

```bash
WT=/Users/robertsmith/dev/constructa-fresh-20261025/.cq-wt/cq-0432-a091-error-recovery
ROOT=/Users/robertsmith/dev/constructa-fresh-20261025
mkdir -p "$WT/node_modules/.vite-temp"
ln -sf "$ROOT/node_modules/vitest" "$WT/node_modules/vitest"
ln -sf "$ROOT/node_modules/vite" "$WT/node_modules/vite"
ln -sf "$ROOT/node_modules/vite-node" "$WT/node_modules/vite-node"
ln -sf "$ROOT/node_modules/@vitest" "$WT/node_modules/@vitest"
```

### Historical EPERM (preserved)

```text
$ cd .../cq-0432-a091-error-recovery && npm test -- src/app/dashboard/error.test.tsx
failed to load config from .../vitest.config.mts
[Error: EPERM: operation not permitted, open '.../constructa-fresh-20261025/node_modules/.vite-temp/vitest.config.mts.timestamp-....mjs']
(exit 1)
```

Job `TMPDIR=/Users/robertsmith/constructa-queue/tmp/cq-0441-a091-digest-test-fix` is blocked under Cursor sandbox (`EPERM` on `.../ssr` mkdir). Elevated run approval was **not granted** in this session; focused Vitest below used gitignored `$WT/node_modules/.vite-temp/vitest-run-tmp` as `TMPDIR` (no tracked `.tmp-test-run`).

### rawFAIL — before selector fix

```bash
export TMPDIR="$WT/node_modules/.vite-temp/vitest-run-tmp"
mkdir -p "$TMPDIR"
cd "$WT"
/usr/local/bin/node ./node_modules/vitest/vitest.mjs run src/app/dashboard/error.test.tsx
```

```text
 ❯ src/app/dashboard/error.test.tsx (6 tests | 1 failed) 7ms
     × shows digest-only support reference when present 3ms

 FAIL  ... > shows digest-only support reference when present
AssertionError: expected 'Something went wrongWe hit an error l…' to be 'ref: digest-only-ref' // Object.is equality

Expected: "ref: digest-only-ref"
Received: "Something went wrongWe hit an error loading this page....ref: digest-only-refTry againDashboard"

 ❯ src/app/dashboard/error.test.tsx:80:47
(exit 1)
```

### GREEN — after selector fix (same command)

```text
 Test Files  1 passed (1)
      Tests  6 passed (6)
   Duration  130ms
(exit 0)
```

### TypeScript (worktree, unchanged)

```text
$ cd .../cq-0432-a091-error-recovery && npm run typecheck
> tsc --noEmit
(exit 0)
```

No Next build, no full suite, no dependency copies.

## Out of scope (unchanged)

- `src/app/dashboard/projects/error.tsx` (still contains separate “Your data is safe” copy — not this slice).
- Onboarding re-export `src/app/onboarding/error.tsx`.
- Shared-address / case-study paths.
- Automatic retry, auto navigation, raw error surfacing.

## Checker model answer

PASS on bounded slice: `error.tsx` matches `f9a2f05`; digest test targets the mono `<p>` leaf via exact direct-child text; focused Vitest **6/6** GREEN with recorded rawFAIL; prior Vitest PASS-on-intent retracted. No runtime/browser reproduction claimed from logs alone. Leave unstaged for cq runner — not ROOT accepted or full A091 Complete.
