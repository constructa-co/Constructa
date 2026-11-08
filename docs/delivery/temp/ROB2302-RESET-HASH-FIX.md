# ROB2302 — Reset-password hash OTP expiry repair

**Job:** cq-qa-reset-route-tests (same-author finding repair)  
**Branch:** `cq/cq-qa-reset-route-tests`  
**Base commit (unchanged HEAD for grading):** `b84933de5d8bfb360b05a0fd45a5bab05466a9e6`  
**Status:** Source-only, **uncommitted** (exact-delta grade)

## Codex FAIL (final)

From `/Users/robertsmith/constructa-queue/checks/cq-qa-reset-route-tests.FAIL`:

- Reset-password does not inspect hash error parameters. `#error=access_denied&error_code=otp_expired` falls through to `getSession()`; an existing session can display the password form despite the expired link.
- Added tests cover query failures and rejected tokens, but omit hash failures.

## Repair (scope)

| Area | Delta |
|------|--------|
| `src/lib/auth-recovery-link-failure.ts` | Shared `isRecoveryLinkFailureParams`; new `isRecoveryLinkFailureHash` (same rules as query). |
| `src/app/auth/reset-password/page.tsx` | After query failure check, hash failure → `RECOVERY_LINK_EXPIRED_MESSAGE`, `replaceState`, **return** (no `setSession` / `getSession`). |
| Tests | Lib hash `it.each`; page test with mocked existing session; query test asserts `getSession` not called. |
| Proxy / forgot-password | **No changes.** |

## Source / test SHA-256 (after repair)

```
1fbd9b34280f92d277fabb67f3db1c34b8f7a6d351c4865c6ede4e96e232865a  src/lib/auth-recovery-link-failure.ts
d42c7e4cca5535a215eda2a087e9debc352d8ef96b4112228b3b79048bb5239f  src/lib/auth-recovery-link-failure.test.ts
2e4226a9f5bc90ba7ee15f0f6796dab81ee2d789eda40ac7b868e994e06c0dcf  src/app/auth/reset-password/page.tsx
ad1837ba515e929c329e3e2f891ae81c9480152c21eabc087d84f3b1421b693e  src/app/auth/reset-password/page.test.tsx
```

## Test command (focused)

Worktree has no `node_modules`; reuse parent repo deps and a local `node_modules/.vite-temp` only for Vitest cache (not committed):

```bash
cd /Users/robertsmith/dev/constructa-fresh-20261025/.cq-wt/cq-qa-reset-route-tests
mkdir -p node_modules/.vite-temp
NODE_PATH="/Users/robertsmith/dev/constructa-fresh-20261025/node_modules" \
  node /Users/robertsmith/dev/constructa-fresh-20261025/node_modules/vitest/vitest.mjs run \
  src/lib/auth-recovery-link-failure.test.ts \
  src/app/auth/reset-password/page.test.tsx
rm -rf node_modules
```

### GREEN (with fix)

```
 RUN  v5.0.2 /Users/robertsmith/dev/constructa-fresh-20261025/.cq-wt/cq-qa-reset-route-tests

 Test Files  2 passed (2)
      Tests  25 passed (25)
   Start at  22:59:56
   Duration  175ms (transform 56%, import 27%, tests 13%, worker 4%)
```

### RED (new test only, hash guard removed from page — reproduces Codex bug)

```
 FAIL  src/app/auth/reset-password/page.test.tsx > reset password page > refuses the password form for hash failures even when a session already exists
AssertionError: expected markup to contain RECOVERY_LINK_EXPIRED_MESSAGE
Received: ... id="password" ... Update password ...
```

## Exact diff since `b84933de5d8bfb360b05a0fd45a5bab05466a9e6`

See sibling file `ROB2302-RESET-HASH-FIX.patch` (includes changelog; **exclude** `docs/delivery/temp/**` from product packaging).

```diff
diff --git a/docs/cursor-change-log.md b/docs/cursor-change-log.md
index ad131b8..8c0a2a3 100644
--- a/docs/cursor-change-log.md
+++ b/docs/cursor-change-log.md
@@ -169,3 +169,12 @@
 | `src/proxy.ts` (+ `proxy.test.ts`) | GET redirect from public routes with expired OTP query to `/auth/forgot-password?notice=link-expired` | Stop silent homepage landings on QA |
 | `src/app/auth/reset-password/page.tsx` (+ `page.test.tsx`) | Query/hash failure UX; form when session valid; link to forgot-password | Valid link shows form; invalid shows clear recovery path |
 | `src/app/auth/forgot-password/page.tsx` (+ `page.test.tsx`) | Hydrated alert for `notice=link-expired` | Message after proxy normalisation |
+
+## 2026-10-30 — Reset-password hash OTP expiry (ROB2302, Cursor)
+…
diff --git a/src/lib/auth-recovery-link-failure.ts b/src/lib/auth-recovery-link-failure.ts
… + isRecoveryLinkFailureHash, shared params helper …
diff --git a/src/app/auth/reset-password/page.tsx b/src/app/auth/reset-password/page.tsx
… + early hash failure return …
diff --git a/src/app/auth/reset-password/page.test.tsx b/src/app/auth/reset-password/page.test.tsx
… + hash + existing session test; getSession not called on query failure …
diff --git a/src/lib/auth-recovery-link-failure.test.ts b/src/lib/auth-recovery-link-failure.test.ts
… + hash fragment describe block …
```

(Full patch: `docs/delivery/temp/ROB2302-RESET-HASH-FIX.patch`.)
