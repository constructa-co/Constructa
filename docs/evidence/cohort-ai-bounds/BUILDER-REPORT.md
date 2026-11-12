# Cohort AI bounds: builder report

Four cohort-reachable AI text paths now go through the usage budget. All four are seeded **disabled**. Nothing was activated, no allowance was changed, no real provider was called, and no hosted project or production data was touched. This is a candidate for independent review, not a release.

Written 8 October 2026 by the primary builder (Claude).

## 1. Pins

| | |
| --- | --- |
| Worktree | `/Users/robertsmith/Documents/GitHub/constructa-cohort-ai-bounds` |
| Branch | `claude/cohort-ai-bounds` (local only; not pushed, no PR) |
| Base | `280fc5bde1ce453401ade2b5849b25746db6dd1d` (candidate B `8c11702` plus the case-study auth guard `fedf9bc`) |
| Implementation commit | `33a40f2` |
| Report commit | the commit that adds this file, directly on top |
| Patch | `/Users/robertsmith/.codex/worktrees/stage2g-onboarding/cohort-ai-bounds.patch` |

Frozen worktrees were checked after the build and are unchanged and clean: `236ac4b` (G.1), `f2ae902` (G.2), `54970d7` (replay bootstrap), `4f54d54` (G.3.1), `fef2854` (source binding), `fc99204` (candidate A), `8c11702` (candidate B).

## 2. What changed

### Database (one new migration, nothing else)

`supabase/migrations/20261011090000_cohort_ai_features.sql`

- Widens the `ai_generation_features_known` check from two names to six.
- Widens the `ai_generation_attempts_fingerprint` check so the four new features, like `profile.rewrite`, carry no source fingerprint. `company.introduction` still requires one.
- Inserts four rows, all `enabled = false`, with reservation ceilings 700 (`brief.suggest`), 2000 (`proposal.wording`), 1000 (`case-studies.enhance`), 900 (`schedule.programme-update`).
- Changes no row in `ai_generation_limits`, no function, no existing attempt, and leaves `company.introduction` off.

### Server

| File | Change |
| --- | --- |
| `src/lib/ai-budget.ts` | Feature union and fixed bounds for six features; `fitsAiBounds()` so a caller can test the encoded request before reserving. The wrapper itself is unchanged. |
| `src/lib/cohort-ai/shared.ts` | Context type, plain refusal messages, context trimming. |
| `src/lib/cohort-ai/brief-suggest.ts` | Request builder, figure check, one budgeted call. |
| `src/lib/cohort-ai/proposal-wording.ts` | Same for one proposal field. |
| `src/lib/cohort-ai/case-study-enhance.ts` | One call for both sections, each judged separately. |
| `src/lib/cohort-ai/case-study-suggestion.ts` | Pure model of a suggestion awaiting a decision. |
| `src/lib/cohort-ai/programme-update.ts` | Bounded facts in, update judged against them. |
| `brief/actions.ts`, `proposal/actions.ts`, `settings/case-studies/actions.ts`, `schedule/actions.ts` | Each action checks the caller first, then calls its feature. None imports a provider helper any more. |
| `src/lib/company-interview/guard.ts` | Comment only (the name tripwire is now used by two more features). |

### Screen

`settings/case-studies/case-studies-client.tsx`: the reply no longer overwrites the form. Each reworded section appears in a panel under its field with **Use this wording** and **Keep my own**. A status line says what happened. The two text areas gained accessible names. No other part of that screen was changed.

`schedule/programme-ai-update.tsx` and the Brief and proposal screens are unchanged. They already showed a returned error and already held suggestions as pending.

### Tests, fixtures, evidence

`scripts/test-cohort-ai-features-sql.sh` (wired into `package.json` and CI), `src/lib/cohort-ai/cohort-ai.test.ts`, `src/lib/cohort-ai/eval/*`, `schedule/actions.test.ts` (new), rewritten AI sections of the brief, proposal and case-study action tests, `e2e/import-fixture/app/case-study/*`, `e2e/import-fixture/case-study.fixture.ts`, an extended harness guard test, and `e2e/support/provider-stubs.mjs`.

## 3. Reconciliation with the brief and the C1–C6 challenge

**C1, the missing fourth path.** `schedule.programme-update` is built as a budgeted feature rather than gated out. The design's claim is now enforced by a test: `cohort-ai.test.ts` lists every file in `src/` that can reach the provider and requires each to be either the budget wrapper or shut out of the cohort by a named gate. A new caller fails the test until it is listed with its reason. The inventory as found:

| Reaches the provider | Why a cohort contractor cannot spend through it unbudgeted |
| --- | --- |
| `lib/ai-budget.ts` | It is the budget. Six features. |
| `brief/actions.ts` (voice, video) | `requireLaunchCapability("video-walkthrough")` precedes each direct call; tested per function. |
| `costs/boq-import-action.ts` | `client-boq-import` |
| `drawings/actions.ts`, `foundations/vision-actions.ts` | `drawing-takeoff` |
| `contracts/actions.ts`, `contract-admin/actions.ts` | `contract-shield` |
| `lessons-learned/actions.ts` | `extended-module-auth-utils` (requires `extended-modules`) |

`src/app/admin/page.tsx` reads the provider's usage endpoint for the owner; it generates nothing and is not in this list.

**C2, the brief judge.** Figures in the reply are compared with everything that was sent: the description, the project name, type and address, and the date. A house number or the year no longer causes a refusal. One extra rule: a contract value is refused when the description contains no figure at all.

**C3, per-section provenance.** One call returns both sections. Each is checked only against its own text plus the shared job name and type, for added figures, claim words and capitalised names. A section of ten characters or fewer is not sent and is never rewritten, whatever the reply contains. Any refusal returns both originals with `suggested: false` and a message. Limit, stated plainly: this catches a figure, claim word or name carried across sections. It does not catch an ordinary fact moved from one section to the other (see `study-moves-fact` in section 5).

**C4, no smuggled policy.** All four features are seeded off. No allowance row is touched. There is no activation migration. The 6 per hour, 20 per day, 12,000 token allowance is unchanged and remains unapproved as a policy for six features.

**C5, encoded bounds.** Each builder produces the JSON that will actually be sent and tests that string against the feature's fixed bounds before any reservation. The contractor's own text is never cut; the JSON is never sliced. Too long is answered with a message that says so and says the text is unchanged. Tested with quotes, backslashes and newlines (each doubles when encoded), emoji and non-Latin text, and with the largest accepted inputs. Project context values are trimmed to a stated length; they are context, not the contractor's wording.

**C6, the pending panel.** The button stays disabled while a request is in flight and a second press is ignored. What is sent is a snapshot taken at the press. On arrival nothing in the form changes. If the contractor has edited a section since pressing, its panel says the suggestion was written from the earlier wording and the button reads **Replace what I have now with this**. The browser fixture types into the field while the request is in flight and proves the typed text survives. The `fedf9bc` order is preserved: authentication first, before any input is read, and before the privileged client, budget or provider.

**Order of checks in all four actions.** Caller's right to act, then input, then the server's own client, then reserve, one call, judge, one finish. Tests assert the order and that a refused caller creates no privileged client.

**One call, exactly-once finish.** The Brief previously used a helper that could make a second paid attempt; it no longer does. A reply that is not usable JSON keeps the usage the provider reported and is not asked for again. A failure with no reply is charged the whole reservation. A good reply is not shown if recording it failed.

**Programme update.** Up to 40 stages, names up to 120 characters, dates written out as words, overall completion computed on the server. The update is refused if it contains a number, a date figure or a capitalised name that was not supplied, or bullets or markup. It is stored only after it passes, beside the stages exactly as they were read. A refusal stores nothing. If the insert fails the action says the update was not saved. The screen's string return, error toast and manual copy are as before.

**Date.** The design document's header says it was written on 9 October 2026. That was wrong; it was written on 8 October 2026, which is also today's date. The migration prefix `20261011090000` is an ordering key that follows the existing `20261010090000`, not a date claim.

**Six features.** `profile.rewrite` (on), `company.introduction` (off), and the four new ones (off). The header of `ai-budget.ts` and the migration both say this is not an application-wide limit.

## 4. Verification actually run

All on this machine, at the implementation commit, with a canned provider.

| Check | Result |
| --- | --- |
| `npx vitest run` | 74 files, 1,294 passed, 4 skipped (the skips are pre-existing) |
| `npx tsc --noEmit` | 0 errors |
| `npx eslint .` | 0 errors, 490 warnings; none in new files |
| `npx next build` | compiled; build output removed afterwards |
| `npm run test:cohort-ai-features-sql` | pass |
| `npm run test:company-narrative-ai-sql`, `test:ai-budget-sql`, `test:company-interview-sql`, `test:company-import-sql` | pass, scripts unmodified |
| `bash scripts/test-replay-bootstrap.sh` | pass |
| `npm run e2e:import-fixture` | 15 of 15 across desktop, phone and keyboard (12 existing, 3 new) |
| `npm run eval:cohort-ai` | 37 cases; report in `EVALUATION.md` |

The first full fixture run had the three new tests fail on one assertion of mine: I had required that no outside host be requested at all, but the application's layout requests two analytics scripts, which the test blocks. The existing specs allow exactly those two blocked hosts; I aligned the new spec with them and re-ran it. Evidence images from earlier stages that the evidence-mode run rewrote were restored from Git.

What the SQL test proves against a throwaway local Postgres: existing attempts, and the bodies of all seven company and AI-budget database functions, are identical after the migration; both allowance rows are untouched; exactly six features exist and four are off; a seventh name is refused; neither browser role can read or write the tables or call the functions; a disabled feature creates no row; all features draw on one allowance per contractor; eight simultaneous sessions for one contractor from different features give one reservation and seven refusals; eight contractors against a global ceiling of three give three and five.

## 5. Canned evaluation: what the checks miss

`EVALUATION.md` has every case. The replies were written by hand. It says nothing about what a real model writes.

Of 20 unfaithful replies, 11 were stopped and 9 reached the contractor:

- Brief: materials and a guarantee added with no figure; a start date supplied where the description had figures; a "10% discount" added, which passed because 10 is the month in the date that was sent. That last one is a direct cost of judging against the date, as C2 requires.
- Proposal wording: insurance and an award added with no figure; an exclusion silently dropped. The proposal judge checks figures only.
- Case study: the meaning reversed; a fact moved between sections with no figure or name.
- Programme: a cause of delay with no name or figure; the right figures attached to the wrong stages.

Of 14 faithful replies, 5 were refused: a number word written as a digit (three features), a sign-off naming "The Site Team", and "all 3 stages".

Both lists are pinned by name in `eval.test.ts`, so a change in either direction fails until it is acknowledged. In every one of these features the contractor reads the reply before it is used; for the programme update, before they copy it to a client.

## 6. Known limits

- **Fixture proof only.** No hosted run, no real model, no real cost figure. Nothing here is evidence of model quality or of spend.
- **The hosted Phase 1 journey will fail at its Brief suggestion step under this code until the feature is enabled in the disposable project.** With `brief.suggest` off, the button answers that the assistant is not switched on. I updated the provider stub for the new role-separated requests but did not add a step that enables features in the disposable project, because that is a hosted change and an activation decision. I could not run the hosted journey.
- **Programme update authorisation is ownership, not editability.** It uses `requireProjectAccess`, as before. A progress update is written on a live job, which is when pre-contract editing is locked, so the editability check used by the Brief and proposal would block its normal use. It does insert a row. If reviewers want a different rule, it is one line.
- **The programme update's phases snapshot** is the saved stages as read at the start of the action. A change saved in another tab during the call is not reflected in that update.
- **The case-study screen outside the panel** is older and was not brought up to the size and accessibility checks. The fixture measures the panel and its status line only, and says so.
- **Case-study suggestions are held in the page.** Leaving the page drops an undecided suggestion. Nothing is saved until the contractor presses the existing save button.
- **Not application-wide.** Features outside the cohort profile remain unbudgeted.

## 7. Decisions held for the owner

1. **Activation.** When to switch each of the four on, and whether in the same deployment window as the code. Until then, deploying this code turns four working AI buttons into "not switched on".
2. **Allowance for six features.** The current 6 / 20 / 12,000 was sized for two. Any number is the owner's, taken with a same-day read of the provider's pricing. I have not proposed or assumed a price.
3. **Proposal wording input limit.** 6,000 characters per press is provisional. Fields can hold and save more; longer text is refused for tidying, with a message.
4. **Case-study approval panel.** It changes live behaviour from overwrite to approve.
5. **Hosted journey.** Whether the test harness may enable `brief.suggest` in the disposable project, or the journey should assert the switched-off message until activation.
6. **Programme update authorisation**, as described above.

## 8. Not done

No push, PR, merge or deploy. No hosted migration. No dependency added. No change to `src/app/(marketing)/`. No other repository was read or touched.
