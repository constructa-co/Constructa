# Claude batch 4 handoff — A093 RC review, test runs, A091 extension

Tool: Claude Code (Sonnet 5.5). Branch: `claude/offline-evidence-20261108-1020`. 8 Nov 2026.
Scope: source/offline evidence only. Nothing here is hosted, real-email, human, database or deploy acceptance.
No checkout, worktree, build, install, dev server, DB, credential read or write to any other branch.

## 0. Process notes

- **ACK / result lines in `/Users/robertsmith/cos-inbox/constructa.md` were NOT written.** The append was refused
  by the session's permission prompt (the path is outside the worktree; the session is non-interactive so it could
  not be approved). I did not work around it. Someone needs to add the ACK/result line for this batch.
- Disk before test groups: `df -g /` showed 41 GiB available (limit 16).
- Refs at review time: `origin/main` = `2d056c3`, `origin/cursor/rc-integration-20261108` = `f690204`, this branch
  head before this batch = `43b2677`.
- RC reads used only `git diff`, `git show`, `git grep`, `git log`, `git rev-parse`, `git merge-base`.
- Review limits: 1,232 files / +133,113 / -5,005 across about 330 commits was **not** read line by line. I read the
  CI/config/vercel/proxy/migration-permission surface and the signup/consent chain in full, and sampled the rest by
  diff stat. Everything below that says "unverified" was read from source only.

## 1. Tests run (exact commands and results)

All from this worktree, live repo `node_modules` read-only, config `/tmp/constructa-claude-batch4-vitest.mjs`
(`maxWorkers: 1`, `fileParallelism: false`). Prefix for every command:
`node /Users/robertsmith/dev/constructa-fresh-20261025/node_modules/vitest/vitest.mjs run --config /tmp/constructa-claude-batch4-vitest.mjs <files>`

| # | Files | Result |
|---|-------|--------|
| 1 | `src/lib/case-library/photos-boundary.test.ts src/lib/job-assistant-context-coverage.test.ts src/lib/platform-signup-action-boundaries.test.ts src/lib/platform-signup-error-paths.test.ts src/lib/platform-terms-revision-shape.test.ts` (all my earlier unrun files, batches 1-3) | 5 files passed, **71 tests passed**, 680 ms |
| 2 | `src/lib/platform-signup-action.test.ts src/lib/platform-signup-recorder-seam.test.ts src/lib/platform-terms.test.ts src/lib/platform-terms-completion.test.ts src/app/auth/callback/callback-return.test.ts src/app/auth/callback/callback-transport.test.ts e2e/support/platform-consent-guard.test.ts` (sibling A023/A091 files, extra signal) | 7 files passed, **140 tests passed**, 878 ms |
| 3 | `src/lib/platform-signup-input-shapes.test.ts` (new this batch) | 1 file passed, **43 tests passed**, 194 ms |

Not run: the full suite, any build, anything against RC source (that would need a checkout or worktree, which is
out of scope). **No test in this handoff has been run against RC code.**

### RC drift against my tests (predicted from source, unverified by running)

This branch and RC differ in 88 files (`git diff --shortstat HEAD origin/cursor/rc-integration-20261108`).
The ones that touch my tests:

- `src/lib/platform-signup-action.ts` on RC always sends `options: { ...redirect, data: termsEvidence }` to
  `signUp`. These batch-3 assertions would then fail on RC and need updating when the two lines of work meet:
  `platform-signup-error-paths.test.ts` lines 180, 186, 197 (`toStrictEqual({ email, password })` with no `options`),
  and the `.options` `toEqual` checks at line 174/202 and `platform-signup-action-boundaries.test.ts` line 98
  (extra `data` key). The new `platform-signup-input-shapes.test.ts` was written to tolerate this (it checks keys are
  within `email|password|options`).
- RC adds `storage-not-installed` as a recorder code and maps it to `created-and-recorded` (see risk R3). My
  "recorder code" table lists only the four codes that exist on this branch.
- A038: RC adds `src/lib/case-library/legacy-photos.ts` and `legacy-save-photos.ts`; `photos.ts` itself is not in the
  drift list, so `photos-boundary.test.ts` should still apply.
- The A055/A063 and A023 revision-shape tests import modules that RC did not change (not in the drift list).

## 2. A093 — independent acceptance checklist for `origin/main...origin/cursor/rc-integration-20261108`

Shape: merge-base is `2d056c3` = current `origin/main` tip, so RC is a pure fast-forward of main. 13 new SQL
migrations (all additive, no table drops), 4 workflows touched/added, `package.json`, `next.config.mjs`,
`vercel.json`, `.vercelignore`, `.gitleaks.toml`, `src/proxy.ts`.

### 2.1 Needs Rob (decisions, not engineering)

| ID | Item | Why it matters |
|----|------|----------------|
| R1 | **Public signup is enabled in source and the terms it asks users to accept are a labelled PLACEHOLDER.** `src/lib/platform-signup-policy.ts` returns `false` for disabled (signup on). `src/app/terms-of-service/page.tsx` says "PLACEHOLDER — Rob must review and approve the legal text". The signup checkbox links to it and the recorded revision is `platform-tos-2026-03`. | If RC is deployed to production, new customers can accept placeholder legal text. Needs Rob's/counsel's wording, or signup held off, before any production deploy. |
| R2 | **13 migrations are unapplied.** The A023 one is headed "DRAFT ONLY — not applied by automation; Rob approves before `supabase db push`." Others: company import, interview, AI budget, narrative attempt, cohort AI features, case library + photos, new-job closing prefill, job assistant ledger, working pattern v1/v2 + execute grant. | Order of "deploy code" vs "apply migrations" is a human decision. CI replay proves a clean replay on a fresh Postgres only, not on the live schema. |
| R3 | **Consent fallback can say "recorded" when nothing is stored in the consent table.** On RC, `platformSignupAction` returns `{ ok: true, outcome: "created-and-recorded" }` when the recorder reports `storage-not-installed` (table missing), relying on `user_metadata.platform_terms_revision/accepted_at` written at `signUp`. | `user_metadata` is writable by the signed-in user themselves and the timestamp comes from the app server clock, not the database, so it is not tamper-resistant consent evidence, and the action returns the same `created-and-recorded` outcome the login page keys its success message on (I did not read how the page words it). This reverses the batch-2/3 rule "never claim a stored consent record you do not have". Rob should decide whether this is acceptable pre-migration, or require the migration first. |
| R4 | **`docs/backup-snapshots/` (58 files, +10,345 lines: walkthrough registers, feedback, decisions, status JSON) enters git history.** `.vercelignore` keeps it out of Vercel uploads, but not out of the repo. `CLAUDE.md` describes the GitHub repo as public. | I did not read these files' contents and make no claim they are sensitive. Rob should confirm the repo's visibility and that nothing in them should stay private before merge. |
| R5 | **`vercel.json` rewrite narrowed from `/:path*` to `/`** for hosts `constructa.co` and `www.constructa.co`. | Before: every path on those hosts rewrote to `/landing`. After: only `/` does; other paths reach the app's own routes. `CLAUDE.md` says the marketing site is a separate project. Rob should confirm what those hosts point at and that this is intended. Hosted behaviour is unverified. |

### 2.2 Risks to resolve before merge/PR (engineering, small)

| ID | Item | Detail / suggested fix |
|----|------|------------------------|
| R6 | **E2E hosted-write guard does not name the RC branch.** In `.github/workflows/e2e.yml`, `phase1` runs on `pull_request` when not draft and `head_ref` is not one of three named review branches. `cursor/rc-integration-20261108` is not on that list. | A ready-for-review PR from RC would start the Phase 1 browser journey with the E2E Supabase secrets (it writes accounts/data to the "disposable" project; the harness refuses a non-approved project ref, but a configured ref would be written to). Open any PR from RC as **draft**, or add RC to the excluded heads and to `hosted-write-status`. |
| R7 | **Stale comments contradict shipped behaviour.** `src/lib/platform-terms-actions.ts` still says "no screen calls it yet" and "Nothing in the login page or signup payload changed"; the A023 migration header says "Nothing in the application calls the insert yet" and "does not … gate signup". RC wires a gated signup and a completion page. | Misleads the next reviewer. Update comments with the next A023 change. |
| R8 | Consent is enforced at **signup and the post-confirmation completion page only**. `src/proxy.ts` and the OAuth/password sign-in paths do not check for an acceptance record (searched `git grep` for recorder/gate use; only login, signup action, completion page and the recorder reference it). | Existing users and anyone who skips `/auth/platform-terms` are not blocked. Probably intended for a first cohort; Rob should confirm. |
| R9 | `SECURITY DEFINER` appears once in the migrations (`platform_terms_acceptances` migration, a trigger with `SET search_path = ''`). Every other new function is `REVOKE ALL … FROM PUBLIC, anon, authenticated` then `GRANT EXECUTE … TO service_role`. Every new table has RLS on. | Pattern is consistent. Still needs the six SQL test scripts (`npm run test:*-sql`) run in CI against a real Postgres; I could not run them (no DB). |
| R10 | `next.config.mjs` review-only guard throws only when `CONSTRUCTA_REVIEW_ONLY=1` **and** `VERCEL_ENV` is set and not `preview`. | A local or non-Vercel production build with the flag set is not stopped. Low risk; note it. |
| R11 | New env names read in source: `CONSTRUCTA_AI_DISABLED`, `DEEPSEEK_API_KEY`, `OPENAI_API_KEY`, `ADMIN_EMAIL`, `NEXT_PUBLIC_SITE_URL`, `CONSTRUCTA_REVIEW_ONLY`, `CONSTRUCTA_REVIEW_EDITABLE`, `E2E_SYNTHETIC_PASSWORD`. | I did not read any env file or values. Rob should confirm which are set where, and that the AI features are off in the live database rows (migrations seed them off; the live state is unverified). |

### 2.3 Missing or thin tests (found by reading, not by running)

- No test in this repo exercises the RC `storage-not-installed` branch end to end with an unmocked recorder
  (R3). `platform-terms-consent-storage.test.ts` covers the detector; `platform-signup-action.test.ts` was modified
  on RC. I did not confirm either asserts "must not claim recorded".
- Nothing tests that user_metadata cannot be used as consent evidence (R3). That is a policy decision first.
- No test pins the `vercel.json` rewrite behaviour for non-root paths (R5).
- No test checks that the E2E workflow guard excludes the RC head name (R6); a small YAML-parsing unit test
  (`e2e/support/legacy-hosted-phase1-guard.test.ts` already exists for the older guard) would catch this.
- Gate-off mirror: nothing asserts the signup policy cannot be flipped by env (the module is a constant, so this
  holds by construction).
- The migrations rely on six SQL test scripts that only run in GitHub CI with a Postgres service.

### 2.4 Guard / env assumptions the RC makes

- `E2E_BRIEF_AI_MODE: disabled` is set in the workflow; the run stops if the disposable project is not in that state.
- Signup assumes `NEXT_PUBLIC_SITE_URL` (or the hard-coded default `https://constructa-nu.vercel.app`) passes
  `requireTrustedAppUrl`; otherwise the confirmation redirect is silently omitted (pinned by my existing tests; also
  note `NEXT_PUBLIC_APP_URL` unusable also removes it).
- Review mode assumes a single labelled test user (`REVIEW_USER`) and a Preview deployment.
- `secret-scan.yml` downloads Gitleaks v8.30.1 from GitHub and checks a pinned SHA-256; failure blocks PRs from
  secrets matching `agp_` or `sbp_` tokens plus defaults.

### 2.5 Human / hosted evidence still required (none exists in this repo)

1. Rob: placeholder terms text approval or a hold on public signup (R1).
2. Rob: migration apply order and window (R2); R3 policy; R4 repository visibility check; R5 domain intent.
3. A real signup with a real mailbox, through confirmation to `/auth/platform-terms`, on a disposable target.
4. Hosted Phase 1 journey (manual `workflow_dispatch` only) after R6 is settled.
5. Live check that the AI feature rows are `enabled = false` and the usage ledgers exist.
6. Vercel preview of RC to check the `vercel.json` rewrite on the real hosts.

## 3. A091 extension — `src/lib/platform-signup-input-shapes.test.ts` (new, 43 tests, pass)

Source/offline mocks only; same seams as the existing signup tests. New cases, none duplicating batch 1-3:

- non-string email values (number, array, object with `toString`, null, undefined, boolean) → `invalid-input`, no client opened;
- email shape table pinning the current permissive pattern: accepts `a@b.c.`, `a@-b.c`, `a@b..c`; refuses `a@b`, `a@.co`,
  embedded spaces, double `@`, NBSP before the TLD;
- trimmed email reaches the provider;
- password length counted in UTF-16 units (four emoji = 8 units accepted; recorded observation, not an endorsement);
- acceptance values `"true"`, `1`, `"yes"`, `[true]`, `{value:true}`, null, undefined, 0, `""` → `terms-refused`;
- forged extra keys (`userId`, `accepted_at`, `role`, `data`) are never passed to `signUp` or the recorder;
- `signUp` itself throwing → `signup-failed`, nothing recorded, nothing identifying logged;
- each recorder failure code (`refused`, `unauthenticated`, `unrecognized-revision`, `storage-error`) → `consent-not-stored`, `signUp` called once;
- any falsy session (`null`, `undefined`, `false`, `0`, `""`) → `confirmation-required`, recorder never called;
- recorded observation: two submissions make two `signUp` calls (de-duplication is the caller's job).

Observations worth Rob's eye (not defects I can prove): the email pattern is very permissive (provider validation is
the real check); password length is UTF-16 units, not characters.

## 4. Status

- Tests: all three groups above ran and passed (71 + 140 + 43). Nothing was run against RC code.
- Commit/push: see the final message of this session and `git log` on `claude/offline-evidence-20261108-1020`.
- No PR, no force push, no other branch touched, no canonical register or dashboard edited.
