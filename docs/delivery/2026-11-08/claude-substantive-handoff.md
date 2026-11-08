# Claude substantive handoff: A023 / A038 / A091 (8 Nov 2026)

Branch `claude/offline-evidence-20261108-1020`. Appends to, and does not replace,
`claude-offline-evidence.md`. Source and offline reading only. Nothing here is human, hosted, preview,
QA-database or real-email acceptance. No migration applied, nothing enabled, no env/config touched.

## 1. Test run status: NOT RUN (permission-blocked)

The task asked for a single-worker Vitest run of the two tests from `a22ab22` using the shared
installation at `/Users/robertsmith/dev/constructa-fresh-20261025/node_modules`.

- The worktree has no `node_modules` (confirmed: `ls node_modules` fails).
- Executing the shared binary was refused by the session permission layer ("This command requires
  approval"), including the harmless `.../node_modules/.bin/vitest --version`. The session is
  non-interactive, so no approval could be given. Per the brief I stopped that action. I did not try a
  symlink, a copy, `npx`, or another path to get round it.

Result: **0 tests executed in this pass.** Both files remain unrun under Vitest. The correct command,
for whoever has the shared install usable (from this worktree root, `vitest.config.mts` is the config and
it aliases `@` to `./src`):

```
/Users/robertsmith/dev/constructa-fresh-20261025/node_modules/.bin/vitest run --root . \
  --pool=forks --poolOptions.forks.singleFork \
  src/lib/case-library/photos-boundary.test.ts src/lib/platform-signup-action-boundaries.test.ts
```

One thing to check if that fails to start: `vitest.config.mts` imports `vitest/config`, which Node resolves
relative to the config file. With no `node_modules` in the worktree that import may not resolve, and a
symlink or `NODE_PATH` would be needed. I did not test this.

## 2. Static trace of both test files against source

Done by reading, line by line, against `photos.ts`, `platform-signup-action.ts`, `email.ts`
(`requireTrustedAppUrl`) and `platform-terms-completion.ts`. A trace is not a run.

`photos-boundary.test.ts`: every assertion traces to the stated result (2000/2001 url, 300/301 caption,
slot counts 0/2/4, `\u0007` and `\n`, `user:pass@`, `user@`, `ftp:`, blank url, `localhost` vs
`localhost.evil.test`). It uses the same seams as the existing photo tests (pure module, no mocks).

`platform-signup-action-boundaries.test.ts`: every assertion traces. The mocks are the same three seams
as `platform-signup-action.test.ts` (policy, server client, recorder). `@/lib/email` is not mocked, as in
the existing test, so `resend` is imported for real. If that import fails, the existing test would fail
the same way. Specific traces:

- `a@b`, `a b@c.d`, `a@@b.c`, `@b.c`, `a@.`, `42`, `null`, `undefined` all fail `EMAIL_PATTERN` or the
  `typeof` guard, so `invalid-input` with no account call.
- Trailing-slash site url: `requireTrustedAppUrl` returns `url.toString()` (keeps `/`), the action strips
  trailing slashes, redirect becomes `https://constructa-nu.vercel.app/auth/callback?next=%2Fauth%2Fplatform-terms`.
- `NEXT_PUBLIC_SITE_URL="not a url"`: `new URL()` throws before the origin set is built, the catch returns
  `undefined`, and `signUp` is called with exactly `{ email, password }`.
- Provider returns a session and no user: `!data?.user` gives `signup-failed`; recorder never reached.

### Added this pass (same file, 3 new cases, unrun)

Order-of-checks cases the existing action test does not pin, traced to `platform-signup-action.ts` lines 100-117:

1. Source gate is checked before input validation (gate disabled + malformed input returns
   `signup-disabled`, no account call).
2. Malformed input is reported before a missing acceptance (`invalid-input`, not `terms-refused`).
3. `acceptance` must be exactly `true` (`"true"`, `1`, `"yes"`, `{}`, `null`, `undefined` all `terms-refused`).

The policy mock became a mutable `mocks.gate` (reset to `false` in `beforeEach`) to support case 1.

## 3. Signup flag versus old A091 wording

Facts in the source at this commit:

- `src/lib/platform-signup-policy.ts:10-12`: `isPlatformSignupDisabled()` returns `false`. Header says
  "Source signup enabled per Rob's 26 Oct 09:05 backup-only approval ... NOT env-, request- or
  deployment-driven. Source enablement does not apply a QA migration or change deployed settings."
- `src/lib/platform-signup-action.test.ts:46-52` asserts it: "policy module enables signup in source".
- `src/lib/platform-signup-action.ts:100-102` keeps the defensive `signup-disabled` branch;
  `platform-signup-action.test.ts:54-62` proves it refuses before the client or recorder.

Correction to my earlier note: I said the header comment in `platform-signup-action.ts` "reads the opposite
way round". On a second read it does not contradict the policy file. "Gate ... hard-coded false" means the
*disabled predicate* is hard-coded `false`, which is signup enabled. It is ambiguous wording only. A one-line
clarification there ("`isPlatformSignupDisabled()` is hard-coded `false`") would remove the doubt; I did not
edit product source.

Old A091 / hold wording, which is about deployed state and not source:

- `walkthrough-action-register.json` A091 `evidence20261107`: "Hosted real-email run NOT_RUN (sign-up
  disabled on preview). Stays Partial." Older A091 text: "hard runtime hold TRUE", "human alone legal/signup/email".
- `AGENTS.md:64-69`: "Preview remains HOLD and real signup OFF under the current inbox."

Separation:

| Layer | State | Evidence |
|---|---|---|
| Source flag | Enabled (`isPlatformSignupDisabled() === false`) | policy file + `platform-signup-action.test.ts:51` |
| Offline orchestration | Mocked tests exist; two new files unrun | this note |
| Deployed preview runtime | Not claimed. Register and AGENTS say HOLD / signup OFF | register A091, AGENTS.md |
| Real confirmation email | NOT_RUN, needs Rob/owner | register A091 `evidence20261107` |
| Consent row in QA database | Not claimed; consent migration not applied | no QA SQL run |

So "source-enabled" and "deployed preview signup OFF" are both true and are not in conflict: the source
flag does not by itself change any deployed setting. A091 stays **Partial**. I changed no register.

## 4. Draft migration read against photo validation (read only, nothing applied)

`supabase/migrations/20261028120000_case_library_photos.sql` vs `src/lib/case-library/photos.ts`.

Match:
- Exactly three slots; slot keys exactly `caption`,`url`; url 0-2000 and caption 0-300 characters (SQL
  `char_length` counts code points, TS `Array.from` counts code points).
- Control set `[\x01-\x1F\x7F]` in SQL `case_library_text_ok` (single-line) equals TS `[\u0001-\u001F\u007F]`.
- Scheme rule: `^https://` or `^http://(localhost|127\.0\.0\.1)([:/]|$)`, case-sensitive, so `HTTPS://` and
  `localhost.evil.test` are refused by both.

Differences found (not tested, not changed):
1. **Whitespace trimming.** SQL uses `btrim(url, ' ')` (ASCII space only). TS uses `String.prototype.trim()`,
   which also strips NBSP, U+2003, U+FEFF, etc. A url of `" https://images.example.test/a.jpg"`, or a
   url that is only `" "`, passes `photoSlotsProblem`/`storedPhotoSlotsProblem` (TS) but would fail
   `case_library_photo_slot_ok` (SQL). `storedPhotoSlotsProblem` is documented as a mirror of the database
   check "read as stored", so it can report OK for a row the database refuses. It matters only if such a
   value reaches a write without passing `normalisePhotoSlots` first (which trims it).
2. **TS is stricter than SQL on credentials.** SQL accepts `https://user:pass@host/...` and
   `http://user@localhost/`; TS refuses both. This direction is safe for writes (app refuses first) but a
   stored row of that form would pass SQL and fail the TS mirror.
3. Already noted: `photoSlotsProblem` counts code points; `normalisePhotoSlots` slices UTF-16 units;
   `photoInputWouldBeCut` is the guard.

I deliberately wrote no test for 1 or 2: asserting current TS behaviour would enshrine a parity gap, and
asserting SQL behaviour would fail against accepted source. Suggest the integration owner decide whether to
make `DATABASE_PHOTO_URL` use `url.replace(/^ +| +$/g, "")` for the scheme test, or add a shared vector.
No QA SQL was run, so the SQL side of this is also read, not executed.

## 5. Status

- Tests run: none (blocked, see section 1).
- Files changed: `src/lib/platform-signup-action-boundaries.test.ts` (3 cases + mutable gate), this note.
- Product source, migration, register, dashboard: untouched.
- Open for Rob/Cursor: run the two files; decide on the whitespace parity point; confirm intended preview
  state before any real-email run.
