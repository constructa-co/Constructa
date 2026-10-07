# Stage 2G.1 builder report: guided contractor activation

- Issue: https://github.com/constructa-co/Constructa/issues/90 (slice 2G.1)
- Base: `claude/stage2-tranche-2f-blockers` at `47acd2b161515004f950bf7644c0ed9c73f8dc67`
- Branch: `claude/stage2-tranche-2g1-builder` (local only; not pushed, no PR)
- Built: 7 October 2026

## What changed for the contractor

1. **Setup step 1** asks one question, "What kind of work does your business
   do?", answered in free text. The twelve former trade buttons are now
   optional chips under the answer; tapping one adds it to the text and
   tapping it again takes it out. Nothing has to be picked.
2. **Setup step 2** still requires the business or trading name and leaves
   the contractor's own name optional. It now says clients see the name and
   that it can be changed later. Back still returns to step 1.
3. **After first setup** the contractor lands on a new proposal-readiness
   page instead of New Project. It shows the saved business name and work
   answer, "Create first project", "Build company profile", and five rows
   with a status each: company basics, logo and brand, company story, case
   studies, terms. Nothing on the page is disabled and nothing blocks a
   project.
4. **Contractors who are already set up** are unchanged: `/onboarding`
   still sends them to the normal landing page, and `/onboarding?force=true`
   still lets them change an answer. Profile and Case Studies each gained a
   link back to readiness, so enrichment can be left and resumed.

## Files

| File | Change |
| --- | --- |
| `src/lib/first-session.ts` | `SETUP_TRADES` becomes `SETUP_WORK_SUGGESTIONS`. New `toggleWorkSuggestion`, `hasWorkSuggestion`, `PROPOSAL_READINESS_PATH`, `PROFILE_PATH`, `CASE_STUDIES_PATH`. The work answer is saved on one line. `resolvePostSetupPath` sends a contractor with no projects to readiness |
| `src/lib/company-readiness.ts` (new) | Pure model: profile row in, five status rows out |
| `src/app/onboarding/onboarding-client.tsx` | Step 1 is a text area plus chips. Step 2 copy. Long saved answers wrap instead of overflowing |
| `src/app/dashboard/settings/profile/readiness/page.tsx`, `readiness-client.tsx` (new) | The readiness page |
| `src/app/dashboard/settings/profile/page.tsx`, `case-studies/page.tsx` | Link back to readiness |
| `src/app/dashboard/settings/profile/profile-form.tsx` | The work field is free text instead of a fixed list (see "Found while building") |
| `src/lib/first-session.test.ts`, `src/app/onboarding/actions.test.ts` | Updated for the new rules; new cases |
| `src/lib/company-readiness.test.ts`, `readiness/readiness-client.test.ts` (new) | New unit tests |
| `e2e/activation.spec.ts` (new) | Focused activation run |
| `e2e/phase1-journey.spec.ts` | Setup step uses the free-text answer and passes through readiness |
| `e2e/support/harness.ts` (new) | Network guard, dropped-connection helper and stub helpers moved out of the journey so both specs share them. No behaviour change |
| `e2e/support/recorder.ts`, `backend.ts`, `e2e/README.md` | Optional output folders; read-only `savedSetup`; documentation |

Not touched: `src/app/onboarding/actions.ts`, `page.tsx`, `src/proxy.ts`,
`src/lib/launch-profile.ts`, `src/lib/email.ts`, any migration, and
`src/app/(marketing)/`.

## Rationale

- **Same column, same save path.** The answer still goes to
  `profiles.business_type` through `saveSetupStepAction`, which is unchanged.
  Validation, the 200-character limit, the retryable error, the in-flight
  guard and the conditional claim that makes the welcome email send once are
  all the code that shipped in 2B and 2F. No AI call was added.
- **Chips write into the answer** rather than into a second field, so there
  is one value and no schema change. Chip names are comma-joined, which is
  the format `getProjectTypes` already reads.
- **Readiness sits under `/dashboard/settings/profile/`.** That prefix is
  already allowed in the cohort launch profile, so no route allow-list,
  proxy or navigation change was needed, and the page cannot be reached in
  a profile that lacks Profile. It links only to New Project, Profile and
  Case Studies; a unit test and the E2E run both assert that.
- **Statuses come only from saved data.** Basics is "Started" until an
  address and a phone or email are saved. Logo, story and case studies are
  "Not added yet" until there is content. Terms has no company-level data
  in the schema; every proposal already carries the standard terms and the
  contractor can change them on the review screen, so that row says
  "Included" and offers no setup action.
- **First setup is detected by project count**, as before: no projects goes
  to readiness, otherwise the normal landing page.

## Found while building

- **Profile form would have erased a free-text answer.** Its "Primary Trade"
  field was a `<select>` of ten fixed values. Any other saved value showed
  as blank, and saving the form wrote the blank back. That already affected
  "Something else" answers; with free text as the main path and "Build
  company profile" leading straight to that form, it would have hit most
  new contractors. The field is now a text input with the same limit. Unit
  and E2E assertions cover it.
- **Phone overflow on step 2.** A long work answer in the "Saved:" line
  pushed the form past a 390 px screen. The first phone run failed on it;
  the line now wraps.

## Test results

All run on the final code on 7 October 2026.

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | Pass, no errors |
| `npx vitest run` | 48 files passed; 830 tests passed, 4 skipped, 0 failed |
| `npx eslint .` | 0 errors (warnings are pre-existing) |
| `npx next build` | Pass; `/dashboard/settings/profile/readiness` in the route list |
| Playwright `e2e/activation.spec.ts`, evidence mode | 4 passed: `desktop` (1280×800), `tablet` (768×1024), `phone` (390×844), `desktop-keyboard` (1440×900) |
| Playwright `e2e/phase1-journey.spec.ts`, `desktop` + `phone` | 2 passed (3.2 min) |

The Playwright runs used the production build against the disposable
project `constructa-e2e-pr79` only, with the AI and email providers stubbed,
as the harness enforces. Each run created one synthetic `@example.com`
account there. No production data or credentials were used.

What the activation run asserts, on every project:

- An empty work answer is refused with a plain message.
- A chip adds to the answer and comes back out.
- With the connection dropped, step 1 shows an error, keeps the text, saves
  nothing (read back from the database), and saves on "Try again".
- Back returns to step 1 with the answer kept.
- An empty business name is refused. With the connection dropped, nothing
  is saved and no welcome email is sent; "Try again" lands on readiness.
- Exactly one welcome email, to the contractor, and still exactly one after
  setup is saved a second time through the edit route.
- No AI request is made anywhere in setup or readiness.
- Readiness shows the saved name and work answer, the five statuses
  (started, todo, todo, todo, included), "1 of 5 in place", and links only
  to the three Phase 1 routes.
- "Build company profile" opens Profile with the work answer intact; the
  link back, the Case Studies round trip and a reload all return to the
  same readiness state.
- A set-up contractor opening `/onboarding` goes to `/dashboard`; through
  `/onboarding?force=true` they change the work answer and the database
  holds the new value.
- "Create first project" opens the blank first project.
- Layout (no sideways scroll, nothing past the viewport, controls at least
  44×44 px, nothing under the pinned bar on touch) and an axe WCAG 2.2 A/AA
  scan at six checkpoints: zero findings on all four projects. The keyboard
  run reached 29 controls, all with visible focus.

Machine-readable results: `results-desktop.json`, `results-phone.json`,
`results-tablet.json`, `results-desktop-keyboard.json`.

## Screenshots

Each has a `-1280x800.jpg` and a `-390x844.jpg` version in this folder.

| File | Shows |
| --- | --- |
| `01-setup-work-blank` | Step 1 before anything is typed |
| `02-setup-work-answered` | Free-text answer, chips unused |
| `03-setup-work-save-failed` | Dropped connection: message, answer kept, "Try again" |
| `04-setup-business` | Step 2 with the saved answer shown |
| `05-readiness-after-setup` | Proposal readiness straight after setup |

## Risks

- **Job-type suggestions.** `getProjectTypes` matches `business_type`
  against a fixed list of trade names. A contractor who types their own
  words and uses no chip gets the default job-type list. This is the same
  behaviour "Something else" had; it is now the common case.
- **Profile form "Your Trades" grid is unchanged** and is still a fixed
  list (`preferred_trades`). It is a separate field and was left alone.
- **Readiness rows link to the top of the long Profile form**, not to the
  relevant section. The form has no section anchors today.
- **Readiness is reached again only through the links on Profile and Case
  Studies.** No sidebar or phone-menu entry was added.
- **The 2F evidence folder was not regenerated.** Its `02-setup-business`
  screenshots show the old step 1 result. The journey was re-run in smoke
  mode only, so that folder is exactly as committed in 2F.
- **Legacy Profile and Case Studies pages are not layout- or
  accessibility-checked** by either spec; only navigation to and from them
  is asserted. That was true before this slice.

## Deferred (out of scope for 2G.1)

Website import, AI interview, discipline tags and tables, guided case-study
capture, structured company records, terms setup, and proposal assembly
changes: slices 2G.2 to 2G.6 of issue #90. Also left for later: section
anchors on the Profile form, a navigation entry for readiness, and deriving
job types from a free-text work answer.
