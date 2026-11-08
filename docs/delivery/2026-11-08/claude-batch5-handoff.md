# Claude batch 5 handoff — A093 follow-up patches (consent fallback, e2e RC head, R7 comments, RC-aligned tests)

**Coordinator: please copy these two lines into `/Users/robertsmith/cos-inbox/constructa.md`.** My inbox appends were
refused again by the session's permission check (two attempts, one with a command substitution, one a plain `echo >>`;
non-interactive session, so no approval was possible). I did not work around it.

```
2026-11-08 batch5 ACK: Claude Code (Sonnet 5.5), branch claude/offline-evidence-20261108-1020, scope: A093 follow-up patches (consent fallback, e2e.yml RC head, R7 comments, RC-aligned signup assertions), source/offline only
2026-11-08 batch5 RESULT: Claude Code, claude/offline-evidence-20261108-1020: 4 reviewable patches + handoff in docs/delivery/2026-11-08/claude-batch5-*; vitest on a partial RC overlay: 117/117 pass patched, 7 predicted failures reproduced unpatched, 2 negative controls fail as expected; git apply --check NOT run (permission); no merge, no RC/main write. Commit/push hash is in the session's final message.
```

Tool: Claude Code (Sonnet 5.5). Branch `claude/offline-evidence-20261108-1020`, head before this batch `7ba37af`.
Scope: source/offline evidence only. Nothing here is hosted, real-email, human or database acceptance. No checkout of
RC or main, no worktree, build, install, dev server, DB, credential read, merge, PR or other-branch write.
Refs read with `git show` / `git diff` / `git grep` only: RC `f690204`, main `2d056c3`.
Disk before test runs: 41 GiB free (limit 16).

## 1. The four patches (all in `docs/delivery/2026-11-08/`)

| File | Base it was made against | What it changes |
|------|--------------------------|-----------------|
| `claude-batch5-1-consent-fallback.patch` | RC `f690204` file contents | `src/lib/platform-signup-action.ts`, `platform-signup-action.test.ts`, `platform-signup-recorder-seam.test.ts` |
| `claude-batch5-2-e2e-rc-head.patch` | RC `f690204` file contents | `.github/workflows/e2e.yml`, `src/lib/deployment/review-branch-ci.test.ts` |
| `claude-batch5-3-r7-stale-comments.patch` | RC `f690204` file contents | comments only: `src/lib/platform-terms-actions.ts`, `supabase/migrations/20261024122500_platform_terms_acceptance.sql` |
| `claude-batch5-4-rc-aligned-signup-tests.patch` | **this branch's head `7ba37af`** | my three signup test files, aligned to what RC sends |

Format: plain `diff -u` with `a/` and `b/` labels (no timestamps), applicable with `git apply` / `patch -p1` from the
repo root of the named base. **I could not run `git apply --check` or `patch --dry-run`** (both refused by the
permission check). Each patch was produced by diffing a byte-for-byte `git show` copy of the base against the edited
copy, so it should apply; confirm with `git apply --check` before use.

Patches 1-3 touch files that exist on RC. Patch 4 touches files that exist **only on this branch** (RC has no
`platform-signup-error-paths`, `-action-boundaries` or `-input-shapes` test), so it applies when the two lines of work
meet, not to RC alone.

### 1.1 Patch 1 — honest outcome when the consent table is missing (R3)

RC today: `platformSignupAction` returns `{ ok: true, outcome: "created-and-recorded", userId }` when the recorder
says `storage-not-installed`, relying on `user_metadata` written at `signUp`.

Patch: that branch is removed (and the now-unused `createdUserId` with it). `storage-not-installed` now falls through
to the existing generic failure path: it logs the typed code only and returns `{ ok: false, code: "consent-not-stored" }`.
The `options.data` evidence at `signUp` is deliberately **kept** (supplementary only, now commented as such); only the
claim of a stored record is removed. No new result code, so the login page, `e2e/platform-consent.qa.ts` and the
consent guard already handle the outcome (they key on `consent-not-stored`).

Tests in the patch:
- RC test "succeeds when the consent table is not installed…" is inverted: expects `consent-not-stored`, no `outcome`
  or `userId` property, one `signUp`, one recorder call, metadata still sent, only the typed code logged (no email,
  password or user id).
- New: no session + table missing still returns `confirmation-required` and never calls the recorder.
- Seam test (real recorder, only transport mocked): `PGRST205` and `42P01` on insert → `consent-not-stored`, one
  signUp, one insert, provider message not logged.

Consequence Rob should know before choosing (this is a product/ops decision, not mine):
- Without the migration applied, **no signup can complete its terms record**. With a session the user sees the
  existing "Your account was created, but we couldn't record your terms acceptance. Please sign in to complete it."
  message; with email confirmation they reach `/auth/platform-terms`, and RC's completion action already maps
  `storage-not-installed` to `not-stored`. So the patch makes signup consistent with the completion page (which is
  already honest) rather than creating a new failure mode, but the practical effect is a dead end until the A023
  migration is applied. That reinforces R2: apply the migration before any public signup.
- The alternative is to keep RC's behaviour and accept `user_metadata` as interim evidence. Then the login page says
  "Account created." (it keys on `created-and-recorded`), which I would not call a stored consent record.

### 1.2 Patch 2 — keep the RC head out of the automatic hosted E2E job (R6)

Adds `cursor/rc-integration-20261108` to the `hosted-write-status` condition and to the `phase1` exclusion list
(identical wording to the three existing heads), and extends the existing unit test
`src/lib/deployment/review-branch-ci.test.ts` (adds the RC head to the "excluded" table and a `…-other` suffix head to
the "retained" table).

Effect, by reading the expressions and by evaluating them with the repo's own test helper:
- A **ready-for-review PR whose head is exactly `cursor/rc-integration-20261108`**: `hosted-write-status` runs and
  writes "Hosted Phase 1 journey: NOT_RUN" to the job summary; `phase1` is skipped, so the E2E Supabase secrets are not
  used and nothing is written to the disposable project.
- **Draft PRs**: unchanged (already blocked by `draft-pull-request-status`).
- **`workflow_dispatch`**: unchanged (manual, still runs `phase1`).
- Other heads, including `cursor/rc-integration-20261108-other`: unchanged (test pins this).
- Caveats: it matches the branch name only, so renaming the branch or opening the PR from another head name bypasses
  it; and a skipped job may show as passing in branch protection, so a green E2E check on that PR means "not run",
  not "passed". The simpler no-patch alternative is to open the RC PR as a draft.

Negative control (see section 2): the new RC-head test case **fails against the unpatched RC workflow**, which
reproduces R6 from the checked-in expression (no hosted action involved).

### 1.3 Patch 3 — R7 stale comments (comments only)

- `src/lib/platform-terms-actions.ts`: removes "Nothing in the login page or signup payload changed" and "no screen
  calls it yet". Verified with `git grep` on RC that **nothing imports `recordPlatformTermsAcceptanceAction`**; the
  signup action and the completion action both call `recordPlatformTermsAcceptance` directly. The comment now says
  that, and that the wrapper should be wired to a screen or removed (a decision, not made here).
- A023 migration header: replaces "does not … gate signup … Nothing in the application calls the insert yet; the server
  action is the recording boundary" with the actual callers, and notes the recorder reports `storage-not-installed`
  while the table is missing. The migration is unapplied (its header already says DRAFT ONLY), so editing a comment
  does not touch any applied-migration history. Do **not** edit comments this way in a migration once it has been applied.
- I grepped the rest of the RC consent surface (policy, signup action, terms, acceptance, completion, login, auth,
  the migration) for other stale phrases ("no screen", "nothing in the application", "wired to a", "signup is
  disabled"); only those two places matched.

### 1.4 Patch 4 — RC-aligned versions of the signup assertions

The batch-4 prediction was confirmed, with one correction: **7** assertions fail on RC, not "about 6". I missed
`platform-signup-action-boundaries.test.ts` line 106 (`toEqual({ email, password })`, which also breaks because RC
adds `options`).

| File | Lines | Was | Now (RC-aligned) |
|------|-------|-----|------------------|
| `platform-signup-error-paths.test.ts` | 174, 202 | `options` equals `{ emailRedirectTo }` | plus `data: TERMS_EVIDENCE` |
| `platform-signup-error-paths.test.ts` | 180, 186, 197 | `toStrictEqual({ email, password })` | `{ email, password, options: { data: TERMS_EVIDENCE } }` |
| `platform-signup-action-boundaries.test.ts` | 98 | `options` equals `{ emailRedirectTo }` | plus `data: TERMS_EVIDENCE` |
| `platform-signup-action-boundaries.test.ts` | 106 | `toEqual({ email, password })` | plus `options: { data: TERMS_EVIDENCE }` |

`TERMS_EVIDENCE = { platform_terms_revision: <current revision>, platform_terms_accepted_at: expect.any(String) }`.
The two metadata key names are written as **literals**, not imported constants, on purpose: the constants do not exist
on this branch, and a literal makes a key rename visible. The timestamp is `expect.any(String)` because these files do
not fake the clock.

New test in `platform-signup-input-shapes.test.ts` (RC-aligned): with forged `userId`, `accepted_at: "1999-…"` and
`data: { x: 1 }` in the input, `options.data` has exactly the two evidence keys, the revision is the trusted one, and
the timestamp is a valid ISO instant that is not the forged 1999 value. The rest of `input-shapes` already passed on
RC unchanged.

**Do not apply patch 4 to this branch's own source alone**: its assertions expect `options.data`, which this branch's
`platform-signup-action.ts` does not send, so they would fail here. Apply it with the RC signup action.

## 2. Tests run (exact method and results)

Why not the usual runner: `/tmp/constructa-claude-batch4-vitest.mjs` aliases `@` to this worktree's `src`, which has
the pre-RC signup action. To test RC source without checking RC out, I made an **untracked scratch directory inside
this worktree** (`.b5-scratch`, since deleted; `/tmp` writes need approval), filled it with `git show` copies of the
RC files, and used a throwaway vitest config that aliased only those module names to the copies and everything else
(`@/...`) to this worktree's `src`. Same live `node_modules` read-only, `maxWorkers: 1`, `fileParallelism: false`.

Config shape (recreate to reproduce):

```js
// alias: for each non-test file in <overlay>/src/lib -> { find: /^@\/lib\/<name>$/, replacement: <overlay>/src/lib/<name> }
// then { find: /^@\//, replacement: <worktree>/src/ }, { find: /^vitest$/, replacement: <live node_modules>/vitest/dist/index.js }
// root: <worktree>; test: { environment: "node", maxWorkers: 1, fileParallelism: false }
```

RC copies in the overlay (all via `git show f690204:…`): `platform-signup-action.ts`, `platform-signup-action.test.ts`,
`platform-signup-recorder-seam.test.ts`, `platform-terms-consent-storage.ts`, `platform-terms-signup-evidence.ts`,
`platform-terms.ts`, `platform-terms-acceptance.ts`, `platform-terms-actions.ts`,
`src/lib/deployment/review-branch-ci.test.ts`, the A023 migration, `.github/workflows/e2e.yml`. Other imports of the
action (`email.ts`, `supabase/server`, `platform-terms-completion.ts`, `platform-signup-policy.ts`) resolved to this
worktree's copies; `git diff --name-status 7ba37af f690204` shows those four **unchanged** on RC.

| # | Run | Result |
|---|-----|--------|
| A | **Baseline, unpatched RC overlay**: RC `platform-signup-action.test.ts`, `platform-signup-recorder-seam.test.ts`, `review-branch-ci.test.ts`, plus my three **unpatched** signup tests | 6 files; **104 passed, 7 failed** (111). Failures exactly as predicted: error-paths lines 174/180/186/197/202 and boundaries lines 98/106. RC's own three tests and `input-shapes` (43) passed. |
| B | **Patched overlay**: patches 1-3 applied to the RC copies, patch 4 applied to my tests | 6 files, **117 passed, 0 failed**, ~750 ms |
| C | Negative control: patched `platform-signup-action.test.ts` against the **unpatched RC action** | 1 failed / 13 passed: "does not claim a stored consent record…" (RC returns `created-and-recorded`). Confirms the test detects the R3 behaviour. |
| D | Negative control: patched guard test (RC head included) against the **unpatched RC workflow** | 1 failed / 8 passed: the RC-head case (`hosted-write-status` is false, so RC head is not excluded). Reproduces R6 from the checked-in expression. |

Where the results are **not** RC-verified (be strict about this):
- This is a **partial overlay**, not an RC checkout. Files outside the list above came from this branch. I confirmed by
  name-status that the four non-overlaid files the action imports are unchanged on RC, but I did not diff the rest of
  RC's 88 differing files against what these tests import transitively.
- The patched **seam-test** cases (`PGRST205`, `42P01`) passed in run B, but I did not run a negative control for the
  seam test specifically (C covers the unit-level test).
- Not run: `tsc`, lint, any build, the full suite, the SQL test scripts, any other RC test. Removing `createdUserId`
  should leave no unused variable, but I have not type-checked it.
- `git apply --check` / `patch --dry-run` on the four patches (refused by the permission check).
- No test here touches a real Supabase, mailbox or browser.

## 3. Corrections to my batch-4 handoff

- "About 6 earlier assertions fail on RC": it is **7** (see 1.4). Also, `platform-signup-input-shapes.test.ts` does pass on RC unchanged (43/43), as I said it should.
- R6 was stated from reading only; it is now reproduced by evaluating the checked-in `if` expression (run D).
- R7 said the comments were stale in two places; the grep above found no others in the consent surface.

## 4. What I did not do

- Did not merge, rebase, check out or write RC, main, or any other branch or worktree; did not open a PR.
- Did not edit the canonical register or dashboard, or the inbox (blocked; lines are at the top of this file).
- Did not change UI wording. After patch 1 the login page still says "Please sign in to complete it" when the table is
  missing, and the completion page will keep failing until the migration is applied. If Rob wants a different message
  for that state, it needs a new typed code and a page change, which is outside "return an honest outcome".
- Did not decide the R3 policy question. The patch implements the honest-outcome option; the other option is in 1.1.

## 5. Status

- Tests: runs A-D above (source/offline, partial RC overlay). Nothing run against a full RC checkout.
- Commit/push: see the final message of the session and `git log` on `claude/offline-evidence-20261108-1020`.
- Files added by this batch: the four patches and this handoff. The scratch directory was removed.
