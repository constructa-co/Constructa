# Claude batch 3 handoff: A093 prep, A091/A085 signup and journey, drift check (8 Nov 2026)

Branch `claude/offline-evidence-20261108-1020`. Source and offline reading only. Nothing here is human,
hosted, preview, QA-database, real-email or paid-AI acceptance. No SQL, migration, env or config read, no
register or dashboard edit, no provider call. Adds to batch 1 and 2 notes; replaces neither.

## 0. Run status (read this first)

| Item | State |
|---|---|
| Release-candidate (RC) diff review (scope 1) | **NOT DONE against RC.** `origin/cursor/rc-integration-20261108` is not in this clone (`git rev-parse` fails; `git branch -r` lists no such ref). `git fetch origin` answered "This command requires approval" and the session is non-interactive, so I could not get it. I did not use another route (no `gh`, no API, no other worktree). Section 1 is therefore a checklist built from this branch and the register text, **not a review of the RC diff**. |
| Drift check against RC (scope 3) | **NOT DONE against RC**, same reason. What I could do is in section 4 (compared with the local `origin/main`, which is also unfetched and may be stale). |
| Tests | **NOT RUN.** No `node_modules` in this worktree and the brief forbids vitest/npm here. New tests are statically traced only (section 2.4). |
| Inbox ACK | **NOT appended.** `echo ... >> /Users/robertsmith/cos-inbox/constructa.md` was refused ("needs approval", path outside the worktree). I did not route around it. Line I would have written: `ACK Claude Code (Sonnet 5.5) branch claude/offline-evidence-20261108-1020: batch3 A093 RC checklist, A091/A085 signup+journey tests (unrun), drift check; static only`. Result line is in section 7 for someone with access to paste. |
| Disk | 17 GiB free at start (floor 16). Nothing large written. |

## 1. A093 independent acceptance checklist (NOT derived from the RC diff)

Register text for A093 (8 Nov snapshot): "Complete independent exact-candidate review and release readiness
before promoting a replacement." Status Blocked. "Full preservation, Auth/email, persistence, provider
controls and current end-to-end acceptance remain distinct from visual approvals."

Everything below comes from files I read on this branch in batches 1 to 3. Each line needs checking against
the RC diff by someone who can fetch it. A line that is true here may already be fixed or changed there.

### 1.1 How to produce the real review (read-only, needs a fetch)

```
git fetch origin cursor/rc-integration-20261108        # needs approval; Rob/coordinator
git diff --stat origin/main...origin/cursor/rc-integration-20261108
git diff origin/main...origin/cursor/rc-integration-20261108 -- supabase/migrations
git diff origin/main...origin/cursor/rc-integration-20261108 -- src/proxy.ts next.config.mjs .github AGENTS.md
git diff origin/main...origin/cursor/rc-integration-20261108 -- src/lib/platform-signup-policy.ts src/lib/platform-terms.ts
git log --oneline origin/main..origin/cursor/rc-integration-20261108 | wc -l
```
No checkout, no write to that branch.

### 1.2 Risks seen on this branch (verify each on RC)

| # | Risk | Where | Why it matters for release |
|---|---|---|---|
| R1 | Many migrations are source-only. The latest migrations present on this branch include `20261024122500_platform_terms_acceptance`, `20261028120000_case_library_photos`, `20261028233000_job_assistant_usage_ledger`, `20261029103000_project_working_pattern_v2`, `20261030220000_programme_working_pattern_execute_grant`. I could not tell which are applied anywhere. | `supabase/migrations/` | A source change that needs a table or grant will fail at runtime if the migration is not applied first. Order and apply plan is Rob's. |
| R2 | Platform terms: `UNIQUE (user_id, terms_document)` blocks a second revision (`23505`, reported as `already-recorded` with the submitted revision). | migration `20261024122500`, `platform-terms-acceptance.ts` | Harmless while there is one revision; breaks the first wording change. Batch 2 section 3.3. |
| R3 | Terms page is four short paragraphs ("Last updated: March 2026"), no approved legal wording, no AI-processing or data-aggregation clause. | `src/app/terms-of-service/page.tsx` | Release with sign-up open and AI features near on needs Rob/legal wording first. |
| R4 | Photo URL rules differ between TS and SQL on non-ASCII edge whitespace (TS accepts, SQL refuses). | `case-library/photos.ts`, migration `20261028120000` | Batch 2 section 4. Narrow, but a TS-accepts/SQL-refuses mismatch is the unsafe direction. |
| R5 | Confirmation redirect depends on two env values and drops silently if **either** is unparseable (new, section 2.2). | `requireTrustedAppUrl` in `src/lib/email.ts` | Confirmation email falls back to the provider default link; user may land somewhere that skips terms completion. |
| R6 | Planning assistant gets no brief text or trades; nothing carries payment milestones or procurement; client name sent for planning but withheld for Brief. | batch 2 section 2.2 | Product decision and privacy wording, not a crash. |
| R7 | Sign-up is enabled in **source** (`isPlatformSignupDisabled()` returns `false`) while the header comment in the action says "hard-coded false". Register and AGENTS say preview sign-up OFF/HOLD. | `platform-signup-policy.ts`, `platform-signup-action.ts` | The comment contradicts the code. Deployed state is a settings matter I did not read. Rob/Cursor to confirm intent. |
| R8 | Marketing CTAs go to bare `/login`, which opens in sign-in mode; sign-up is a "Get started" toggle on that page. No deep link. | `Header.tsx`, `phase-one.tsx`, `login/page.tsx:46` | A visitor who clicked "Sign up" lands on Sign in. Product choice; relevant to A085. |

### 1.3 Missing tests (not written because they need a database or a browser I may not use)

1. Real Postgres run of the platform-terms migration constraints (CHECKs, grants, uniqueness), and of the
   photo-slot function with shared TS/SQL vectors (batch 2 section 4.3 item 4).
2. A test that a user with an existing `platform-tos-2026-03` row can accept a later revision (fails today by design; the recorded-gap case in `platform-terms-revision-shape.test.ts` flips when fixed).
3. Hosted or preview run of sign-up, real confirmation email, callback, terms completion, first dashboard load.
4. Continuous (not joined-mock) journey from sign-up to a published proposal, including durable reload.
5. `requireTrustedAppUrl` behaviour for an unparseable `NEXT_PUBLIC_APP_URL` if R5 is judged a bug.

### 1.4 Guard and environment assumptions to confirm on RC

- `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_APP_URL` are set to the real origin, or unset (default is `https://constructa-nu.vercel.app`). A wrong valid value is trusted as the confirmation origin.
- Every `APPROVED_GENERATION` setting stays off in production and QA until a paid, owner-approved test (batch 2 section 2.3).
- `e2e/support/platform-consent-guard.test.ts` exists and the process network/write guards named in `e2e/local-phase1/README.md` still apply to the RC run.
- Preview HOLD / sign-up OFF are deployed settings (AGENTS.md, register). I did not read or verify them.

### 1.5 Needs Rob or human evidence (cannot be closed by source reading)

1. Approved platform terms wording and whether AI processing / benchmark aggregation is in the same document.
2. Which migrations are applied where, and the apply order.
3. Decision on the A038 alignment (ASCII-trim the TS validators; yes/no on the SQL credentials line).
4. Real-email hosted sign-up run, and a human pass through the whole journey on the exact candidate commit.
5. Decision on R7 (comment versus code) and R8 (sign-up deep link).
6. Any paid AI check, and turning any assistant on.

## 2. A091 sign-up: new offline error-path tests and findings

### 2.1 What was added

`src/lib/platform-signup-error-paths.test.ts` (new). Mocks the policy, the server client factory and the
consent recorder; no network, no database, no provider. Only cases not already in
`platform-signup-action.test.ts`, `platform-signup-action-boundaries.test.ts` or
`platform-signup-recorder-seam.test.ts`:

| Block | Cases |
|---|---|
| Check order after the first three | Missing acceptance reported before a bad revision; revision variants refused without opening a client (`Platform-TOS-2026-03`, leading/trailing space, trailing newline, array, number, object); `null`/`undefined` input is `invalid-input`, not a throw; non-string passwords (number, array, null, undefined, object) refused. |
| Provider result shapes | `data: null` is `signup-failed`; provider error beats a returned user+session and records no consent; `createClient` rejection is `signup-failed` with no `signUp` call; confirmation outcome is exactly `{ok, outcome}` with no user id; recorder called once with only `{acceptance: true, revision}` and its user id is the one returned. |
| Log redaction | Five failure paths (provider error, `signUp` throw, client build throw, recorder refusal, recorder throw) log five lines and none contains the email, password or provider text; recorder refusal logs only the typed code. |
| Confirmation redirect trust | Local `http://localhost:3000` site URL used as base; credentials in the site URL, a non-http scheme, and an unparseable `NEXT_PUBLIC_APP_URL` each remove the redirect while sign-up still proceeds; default origin used when nothing is configured. |

### 2.2 Finding R5 (source reading, pinned by a labelled test)

`requireTrustedAppUrl` builds its allowed-origin set by calling `new URL()` on `NEXT_PUBLIC_SITE_URL` **and**
`NEXT_PUBLIC_APP_URL` before it compares anything. An unparseable value in either makes it throw, and the
sign-up action catches that and omits `emailRedirectTo`. So a typo in `NEXT_PUBLIC_APP_URL` silently disables
the redirect to `/auth/callback?next=/auth/platform-terms` even when the site URL is right. The case is named
"RECORDED OBSERVATION"; if the helper is made tolerant, update that case. No source changed.

### 2.3 Other facts checked in source while doing this

- Sign-up policy returns `false` (enabled) in source. Header comment in the action says the opposite (R7).
- The login page starts in sign-in mode (`useState<Mode>("signin")`), so a marketing "Sign up" link to
  `/login` does not open the sign-up form (R8).
- `src/proxy.ts` sends an authenticated user with no `company_name` from `/dashboard*` to `/onboarding`
  (lines 107 to 117, read in part).

### 2.4 Static trace (not a run)

Traced each case against `platformSignupAction`, `trustedEmailRedirect`, `requireTrustedAppUrl`,
`isRecognizedPlatformTermsRevision`: the empty-email path for `null` input; `error || !data?.user` ordering;
the five `console.error` calls in the redaction test (one per failure path); trailing-slash stripping after
`url.toString()`. Env is saved, cleared and restored by hand, not with `vi.stubEnv`, because
`NEXT_PUBLIC_APP_URL` may be set in the shell. Residual risks before first run: type-level strictness of the
casts (`null as never`), and whether `vi.restoreAllMocks()` in this vitest version also clears the hoisted
`vi.fn()` mocks (harmless: `beforeEach` re-sets them). A failing first run should be read as a fixture
assumption first.

## 3. A085 marketing-to-proposal journey: what evidence exists, what is missing

A085 in the register: "Deliver a complete improved marketing-to-finished-proposal workflow for the next
review." Status Partial. "Only first marketing increment delivered; onboarding, welcome, estimating,
programme, proposal and genuine assistant actions remain." The map below is from file names and
`e2e/local-phase1/README.md`; none of those specs were run by me.

| Stage | Route / source | Existing offline evidence (not run by me) | Not shown | Gate |
|---|---|---|---|---|
| Marketing entry | `/`, `/features`, `/guides`; CTAs to bare `/login` (`Header.tsx`, `phase-one.tsx`) | Marketing component tests (not listed individually) | Sign-up deep link (R8); measured conversion (`docs/marketing/public-measurement-spec.md` is a spec, measurement disabled) | Rob: CTA target decision |
| Sign-up form and terms | `src/app/login/page.tsx` | `platform-terms.test.tsx`, `platform-terms-accessibility.test.tsx`, `platform-signup-transport.test.tsx`, `signup-outcome-presentation.test.tsx`, `e2e/local-phase1/signup-native.spec.ts`, `signup-outcome-native.spec.ts`, `terms-flow.spec.ts` | Real Auth, real email | Rob: hosted run |
| Sign-up action | `platform-signup-action.ts` | `platform-signup-action.test.ts`, `-boundaries.test.ts`, `-recorder-seam.test.ts`, new `-error-paths.test.ts` | Real consent insert and grants | Rob: migration applied + hosted |
| Confirmation email, callback | `auth/callback/route.ts`, `auth/confirm` | `callback-return.test.ts`, `callback-transport.test.ts`, `callback-native.spec.ts` | A real email and link | Rob/human: real inbox |
| Terms completion | `auth/platform-terms` | `platform-terms-completion.test.ts`, `completion-routing.test.tsx`, `completion-native.spec.ts` | Uniqueness on second revision (R2) | Rob: wording, migration |
| Sign-in and return | `login/page.tsx`, `src/proxy.ts` | `signin-transport.test.tsx`, `signin-native.spec.ts` | Real session cookie, middleware on a served app | Rob: hosted |
| Onboarding / company setup | `/onboarding`, `dashboard/settings/profile/*` | `company-setup.spec.ts`, `company-basics.spec.ts`, `setup-choices.spec.ts`, `profile-sections.spec.ts` | Real save and reload | Rob: hosted |
| First job and Brief | `dashboard/projects/new`, `.../brief` | `first-job.spec.ts`, `brief-price.spec.ts` | Real creation RPC, postcode extraction, durable reload | Rob: hosted |
| Estimating | `.../costs` | `existing-price-native.spec.ts`, `keyboard-price.spec.ts`, `build-up.spec.ts`, `a051-advanced-boq.spec.ts`, `unseeded-journey.spec.ts` | Price persistence (the mock refuses), Advanced/video lazily excluded | Rob: hosted |
| Programme | `.../programme`, `.../schedule` | `programme-mode.spec.ts`, `programme-styled.spec.ts`, `programme-pdf.spec.ts`, `reported-calendar.spec.ts` | Detailed planner excluded; real working-pattern migrations (R1) | Rob: migrations |
| Proposal and PDF | `.../proposal` | `proposal-stage.spec.ts`, `proposal-view.spec.ts`, `reader-styled.spec.ts`, `built-up-proposal.spec.ts` | Approved legal terms (R3); publication | Rob: legal |
| Client response, Won | `proposal/[token]` | frozen preview only; README says acceptance, publication, delivery, Won NOT_RUN | All of it | Rob/human |
| Assistants (Brief, pricing, planning) | `job-assistant-*`, `*-conversation.ts` | batch 2: 16 context cases (unrun) | Any provider call; all features OFF | Rob: paid test approval |
| Joined run | `journey.spec.ts`, `unseeded-journey.spec.ts` | One explicit mock journey, company to local draft PDF | Not Auth, not durable reload, not hosted, not whole company-to-Won | Rob: hosted candidate run |

Reading of the map: the offline layer is dense from company setup to local PDF. The gaps are all at the
boundaries a mock cannot cross: real Auth and email, durable save and reload, applied migrations, approved
wording, publication, client response and Won. None of those can be closed by more offline tests.

## 4. Drift check of earlier unrun tests (scope 3)

**Against RC: not possible** (section 0). Against the local `origin/main` ref (`2d056c3`, the merge base,
unfetched so possibly stale):

- This branch is **255 commits ahead** of that ref (`git rev-list --count origin/main..HEAD`).
- `git diff --stat HEAD origin/main` over the files my tests import shows that these exist **only on this
  branch lineage** (main lacks them): `platform-signup-action.ts`, `platform-signup-policy.ts`,
  `platform-terms.ts`, `platform-terms-acceptance.ts`, `platform-terms-completion.ts`,
  `case-library/photos.ts`, `brief-conversation.ts`, `planning-conversation.ts`, `pricing-review.ts`,
  migrations `20261024122500` and `20261028120000`. `src/lib/email.ts` is identical.
- Consequence: every test from batches 1 to 3 would fail on `main` as it stands, by import error. They are
  only meaningful on a branch that contains this lineage. The RC branch must therefore contain these files.

Dependency table for whoever has the RC ref (diff each source file between this branch and RC; any change
means re-trace the matching test before running it):

| Test file (this branch) | Source it reads |
|---|---|
| `src/lib/case-library/photos-boundary.test.ts` (batch 1) | `src/lib/case-library/photos.ts` |
| `src/lib/platform-signup-action-boundaries.test.ts` (batch 1, extended) | `platform-signup-action.ts`, `platform-terms.ts`, `platform-terms-completion.ts`, `email.ts` (`requireTrustedAppUrl`) |
| `src/lib/platform-signup-error-paths.test.ts` (batch 3) | same four, plus log strings in `platform-signup-action.ts` |
| `src/lib/job-assistant-context-coverage.test.ts` (batch 2) | `brief-conversation.ts`, `planning-conversation.ts`, `pricing-review.ts`, `guided-brief.ts` |
| `src/lib/platform-terms-revision-shape.test.ts` (batch 2) | `platform-terms.ts`, text of migration `20261024122500_platform_terms_acceptance.sql` |

```
for f in src/lib/platform-signup-action.ts src/lib/platform-terms.ts src/lib/platform-terms-completion.ts \
         src/lib/email.ts src/lib/case-library/photos.ts src/lib/brief-conversation.ts \
         src/lib/planning-conversation.ts src/lib/pricing-review.ts src/lib/guided-brief.ts \
         supabase/migrations/20261024122500_platform_terms_acceptance.sql; do
  git diff --stat claude/offline-evidence-20261108-1020 origin/cursor/rc-integration-20261108 -- "$f"
done
```
Then, on the integration branch after `npm ci`, run the five files named in `claude-offline-evidence.md`
plus `src/lib/platform-signup-error-paths.test.ts`, `src/lib/job-assistant-context-coverage.test.ts` and
`src/lib/platform-terms-revision-shape.test.ts`, single worker.

## 5. Files and status

Added: `src/lib/platform-signup-error-paths.test.ts` (A091/A023, unrun) and this note. No product source,
migration, register, dashboard, settings or env touched.

Not done: RC diff review and RC drift check (no ref, fetch refused); any test execution; inbox ACK and result
lines; hosted, human, real-email or database evidence.

## 6. Questions for Rob / coordinator

1. Fetch `cursor/rc-integration-20261108` (or run the section 1.1 commands) so the A093 checklist can become a real review.
2. R7: is source sign-up enabled on purpose? Fix the comment or the policy.
3. R8: should marketing CTAs open sign-up mode?
4. R5: treat an unparseable `NEXT_PUBLIC_APP_URL` as a bug (make the helper tolerant) or document it as config discipline?
5. The batch 2 decisions still open: A038 alignment, A023 uniqueness and wording.

## 7. Result line for the inbox (to be pasted by someone with access)

`RESULT Claude Code (Sonnet 5.5) claude/offline-evidence-20261108-1020: batch3 partial. RC ref not in clone and fetch refused, so A093 is a checklist from this branch (not an RC review) and RC drift check not done (main-only drift noted: branch 255 ahead, tests need this lineage). A091: 1 new offline test file (error paths, redaction, redirect trust), finding R5 (bad NEXT_PUBLIC_APP_URL silently drops confirmation redirect). A085 journey map written. Tests NOT RUN (no node_modules). Inbox appends blocked. See docs/delivery/2026-11-08/claude-batch3-handoff.md.`
