# ROB2245 — Cursor A024 privacy draft label return

**Task:** A024 approved draft privacy notice — visible **Draft, not yet legally approved** label only.  
**Worktree:** `/Users/robertsmith/dev/constructa-fresh-20261025/.cq-wt/a024-privacy`  
**Branch:** `cq/a024-privacy`  
**Base (merge-base vs main):** `9405c2fca87174d51b7d1fb480aec73d2ba3c839`  
**Source HEAD (unchanged commit; working tree modified, not committed):** `4c66969e92372d26d7136c1c5ce34f40512891c1`  
**Model lane:** Cursor Composer 2.5 fast=false (owner overnight); checker Grok; target 05:30 UAE 31 Oct.

## Scope delivered

- `src/app/privacy-policy/page.tsx`: prominent accessible notice (`role="note"`, `h2#privacy-draft-status`) with literal **Draft, not yet legally approved**; clarifies not legal approval, not marketing publication, not compliance certification. Entire existing `data-privacy-review-note` paragraph, contact mailto, and footer copy unchanged.
- `src/app/privacy-policy/privacy-information.test.tsx`: additive draft-status test; structure test paragraph count 5→6.
- `docs/cursor-change-log.md`: ROB2245 entry (Cursor change-log rule).

No commit, push, PR, deploy, or status closure from this session.

## File SHA-256 (working tree)

| File | SHA-256 |
|------|---------|
| `src/app/privacy-policy/page.tsx` | `02d8233cc19a143b1ec815e39dd20125cc73e3ff9aed060a829506e8d7be7a9f` |
| `src/app/privacy-policy/privacy-information.test.tsx` | `75cb0e8280cfba107884fa08cc44d7f1a091dc1ffa742c925643f9e4ad12300d` |
| `docs/cursor-change-log.md` | `e804c8a38b3fa040f984faf0a0f8cbe9893213622d07a152b09df20ac1fd049a` |

Companion patch: `docs/delivery/temp/ROB2245-CURSOR-A024-RETURN.patch` in this worktree (intended mirror: `/Users/robertsmith/dev/constructa-private-20261027/ROB2245-CURSOR-A024-RETURN.{md,patch}` — copy blocked from agent sandbox; parent loop should `cp` these two files).

## Focused test command (limits)

From worktree root. Uses repo-root `node_modules` via `NODE_PATH`; local `node_modules/.vite-temp` only (no install). **Scope:** single file `src/app/privacy-policy/privacy-information.test.tsx` only — not full suite, not Next build.

```bash
cd /Users/robertsmith/dev/constructa-fresh-20261025/.cq-wt/a024-privacy
mkdir -p node_modules/.vite-temp
NODE_PATH="/Users/robertsmith/dev/constructa-fresh-20261025/node_modules" \
  node /Users/robertsmith/dev/constructa-fresh-20261025/node_modules/vitest/vitest.mjs run \
  src/app/privacy-policy/privacy-information.test.tsx
```

### Baseline (pre-change, 4 tests)

```
 RUN  v5.0.2 /Users/robertsmith/dev/constructa-fresh-20261025/.cq-wt/a024-privacy
 Test Files  1 passed (1)
      Tests  4 passed (4)
   Duration  145ms
EXIT:0
```

### RED (tests extended; page not yet updated)

```
 RUN  v5.0.2 /Users/robertsmith/dev/constructa-fresh-20261025/.cq-wt/a024-privacy
 ❯ src/app/privacy-policy/privacy-information.test.tsx (5 tests | 2 failed) 8ms
 FAIL  src/app/privacy-policy/privacy-information.test.tsx > privacy information > shows the approved draft status label and clarifies what it is not
AssertionError: expected 'Privacy Policy At Constructa, we resp…' to contain 'Draft, not yet legally approved'
 FAIL  src/app/privacy-policy/privacy-information.test.tsx > privacy information > keeps the page structure and the facts it already stated
AssertionError: expected [ '<p ', '<p ', '<p ', '<p ', '<p ' ] to have a length of 6 but got 5
 Test Files  1 failed (1)
      Tests  2 failed | 3 passed (5)
   Duration  142ms
EXIT:1
```

### GREEN (page + tests)

```
 RUN  v5.0.2 /Users/robertsmith/dev/constructa-fresh-20261025/.cq-wt/a024-privacy
 Test Files  1 passed (1)
      Tests  5 passed (5)
   Duration  128ms
EXIT:0
```

## Focused lint

```bash
cd /Users/robertsmith/dev/constructa-fresh-20261025/.cq-wt/a024-privacy
NODE_PATH="/Users/robertsmith/dev/constructa-fresh-20261025/node_modules" \
  node /Users/robertsmith/dev/constructa-fresh-20261025/node_modules/eslint/bin/eslint.js \
  src/app/privacy-policy/page.tsx src/app/privacy-policy/privacy-information.test.tsx
```

**Result:** no output, **EXIT:0** (eslint on those two paths only).

## Git status (uncommitted)

```
 M docs/cursor-change-log.md
 M src/app/privacy-policy/page.tsx
 M src/app/privacy-policy/privacy-information.test.tsx
```

Optional local-only: `node_modules/.vite-temp/` under worktree (not intended for commit).

## Handoff for Grok / packaging

- Grade uncommitted diff on `cq/a024-privacy` from `4c66969`.
- Commit hash + checker evidence required before parent status closure (not done here).
