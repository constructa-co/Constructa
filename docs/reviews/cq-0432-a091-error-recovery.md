# cq-0432 — A091 truthful dashboard error recovery (source/mock slice)

Authority: Rob via Constructa CTO 31 Oct 03:10 (`rob0310-actual-directions-20261031.json` in constructa-private-20261027).  
Scope: `src/app/dashboard/error.tsx` + `src/app/dashboard/error.test.tsx` only. Not full A091, not hosted journey, deploy, or ROOT packaging.

## Base and branch

| Item | Value |
|------|--------|
| Branch | `cq/cq-0432-a091-error-recovery` |
| Base commit (task) | `b27539067fdc5882bbc617c58ad0af3508242772` |
| Worktree HEAD at start | `b27539067fdc5882bbc617c58ad0af3508242772` (matches base) |

## Material old behavior (base `error.tsx`)

- Body copy asserted **“no data has been lost”** after any dashboard error (unsupported when saves may be in flight).
- **Try again** used `bg-blue-600` / `hover:bg-blue-700` (off-brand vs charcoal/sage primary controls).
- **Reset** remained user-triggered via `onClick={() => reset()}` only (no auto retry/navigation).
- **Dashboard** link used `getLaunchLandingPath()`; digest shown as `ref: {digest}` only (no raw `error.message` in UI).
- **Observability**: `reportError(error, { source: "dashboard-error-boundary", digest })` in `useEffect`.

## Changes made

| File | SHA-1 (post-edit, unstaged) | Intent |
|------|-------------------------------|--------|
| `src/app/dashboard/error.tsx` | `5e1565b992b574c62044243cc9b0bb152053422e` | Honest uncertainty/recovery copy; sage primary + emerald focus ring on Try again; retain reset, Dashboard href, digest ref, observability. |
| `src/app/dashboard/error.test.tsx` | `d6c827cc400cbb6cb0090a5f90127acb85006ac4` | Baseline regression on removed assurance/blue; copy, reset-once, landing href, digest-only, no leakage, observability call. |

Line-level intent also logged in `docs/cursor-change-log.md` (2026-10-31 entry).

## Commands and raw outcomes

### TypeScript (worktree)

```text
$ cd /Users/robertsmith/dev/constructa-fresh-20261025/.cq-wt/cq-0432-a091-error-recovery && npm run typecheck
> tsc --noEmit
(exit 0)
```

Note: npm emitted `Unknown env config "devdir"` warning and major-version notice; not treated as product findings.

### Focused Vitest (attempted)

```text
$ cd .../cq-0432-a091-error-recovery && npm test -- src/app/dashboard/error.test.tsx
failed to load config from .../vitest.config.mts
[Error: EPERM: operation not permitted, open '.../constructa-fresh-20261025/node_modules/.vite-temp/vitest.config.mts.timestamp-....mjs']
(exit 1)
```

**Limitation:** Worktree has no local `node_modules`; Vitest resolves via parent repo and needs write access to `node_modules/.vite-temp` outside the git worktree sandbox. **Runner / checker host must re-run** the same test path to confirm green. No Next build, no install, no dependency copies (per task).

### Git status (leave uncommitted for runner)

```text
 M src/app/dashboard/error.tsx
?? src/app/dashboard/error.test.tsx
?? docs/reviews/cq-0432-a091-error-recovery.md
(+ docs/cursor-change-log.md append)
```

## Out of scope (unchanged)

- `src/app/dashboard/projects/error.tsx` (still contains separate “Your data is safe” copy — not this slice).
- Onboarding re-export `src/app/onboarding/error.tsx`.
- Shared-address / case-study paths.
- Automatic retry, auto navigation, raw error surfacing.

## Checker model answer (intended)

PASS on source intent and TypeScript; **Vitest execution blocked in this environment** — independent checker should run `npm test -- src/app/dashboard/error.test.tsx` from a host with full `node_modules` write access before treating A091 broader than this slice complete.
