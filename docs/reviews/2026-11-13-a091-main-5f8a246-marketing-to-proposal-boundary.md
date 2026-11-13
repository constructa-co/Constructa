# A091 verification of main 5f8a246 — offline marketing-to-proposal boundaries — 13 Nov 2026

**Verdict: A091 stays Partial.** Read in full and partly executed, the boundaries around sign-in, the
auth callback, the cohort gate and first-session landing hold. Four defects were found at the
marketing entry (D1–D4 below). The most important is **D1: the public "Apply" form tells an
applicant their interest was recorded when nothing is stored.** No test, build or typecheck was run
(see "Not run"), so this is a source review plus a small direct execution, not a passing candidate.

Reviewer: Claude (Sonnet 5.5), worktree `.cq-wt/r1-20261113-a093-review`. Nothing was committed,
pushed, built, installed, deployed or deleted. No SQL, hosted request, signup or credential was
touched. This file is the only change.

Legend: **PASS** = checked, evidence shown. **DEFECT** = found. **NOT RUN** = not checked under this
task's limits. NOT RUN is not a pass.

## 1. Identity

| Check | Result | Evidence |
| --- | --- | --- |
| HEAD is exactly `5f8a246` | **PASS** | `git log -1 --format=%H 5f8a246` = `5f8a246c66aebdc1ad4dc1fd75bba80b6dfa051c` ("Merge pull request #117 … a109-launch"); worktree HEAD is that commit; branch `codex/r1-20261113-a091-integration` |
| Tree is clean and unchanged | **PASS** | `git status --short` = 0 lines; `git diff --stat 5f8a246 HEAD` empty |
| Delta since the last reviewed main `d22562e` | **PASS** | First-parent merges: #111 `d22562e`, #114 `7f43cef`, #113 `33f2cca`, #115 `82eb615`, #116 `2153f70`, #117 `5f8a246`. The one that touches this boundary is #117 (A109 Apply CTA) |
| A recorded test result exists for this exact SHA | **NONE FOUND** | The register's A091 count (6283 pass) is for `f64cd1c`+`09c446a`. `docs/cursor-change-log.md` has no result line for #115–#117 |

## 2. Boundary map

Journey: marketing page → Apply or Sign in → (sign-up email) → auth callback → platform-terms
completion → onboarding → first-session landing → cohort-gated dashboard → proposal → public proposal.

| Hop | Code | Existing test | Reviewed here |
| --- | --- | --- | --- |
| Marketing → **Apply** (primary CTA, every marketing page) | `phase-one.tsx` `FoundingCohortApplyLink` → `/apply`; `app/apply/page.tsx` | `apply-route.test.tsx`, `actions.test.ts` | **DEFECT D1, D2.** Not covered by the A091 test |
| Marketing → Sign in | `SignInLink` → `/login` | A091 test 5 (`href="/login"`) | PASS |
| Sign-up email redirect | `platform-signup-action.ts:89-101` → `platformTermsConfirmationRedirect` | `platform-signup-action-boundaries.test.ts:101-118` | PASS with **D3** |
| Email link → callback → completion page | `auth/callback/route.ts` | A091 test 1; `callback-return.test.ts`; `callback-transport.test.ts` | PASS (read). Off-site `next` falls back to `/dashboard`; recovery ignores `next`; thrown provider call lands on the fixed error |
| Deliberate sign-in returning to completion | `platformTermsCompletionReturn`, `login/page.tsx:91` | A091 test 2 | PASS (**executed**, section 4) |
| Completion page needs a session | `auth/platform-terms/page.tsx:21` redirects to `PLATFORM_TERMS_COMPLETION_SIGN_IN` | `completion-routing.test.tsx` | PASS (read) |
| Onboarding → first landing | `onboarding/page.tsx:49`, `first-session.ts:154` | A091 test 3 | PASS (**executed**) |
| Cohort gate for the landing and editor | `proxy.ts:90-100`, `launch-profile.ts:70` | A091 test 4; `proxy.test.ts` | PASS (**executed**) |
| Editor → public link | `proposal/actions.ts:59-61` `siteBaseUrl()` | `proposal/actions.test.ts:131` | PASS with note N2 |
| Public proposal resolve and response | `proposal/[token]/page.tsx` | `public-proposal.test.ts`, `response-*.test.*` | PASS (read). Snapshot only, no draft table read; expiry and revocation passed to the client; there is no accept or decline control |

## 3. Defects

### D1 — Apply form reports "recorded" while nothing is recorded (Medium; public, launch-facing)

- `src/components/marketing/founding-cohort-apply-form.tsx:59-65`, on `status === "success"`:
  "Thank you — we have recorded your interest for the founding cohort review. We will be in touch…".
- `src/lib/founding-cohort/submission-adapter.ts:3-9,11` is an intentional no-op: it persists and
  emails nothing, and in test mode returns before doing anything.
- `src/app/apply/actions.ts:39-41` returns `{ status: "success" }` whenever the adapter does not throw,
  and a no-op never throws. So every valid submission shows the success text.
- The same page also prints internal wording to visitors: `founding-cohort-apply-page.tsx:40-43`
  ("TODO(A109): … Rob will choose the destination (database, CRM, or inbox) before go-live."). Both
  `apply-route.test.tsx:27` and `:52` assert that the TODO text is present, so the test locks it in.
- Why it matters: the register is honest ("Needs Rob: where applications go; nothing activated"), but
  an applicant reads the success paragraph, not the register. They are told they were recorded and
  will be contacted. They will not be. This is the same class of problem the repo already fixed
  elsewhere ("Remove false 'recently visited' promise", change log line 277).
- Scope: the route is outside `/dashboard` and `/admin`, so `proxy.ts:90,103` does not gate it. It is
  reachable by anyone whenever this source is deployed. Whether `5f8a246` is deployed was not checked.

### D2 — Adapter writes applicant name and company to runtime logs (Low–Medium, privacy)

- `submission-adapter.ts:14-24` calls `console.info` with `name`, `company`, `trade`, `teamSize` and
  the email domain whenever `NODE_ENV !== "test"`. On the host that goes to retained runtime logs.
- The file comment says the adapter "must not write to a database, send email, or call third-party
  services". A log line is an undeclared third storage path, and `submission-adapter.test.ts` only
  checks the test-mode no-log branch, so the production branch is untested.
- Not checked: whether the privacy page describes log retention of applications.

### D3 — `??` against `||` drops the sign-up email redirect on a blank site URL (Low)

- `platform-signup-action.ts:92` uses `process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_TRUSTED_APP_URL`.
  Every other site uses `||`: `proposal/actions.ts:60`, `proposal/[token]/page.tsx:56`,
  `onboarding/actions.ts:74`, `auth/signout/route.ts:8`.
- Executed: `"" ?? "DEFAULT"` is `""`, and `new URL("")` throws `TypeError: Invalid URL`.
  `trustedEmailRedirect` catches and returns `undefined`, so a blank (not unset) variable sends the
  confirmation email without the `/auth/callback?next=/auth/platform-terms` redirect. The user then
  lands wherever the provider's own Site URL points, and never reaches terms completion.
- Not covered: the tests set `"not a url"`, localhost, userinfo and ftp (`platform-signup-error-paths.test.ts:180-199`,
  `platform-signup-action-boundaries.test.ts:110-118`), but never `""`. It needs a misconfiguration to
  trigger, so it is Low.

### D4 — The A091 "marketing-to-proposal" test does not cover the marketing CTA or the public proposal (coverage gap)

- `a091-marketing-to-proposal-boundary.test.ts` test 5 asserts `<h1`, `href="/login"` and the sign-in
  constant. It never asserts `href="/apply"`, the page that D1 sits on, although the same suite's
  neighbour `apply-route.test.tsx` shows the CTA exists.
- It never imports `proposal/[token]/page.tsx` or `resolve_proposal_publication`, so the "proposal"
  end of the register wording ("full marketing-to-proposal flow") is covered only by other files.
- Test 3 checks that the readiness `page.tsx` exists, but not that the cohort gate admits that path.
  Section 4 shows it does, so this is a missing guard against a later edit, not a current fault.

## 4. Executed evidence (the only code that ran)

Command: `node --input-type=module -e …` using Node v26.12.1 native type stripping to import
`src/lib/platform-terms-completion.ts`, `launch-profile.ts` and `first-session.ts` directly. They have
no dependencies, so no install was needed; nothing was written. Output, abridged:

| Call | Result |
| --- | --- |
| `platformTermsConfirmationRedirect("https://x.test")` | `https://x.test/auth/callback?next=%2Fauth%2Fplatform-terms` |
| `platformTermsCompletionReturn` on `?next=%2Fauth%2Fplatform-terms` | `/auth/platform-terms` |
| same on trailing slash, added query, wrong case, empty, `null` | `null` for each |
| same on `?next=evil&next=…platform-terms` / reverse order | `null` / `/auth/platform-terms` (first value wins; only the constant is ever returned) |
| `isDashboardPathAllowed`, cohort: `/dashboard/settings/profile/readiness`, `/dashboard/projects/proposal`, `…/proposal/`, `/dashboard` | `true` for all four |
| cohort: `…/proposalx`, `…/newfoo`, `/dashboard/home`, `/dashboard/projects/billing`, `/dashboard/` | `false` for all five |
| `getLaunchProfile(undefined / "" / "FULL" / "full")` | `cohort / cohort / cohort / full` |
| `resolvePostSetupPath(null,"/dashboard",true)` and `(0,"/dashboard",false)` | `/dashboard/settings/profile/readiness` both |
| `resolvePostSetupPath(3,"/dashboard",false)` | `/dashboard` |
| `"" ?? "DEFAULT"` against `"" \|\| "DEFAULT"`; `new URL("")` | `""` against `"DEFAULT"`; `TypeError: Invalid URL` |

These match what A091 tests 2–4 assert. Node printed a harmless `MODULE_TYPELESS_PACKAGE_JSON` warning.

## 5. Notes (not defects)

- **N1.** `isDashboardPathAllowed("/dashboard/projects/proposal/../billing","cohort")` is `true`: the pure
  function compares the raw string. `proxy.ts:96` passes `request.nextUrl.pathname`, which URL parsing
  has already normalised, so this was reasoned, **not** executed through `NextRequest` (needs
  `node_modules`). Server actions are separately held by `requireLaunchCapability`. Worth a one-line
  test only.
- **N2.** The fallback host `https://constructa-nu.vercel.app` is hard-coded in 8 places (`email.ts:59`,
  `platform-signup-action.ts:85`, `proposal/actions.ts:60`, `proposal/[token]/page.tsx:56`,
  `onboarding/actions.ts:74`, `auth/signout/route.ts:8`, `api/cron/contract-alerts/route.ts:369`,
  `dashboard/projects/contract-admin/actions.ts:596`). It is correct only if that
  is still the production host and `NEXT_PUBLIC_SITE_URL` is set. Deployed settings were not seen.
- **N3.** `proposal/[token]/page.tsx:57-62` starts the contractor "viewed" email without awaiting it.
  Whether a serverless host finishes that call after the response was **not** checked.
- **N4.** `proposal/[token]/page.tsx:48` computes `isExpired` with `<=`. A snapshot with a missing or
  unparseable `expires_at` gives `NaN <= now`, which is `false`, so it would read as not expired. The
  snapshot is built by the database function, so this was not tested.

## 6. Recommended fixes (proposed, not applied)

1. **D1 — owner decision, then a code change.** Until Rob picks the destination, the form must not claim
   a record. Smallest honest change: reword the success text to say what actually happened, or do not
   render the submit control and show only "Applications open 7 December 2026". Remove the internal
   TODO sentence from the public page. Update `apply-route.test.tsx:27,52`, which currently require it.
   Not applied: the destination is Rob's decision (register A109), and the tests are the owner's.
2. **D2.** Drop `name` and `company` from the `console.info` payload (keep lengths and the domain), or
   remove the log. Add a test with `NODE_ENV` unset that asserts the logged object has no `name`.
3. **D3.** Change line 92 to `process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_TRUSTED_APP_URL`, and add a
   test next to `platform-signup-action-boundaries.test.ts:101` that stubs `""` and expects the
   `emailRedirectTo` value.
4. **D4.** In the A091 test add `expect(landing).toContain('href="/apply"')` and
   `expect(isDashboardPathAllowed(PROPOSAL_READINESS_PATH,"cohort")).toBe(true)`. If the register
   keeps the words "marketing-to-proposal", reference the public-proposal tests by name.

## 7. Not run — explicit

| Item | Why |
| --- | --- |
| Vitest, including the A091 test, `proxy.test.ts`, `apply-route.test.tsx` and callback tests | `node_modules` is absent (`ls node_modules` fails) and installs are not allowed. **Their current pass state on `5f8a246` is unknown.** |
| `npm run build`, `typecheck`, `lint`, `verify-build-supabase-target` | Builds are not allowed (three slots occupied). Node here is v26.12.1; the project pins 24.19.x |
| Playwright / Edge loopback journey, any hosted or Preview request | Hosted activity not allowed |
| SQL boundary suites, migration replay, `resolve_proposal_publication` behaviour | SQL not allowed |
| Real email, real signup, deployed signup state, deployment status of `5f8a246` | No credentials or hosted access used |
| Items N1 through N4 beyond reasoning | Need the dependency tree or a hosted run |

Not reviewed: product code in the range `d22562e..5f8a246` other than the files named above. In
particular the #113 palette change, #114 cover change and #116 case-study photo seam were not read.

## Codex verification

The five A091 boundary tests passed on Node 24 at 5f8a246. GitHub CI and the
secret scan succeeded, and production deployment 7758644243 succeeded for the
same SHA. These checks leave the real hosted signup, consent and proposal
journey unverified. No local build was started because all three build slots
were occupied.
