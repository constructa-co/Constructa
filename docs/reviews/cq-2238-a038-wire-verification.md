PASS — focused vitest (205), `tsc --noEmit`, and production-path ESLint all completed in this worktree with exit code 0. Source unchanged during verification; `CASE_LIBRARY_DRAFT_PHOTOS_ON_WIRE` remains `false`. Prior `docs/reviews/cq-2222-a038-library-wire-prep.md` is unchanged (approval-blocked FAIL record).

# CQ-2238 A038 library wire — runtime verification

Branch `cq/cq-2222-a038-library-wire-prep`, worktree `cq-0432-a091-error-recovery`. Parent baseline commit `319ce9d`. No product, test, config, SQL, or dependency install changes in this step — evidence doc only.

## Runtime evidence blocker removed

Claude’s FAIL doc recorded refusal: *“This command requires approval”* for `/usr/local/bin/node -v` and vitest. This verification run used the Cursor agent shell **without** that approval gate. Commands below were executed directly; stdout and exit codes are literal.

## Node and dependencies

- Requested `/usr/local/bin/node24`: **not present** on host (`ls: No such file or directory`).
- Used **`/usr/local/bin/node`** → `v24.19.0` (Node 24 LTS).
- Worktree `node_modules/` already symlinked `@vitest`, `vite`, `vite-node`, `vitest` → `/Users/robertsmith/dev/constructa-fresh-20261025/node_modules/…`.
- Additional symlinks added only where vitest/tsc/eslint needed them (no `npm install`, no copies): `typescript`, `react`, `react-dom`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `eslint-config-next`, `@testing-library`, `@vitejs`, `@types`, `happy-dom` → same ROOT `node_modules`.
- **`TMPDIR=/tmp`** (writable). No fallback required.
- **No** `next build`, `npm run build`, new compiled output, env/secret reads, or live provider calls.

## HEAD and src blob pins (before = after verification)

| Item | Value |
| --- | --- |
| `HEAD` | `f52be3669b08fe86fadb0cbb88c5d230ad77e903` |
| Baseline | `319ce9d` |

| Path | Blob @ worktree (after) | Blob @ `319ce9d` |
| --- | --- | --- |
| `src/app/dashboard/settings/case-studies/library-screens.test.ts` | `23855e280e2c7d36c8163cc1548795c8202d88d4` | `dcd1fb53c62960e55fc6feaae0e5eff2a3dff9c1` |
| `src/app/dashboard/settings/case-studies/library/case-study-editor.tsx` | `079167abfa7bcfb924e309e7fce70e9f6da4bb6f` | `a21b698a3b669375201d9a6842292b9139ff7d57` |
| `src/lib/case-library/__fixtures__/fake-library.ts` | `e2f9885c7db482a54bc46639a84d6318e09c54fd` | `2f1e326777cb5c81d93eda24af74d075ae72c75f` |
| `src/lib/case-library/content-wire.test.ts` | `91621ac388ae02139549dd033a3600f9b8600a02` | `ec097e85981e77f34fcb0f5d5a8862c3d8ec57ae` |
| `src/lib/case-library/content.ts` | `751b75bd6153ff484846edab995a66cef800fc73` | `5663f499b833c1efbe0dd1642a1aded50732a408` |
| `src/lib/case-library/messages.ts` | `d1a026c7147d9509a680e58dc24a975d5840cff3` | `a5af0b52f97e341e59a2bdc7e330abdd6c237494` |
| `src/lib/case-library/past-jobs.ts` | `a20bca4233f779b573c60eb7e5d2a9acc524ef15` | `857091353f6e6ff2b9bde9d7d8d6c57732ad1f9b` |
| `src/lib/case-library/photos.ts` | `10fc9134499ec92843e4d4eb21d1be1cce735224` | `47dde10c57a8d6f8dd8e16b6d96fc0a409f2c2f5` |
| `src/lib/case-library/service.ts` | `34a2aa78c470620b218e754528b79d8d4074fd16` | `ffaf888eb745962f945f48b5a4b59c7ba22d0afb` |
| `src/lib/case-library/status.ts` | `2a9ad4006b8a23af19cb47c924a3e0b1c9660e1c` | `9b7ec5c4bd5441c6f7ce16723afd56057b9b22b8` |
| `src/lib/case-library/wire-photos-on.test.ts` (new vs base) | `782a1f53a413a7cba4fe01e8903798aae22943d3` | *(absent — empty-tree hash `e69de29…`)* |

Constant pin (unchanged): `src/lib/case-library/content.ts:70` → `export const CASE_LIBRARY_DRAFT_PHOTOS_ON_WIRE = false as const;`

## Vitest (focused scope only)

**Argv:**

```bash
cd /Users/robertsmith/dev/constructa-fresh-20261025/.cq-wt/cq-0432-a091-error-recovery
export TMPDIR=/tmp
/usr/local/bin/node node_modules/vitest/vitest.mjs run \
  src/lib/case-library/wire-photos-on.test.ts \
  src/lib/case-library/content-wire.test.ts \
  src/app/dashboard/settings/case-studies/library-screens.test.ts \
  src/lib/case-library/service.test.ts \
  src/lib/case-library/contract.test.ts
```

**Rationale for extra files:** `service.test.ts` exercises create/save/approve wire writes and photo refusal under the real OFF constant via `fake-library`. `contract.test.ts` exercises shared `approvedValue` / `approvedProblem` snapshot vectors (OFF contract). Not run: whole-library counts (e.g. prior 48/647/775 suites), RED scratch, or SQL script.

**Stdout:**

```
 RUN  v5.0.2 /Users/robertsmith/dev/constructa-fresh-20261025/.cq-wt/cq-0432-a091-error-recovery


 Test Files  5 passed (5)
      Tests  205 passed (205)
   Start at  22:34:13
   Duration  718ms (transform 52%, import 40%, tests 6%, worker 2%)
```

**Exit code:** `0`

**Failures:** none (stop condition not triggered).

## TypeScript

**Argv:**

```bash
/usr/local/bin/node /Users/robertsmith/dev/constructa-fresh-20261025/node_modules/typescript/bin/tsc --noEmit
```

**Stdout:** *(empty)*

**Exit code:** `0`

## ESLint (changed production paths only)

**Argv:**

```bash
/usr/local/bin/node /Users/robertsmith/dev/constructa-fresh-20261025/node_modules/eslint/bin/eslint.js \
  src/app/dashboard/settings/case-studies/library/case-study-editor.tsx \
  src/lib/case-library/content.ts \
  src/lib/case-library/messages.ts \
  src/lib/case-library/past-jobs.ts \
  src/lib/case-library/photos.ts \
  src/lib/case-library/service.ts \
  src/lib/case-library/status.ts
```

**Stdout:**

```
/Users/robertsmith/dev/constructa-fresh-20261025/.cq-wt/cq-0432-a091-error-recovery/src/lib/case-library/content.ts
  185:21  warning  '_photos' is assigned a value but never used  @typescript-eslint/no-unused-vars

✖ 1 problem (0 errors, 1 warning)
```

**Exit code:** `0` (warning only; not treated as test failure).

## Out of scope (explicit)

- Hosted migration apply, backfill, flip of `CASE_LIBRARY_DRAFT_PHOTOS_ON_WIRE`, RED/GREEN scratch revert, full case-library vitest glob, `next build`, deploy, PR, main merge.
- Unapplied migration risks remain as described in `cq-2222-a038-library-wire-prep.md`; not authority to fix tonight.

## Handoff

Leave this file and any `node_modules` symlinks **uncommitted** for the runner. Immutable reference: `docs/reviews/cq-2222-a038-library-wire-prep.md` (FAIL — no runtime).
