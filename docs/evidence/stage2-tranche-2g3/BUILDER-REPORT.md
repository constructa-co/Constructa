# Stage 2G.3.1 builder report: guided company interview

- Issue: https://github.com/constructa-co/Constructa/issues/90 (slice 2G.3, first bounded delivery)
- Base: `f2ae90207ede4fe0478d154bf3403b1b6df534b2` (accepted G.2 candidate)
- Branch: `claude/stage2g3-guided-interview`, own worktree `constructa-stage2g3-guided-interview`
- Implementation commit: `5bec5658afc2a8d8e3e6b6569a6a02433ca9b13e`. This report is the commit after it.
- Patch, both commits from the base: `/Users/robertsmith/.codex/worktrees/stage2g-onboarding/stage2g3-guided-interview.patch`
- Local only: not pushed, no PR, nothing deployed, no hosted database or migration, no provider call.

**This is an intermediate fixture candidate.** It delivers the interview, the
answers, a draft built by fixed rules and the approval path. It does not
deliver AI wording, and it is not a statement that the feature should launch
without it. The G.2 worktree (`f2ae902`) and the CI repair worktree
(`54970d7`) were not touched. The CI repair is not in this branch.

## What the contractor gets

From Profile, "Answer a few questions to write your introduction" opens
`/dashboard/settings/profile/interview`.

1. Eight short questions, one per screen, each optional, with Skip, Back
   and "Save and continue". Leaving and returning resumes at the first
   question not yet answered or skipped.
2. After the last question, a draft introduction of up to two paragraphs,
   beside what is saved now, with a line saying which questions it was
   built from.
3. They can change the wording. Saving it writes `capability_statement`,
   which is the first block of "About {company}" on proposals. Nothing is
   written before they press save.
4. Up to three details from their answers are offered separately, each with
   its own save button: years trading, memberships and qualifications,
   insurance.
5. "Enter details by hand instead" is on every screen. Nothing here blocks a
   first project.

| # | Question | Feeds |
| --- | --- | --- |
| 1 | What work does your business do most? | Introduction |
| 2 | What year did this business start trading? | Introduction; offers `years_trading` |
| 3 | How long have you personally been doing this kind of work? | Introduction only |
| 4 | Where do you work? | Introduction |
| 5 | Who do you usually work for? | Introduction |
| 6 | What do your customers notice about how you work? | Introduction, second paragraph |
| 7 | Trade memberships or qualifications you hold | Offers `accreditations`, word for word |
| 8 | Insurance you want clients to know about | Offers `insurance_details`, word for word |

## The decisions given, and where each is implemented

| Decision | Implementation |
| --- | --- |
| `capability_statement` for the two-paragraph introduction, no snapshot change | `template.ts`; `company_narrative_approve`. `proposal-publication.ts` and `proposal-document.ts` are untouched |
| Business start asked apart from career experience; career never becomes `years_trading` | Questions 2 and 3 in `questions.ts`. `buildFacts` reads only `business_started`, as a four-digit year. `template.test.ts` "keeps how long the business has traded apart…" |
| Memberships and qualifications apart from insurance; individually approved | Questions 7 and 8; two separate facts; one approval call per fact |
| Two tables, three narrow service-only functions | Migration `20261008090000_company_interview.sql`. See "One addition" below |
| Server-owned provenance and versions | `generator`, `generator_version`, `question_set_version`, `based_on`, `answers_fingerprint` are written only by the service-role function |
| No AI attempts table yet | None added |
| Deterministic draft now | `template.ts`. The service imports no model code |
| AI path built, canned replies only, structurally unavailable | `ai-draft.ts` takes its generator as a required argument, reads no environment variable, and is imported by nothing. `ai-draft.test.ts` fails if that changes |
| No env toggle for unbudgeted calls | There is no toggle |
| Read saved profile and owner answers only | `service.ts` reads three tables. Tests and the browser spec assert the set |
| Tripwires are not fact checking | Stated in `guard.ts`, in the test "is a tripwire, not a fact check", and here |
| Plain-text length bound on owner edits; labelled as contractor assertions | `plainTextProblem`, repeated in SQL. `approved_edited` on the record; the screen says "saved as your own words" |
| Server recomputes fingerprint and revision under atomic approval | `company_interview_fingerprint` is taken inside `save_draft` and compared inside `approve`. Neither is accepted from a caller |
| Narrow hardening of inherited profile AI | `settings/profile/actions.ts`, `profile-form.tsx`. See below |

**One addition beyond "three functions".** `company_interview_fingerprint` is
a fourth SQL function. It is a helper called by the other two so the
fingerprint is computed in one place; it writes nothing and is executable
only by the service role.

## Design

### Boundary

Same as G.2. Browser roles can only read their own answers and drafts.
`company_interview_save_answer`, `company_narrative_save_draft` and
`company_narrative_approve` are executable by the service role alone, and
are called after `requireLaunchCapability("company-profile")` and
`requireAuth()`, with the contractor id from the verified session.

### Answers

One row per question with a `revision`. A save must name the revision it
replaces (0 for a first answer). A save from a tab that has not seen the
latest answer is refused and returns what is saved.

### Draft

`buildIntroduction` puts each answer into a fixed sentence frame, for
example "{Company} specialises in {answer}." and "The business has been
trading since {year}." Unanswered and skipped questions are left out. The
same answers always give the same text. Memberships and insurance are never
narrated.

### Approval

One transaction per approval. It is refused when:

- the draft is not the contractor's (`not-found`);
- the answers changed after the draft was built (`stale-answers`). The
  service then rebuilds from the current answers and shows that;
- the saved profile value is not the one the contractor was shown
  (`conflict`). Nothing is written; the newer value is shown;
- the introduction text is empty, over 2,000 characters, or not plain.

A fact's value is taken from the saved draft, never from the request. If the
approval record cannot be written, the profile change rolls back with it.

### Manual edits and other sources, kept apart

| Statement | Where it lives | Who can write it |
| --- | --- | --- |
| "I said this" (an answer) | `company_interview_answers` | Server, from the contractor's input |
| "The server assembled this from those answers" | `company_narrative_drafts`, `generator = 'template'` | Server only |
| "I approved this; I did / did not change the wording" | Same row, `approved_edited` | Server only |
| "My website says this" | G.2 `company_import_drafts` | Not read here at all |
| What I typed into the Profile form | `profiles` | The contractor, as before; carries no provenance |

Nothing here is described as verified. An approved introduction is the
contractor's statement about their own business.

### AI wording: built, not wired

`generateStructured` (added to `src/lib/ai.ts`; existing functions and
callers are unchanged) separates the system rules from the user data, makes
one attempt with the SDK's retries off, sets a time limit and an output cap,
requires JSON matching a schema, and returns model and token counts.

`ai-draft.ts` builds the messages, calls a generator it is handed, and runs
the reply through the tripwires in `guard.ts`. Any reason drops the reply.
It was run only against canned replies.

What must exist before it is connected (G.3.2): an atomic per-contractor
usage budget reserved before each call, as G.2 has for website reads; a
recorded evaluation run; and an explicit decision to connect it.

### Inherited profile "rewrite with AI"

| Before | Now |
| --- | --- |
| No `requireAuth` in the action | `requireAuth` first, before the text is examined |
| No input cap | 2,000 characters; longer text reaches no provider |
| `generateText`, 0.7, no limits | `generateStructured`: one call, 20 s, 700 output tokens |
| Text spliced into the prompt in quotes | Rules in system; text as JSON in user |
| "more compelling… what makes them specialists" | "Keep every fact exactly… do not add…" |
| Reply written straight into the field | Reply shown as a suggestion with "Use this wording" / "Keep my own" |
| No check of the reply | Dropped if a tripwire fires |

**Not done, and not claimed:** there is no per-contractor usage budget. A
signed-in contractor can still press the button without limit. No other AI
caller in the codebase was changed.

## Files

| File | Purpose |
| --- | --- |
| `src/lib/company-interview/questions.ts` | Question set, progression, answer cleaning |
| `src/lib/company-interview/template.ts` | Fixed-rule introduction and offered facts |
| `src/lib/company-interview/guard.ts` | Added-claim tripwires; plain-text check |
| `src/lib/company-interview/service.ts` | Load, save answer, build draft, approve |
| `src/lib/company-interview/ai-draft.ts` | AI drafting, unwired |
| `src/lib/ai.ts` | `generateStructured` added |
| `src/app/dashboard/settings/profile/interview/` | Page, screen, server actions |
| `src/app/dashboard/settings/profile/{actions.ts,profile-form.tsx,page.tsx}` | Rewrite hardening, pending suggestion panel, entry link |
| `supabase/migrations/20261008090000_company_interview.sql` | Tables, RLS, grants, functions |
| `scripts/test-company-interview-sql.sh`, `package.json`, `.github/workflows/ci.yml` | SQL test, wired in |
| `e2e/import-fixture/app/interview/`, `e2e/import-fixture/interview.fixture.ts` | Fixture harness and browser spec |
| `*.test.ts`, `src/lib/company-interview/__fixtures__/fake-db.ts` | 118 unit tests and their fake database |

Not touched: `src/app/(marketing)/`, proposal publication and document code,
`launch-profile.ts`, `proxy.ts`, readiness, the G.2 import code, any existing
migration.

## Test results

All on commit `5bec565`, 8 October 2026, on this machine.

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | Pass |
| `npx vitest run` | 66 files; 1063 passed, 4 skipped, 0 failed (945 at base) |
| New and changed tests alone | 9 files, 118 passed |
| `npx eslint .` | 0 errors |
| `npx next build` (no harness present) | Pass |
| `npm run test:company-interview-sql` | Pass, throwaway local PostgreSQL 14 |
| `npm run test:company-import-sql` (G.2, unchanged) | Pass |
| `npm run e2e:import-fixture` | 9 passed: interview and both import scenarios, on 3 projects |

**What these do not prove.** Nothing ran against a hosted database. The
migration was replayed alone on a local Postgres 14, not as part of the full
chain and not on the pinned Supabase image. The hosted Phase 1 E2E was not
run. No real provider was called.

| Requirement | Proof |
| --- | --- |
| Deterministic progress, skip, back, resume | `questions.test.ts`; browser spec (skip, back twice, reload at question 7) |
| Answer revision | SQL: stale tab refused; six simultaneous first saves give one. `service.test.ts` |
| Cross-tenant | SQL: other contractor reads nothing, cannot approve. `service.test.ts` "tenant isolation" |
| Service-RPC grants, direct browser writes denied | SQL: insert, update and delete on both tables, and all four functions, denied to `authenticated` and `anon` |
| Draft preview, no profile mutation | `service.test.ts`; browser spec reads the profile back after the draft |
| Changed answers invalidate approval | SQL `stale-answers` for introduction and fact; `service.test.ts`; browser spec |
| Client cannot assert freshness | `service.test.ts` "the staleness decision is the database's" and "cannot be told the profile is unchanged" |
| Profile stale conflict | SQL, `service.test.ts`, browser spec |
| Record failure rolls back | SQL with a failing trigger; `service.test.ts`; browser spec |
| Owner edit attribution | SQL `approved_edited`; `service.test.ts`; browser spec |
| Credentials verbatim, not invented | SQL: text sent with the call is ignored; `template.test.ts`; `service.test.ts` |
| Business versus career | `template.test.ts`; `ai-draft.test.ts`; browser spec |
| Unapproved import excluded | `service.test.ts` and browser spec assert which tables are read; SQL asserts no function names the import table |
| Only approved text in a publication | `service.test.ts` with the real `buildProposalPublicationSnapshot` |
| Late answer on resume | `service.test.ts` "resume"; browser spec |
| Profile rewrite: unauthenticated, oversized, injection, pending | `settings/profile/actions.test.ts` |
| AI path: role separation, bounds, single attempt, canned rejections, not wired | `ai.structured.test.ts`, `ai-draft.test.ts` |

Browser run: layout and axe WCAG 2.2 A/AA checks at eight checkpoints, zero
findings on desktop 1280x800, phone 390x844 (touch) and desktop
keyboard-only. The keyboard run reached 29 controls, all with visible focus.
Results are in `results-*.json`. As in G.2 the harness runs the real screen,
server actions and service over an in-memory database; it does not exercise
sign-in, the dashboard shell, the real page loader or real row level
security.

## Screenshots

Each at `-1280x800` and `-390x844`. All data is synthetic.

| File | Shows |
| --- | --- |
| `01-interview-first-question` | Question 1 of 8 |
| `02-interview-business-started` | The year question, with its "not how long you have been in the trade" help |
| `03-interview-save-failed` | A failed save: words kept, "Try again" |
| `04-interview-review` | Draft beside "Nothing saved", built-from line |
| `05-interview-review-facts` | Facts offered individually |
| `06-interview-answers-changed` | An answer changed elsewhere: nothing saved, draft rebuilt |
| `07-interview-profile-changed` | Profile edited elsewhere: not overwritten |
| `08-interview-approved` | Edited introduction saved as the contractor's words; one fact saved |

## Blockers

1. **The migration must be applied to the disposable project** before any
   hosted run. Until then the page shows "We couldn't load your answers"
   with the manual-entry link, because the read fails closed.
2. **The server needs `SUPABASE_SERVICE_ROLE_KEY`**, as G.2 does.
3. **No hosted E2E spec** was added, for reason 1.

## Risks

- **Template wording is plain.** Sentences are frames around free text.
  "We mainly work for {answer}" reads oddly if the answer is itself a
  sentence. The contractor sees and can edit it before saving. This is the
  gap AI wording is meant to close.
- **Lower-casing the first word** of an answer mid-sentence will wrongly
  lower-case a proper noun that starts a `work`, `customers`, `career` or
  `strengths` answer. Acronyms and mixed-case words are left alone.
- **Years trading is a number that ages.** It is the count at approval time.
- **Tripwire lexicon.** A fixed word list flags some harmless words
  ("approved", "best") and misses claims phrased without them. It guards
  only the unwired AI path and the profile rewrite suggestions.
- **Profile rewrite has no usage budget** (stated above).
- **No entry from the readiness page.** Its links are asserted by the
  hosted activation spec, which was left unchanged. Entry is from Profile.
- **The fake database mirrors the SQL by hand.** The SQL test is the
  authority.
- **`maxLength=4` on the year field** means an over-long value can only
  arrive by paste; the server refuses it either way.
- **Answers are capped at 600 characters** and stripped of angle brackets
  and control characters on save.

## Deferred

AI wording live, usage budget and evaluation (G.3.2); disciplines and
case-study interviews (G.4); a separate "why us" slot and any snapshot
change (G.6); hosted migration and hosted E2E; readiness-page entry point.
