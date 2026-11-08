# Claude offline evidence: A023 / A038 / A091

Source and offline evidence only, read at `4116d13` on branch `claude/offline-evidence-20261108-1020`.
Nothing here is human, hosted, preview, QA-database or real-email acceptance. No migration, signup
enablement, terms wording, AI or provider activation was touched.

## What was actually run

This worktree has no `node_modules`, so **vitest was not run** (no install allowed in this pass).
The only execution was a throwaway Node check of the pure photo module:

```
node --experimental-strip-types <scratch>/check.mts   # imports src/lib/case-library/photos.ts directly
```

It confirmed every assertion in `photos-boundary.test.ts` against the real `photos.ts`
(2000/2001-char url, 300/301-char caption, 2- and 4-slot arrays, control characters, `user:pass@` url,
blank slot, `localhost` vs `localhost.evil.test`). The result was as asserted in each case.

`platform-signup-action-boundaries.test.ts` is **not run**. It was written against
`platform-signup-action.ts` and `requireTrustedAppUrl` by reading. First thing to do on the integration
branch: run it and fix any mismatch.

## New files (this branch)

- `src/lib/case-library/photos-boundary.test.ts` (A038). Node-verified logic, vitest wrapper unrun.
- `src/lib/platform-signup-action-boundaries.test.ts` (A023/A091). Unrun.
- this note.

## Exact commands for the integration branch (needs `npm ci` first, not done here)

```
npx vitest run src/lib/case-library/photos-boundary.test.ts src/lib/platform-signup-action-boundaries.test.ts
npx vitest run src/lib/platform-signup-action.test.ts src/lib/platform-terms.test.ts src/lib/platform-terms-completion.test.ts src/app/auth/platform-terms src/app/login
npx vitest run e2e/support/platform-consent-guard.test.ts
npx vitest run src/lib/case-library/photos.test.ts src/lib/case-library/content-wire.test.ts src/lib/case-library/wire-photos-on.test.ts src/lib/case-library/photo-compatibility.test.ts src/lib/case-library/photo-migration-source.test.ts
npx vitest run src/app/dashboard/settings/case-studies
```

## Existing coverage (read, not run here)

- A023 consent: `platform-signup-action.test.ts` (acceptance, forged/stale revision, no-leak failures,
  confirmation-required honesty, consent-after-session, no internal signUp retry),
  `platform-terms.test.ts` (recorder, unique violation, grants), `platform-terms-completion.test.ts`,
  `e2e/support/platform-consent-guard.test.ts`.
- A091 error paths: `signup-outcome-presentation.test.tsx`, `platform-signup-transport.test.tsx`,
  `e2e/local-phase1/signup-outcome-native.spec.ts` (Playwright, not run).
- A038 photos: `content-wire.test.ts` (`photoInputWouldBeCut`, `storedPhotoSlotsProblem`, `HTTPS://`),
  `wire-photos-on.test.ts`, `photo-compatibility.test.ts`, `photo-migration-source.test.ts`,
  `photo-upload-outcomes.test.tsx`, `case-study-photo-journey.test.ts`.

## Gaps this branch closes (once run)

- Password 7 vs 8 characters, and no password trimming.
- Email trimmed before the account call; `a@b`, `a b@c.d`, `a@@b.c`, `@b.c`, `a@.` and non-strings refused.
- Provider returns a session but no user: `signup-failed`, consent recorder never called.
- Confirmation redirect carries no trailing-slash drift; redirect omitted (signup still proceeds) when the site url is unparseable.
- Photo exact-boundary and control-character / credential / look-alike-host cases listed above.

## Stale-source limitations and discrepancies at `4116d13`

1. **Signup is already enabled in source.** `src/lib/platform-signup-policy.ts` returns
   `isPlatformSignupDisabled() === false`, and `platform-signup-action.test.ts` asserts it ("policy module
   enables signup in source"). The header comment in `platform-signup-action.ts` says the gate is
   "hard-coded false per Rob's source-only approval", which reads the opposite way round. The task list
   still shows preview-only enablement as waiting on Rob. Not changed here. Rob/Cursor should confirm the
   intended source state before any preview run.
2. **The "trusted URL" is not independent of config.** `requireTrustedAppUrl` builds its allowed origins from
   `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL` and the default. If `NEXT_PUBLIC_SITE_URL` is set to a
   wrong but valid origin, that origin is trusted and the confirmation link goes there. It is
   config-controlled, not request-controlled, so this is a deployment-config check for the QA candidate,
   not a code bug. Only an unparseable value falls back to omitting the redirect.
3. **Photo length counting is mixed.** `photoSlotsProblem` counts code points, while `normalisePhotoSlots`
   slices UTF-16 units. A 200-emoji caption passes the first and would be cut by the second.
   `photoInputWouldBeCut` is the guard and is already tested (`wire-photos-on.test.ts`), so no new test.
   Anything that calls `normalisePhotoSlots` without that guard can still cut silently.
4. The photo database check (`case_library_photo_slot_ok`) is mirrored in TypeScript only. This pass did not
   compare it with the migration SQL, and no QA SQL was run.
5. Tests mock the Supabase client, recorder and policy. None of this shows a real confirmation email
   arriving, the callback landing on `/auth/platform-terms`, or a row in the consent table. Those stay
   waiting on Rob (QA-only consent migration, legal wording, preview-only enablement, real-email owner run).
