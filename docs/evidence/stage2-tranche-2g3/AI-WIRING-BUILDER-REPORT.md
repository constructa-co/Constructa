# Stage 2G.3.2 candidate B builder report: interview AI wording, wired and disabled

- Issue: https://github.com/constructa-co/Constructa/issues/90
- Base: `fc99204446fd9800b1327c55db35eea5292fbb38` (candidate A, accepted)
- Branch: `claude/stage2g3-ai-wiring`, own worktree `constructa-stage2g3-ai-wiring`
- Implementation commit: `2dc6d097b7950ae996f37ee08f00c7bfb0df03b9`. This report is the commit after it.
- Patch, both commits on the base: `/Users/robertsmith/.codex/worktrees/stage2g-onboarding/stage2g3-ai-wiring.patch`
- Local only. Not pushed. No provider call, hosted database, applied migration, deploy, secret or production change.

## What this is, and is not

**Is:** the code that would let a contractor's interview answers be reworded
by a model, behind the usage budget, with every failure falling back to the
plain draft; a database rule that an AI-worded draft must be tied to a real
budgeted attempt; a canned evaluation harness; a browser fixture.

**Is not:**

- **Not activation.** `company.introduction` is still `enabled = false`.
  There is no activation migration. With it off, the screen shows no
  rewording controls and the flow makes no provider call and no budget call.
  The SQL test asserts the row is still off after all migrations.
- **Not evidence about a model.** Every "reply" in every test, in the
  evaluation and in the browser run was written by us. Nothing here shows
  what a real model writes, how often it is faithful, or what it uses.
- **Not proof of truth.** The checks on a reply are tripwires. The
  evaluation lists three faithful replies they reject and three unfaithful
  ones they let through.
- **Not an owner decision.** One automatic reworded draft on finishing the
  interview is how this candidate is built, provisionally. Whether that is
  the activated behaviour is still the owner's choice.
- **Not app-wide cost protection.** The budget still covers two features.

## Design as built

### Migration `20261010090000_company_narrative_ai_attempt.sql`

A new migration; the three reviewed ones are not edited.

- `company_narrative_drafts.ai_attempt_id`, a unique foreign key to the
  budget's ledger.
- A check: a draft is `'ai'` exactly when it has an attempt and a model; a
  `'template'` draft has neither.
- **The save function is replaced, not overloaded.** The 11-argument
  signature is dropped and a 12-argument one created. There is one
  `company_narrative_save_draft` in the catalogue and no older way to save.
- The new function, after the unchanged source comparison and before
  anything is retired or inserted, returns `invalid-attempt` unless: for
  `'ai'`, the attempt is the contractor's, for `company.introduction`,
  finished `ok`, with a source fingerprint equal to the one stated, the same
  model and prompt version, and attached to no draft; for `'template'`, no
  attempt and no model.
- Unchanged from the reviewed function: the contractor's advisory lock, the
  profile row lock, comparing stated sources with current ones first, and no
  insert or retirement on any refusal.

### One provider-reachable module

`src/lib/company-interview/ai-wording.ts` is the only file on the interview's
path that imports the budget wrapper. Its one function, `rewordDraft`:

1. Reads answers and business name; fingerprint `F`. Builds the messages.
   Nothing to narrate means no call.
2. `withAiBudget`, feature `company.introduction`, stating `F`.
3. **Judge, before the attempt is recorded:** tripwires, then a fresh read
   of the sources. Changed sources give the verdict `sources-moved`.
4. The wrapper finishes the attempt once with that verdict and the real
   usage.
5. Only on `ok`: save the draft as `'ai'`, stating `F` and the attempt. The
   database compares the sources again under its locks and checks the
   attempt.
6. Anything else, at any step, returns the plain draft from `buildDraft`
   with a reason. No second call.

**Sources moving after step 4.** The attempt is already recorded `ok`. The
database refuses the save as `stale-source`; the reply is discarded; the
plain draft is built from the fresh sources. The attempt stays `ok`,
charged what it used, attached to nothing: a truthful record of a valid
reply that was never used. Nothing tries to rewrite it, and the ledger's
guard would refuse.

### What never reaches the provider

`service.ts` (load, resume, save answer, plain build, approve and the
rebuild approve triggers) imports nothing from `ai-wording.ts` or the
budget. The page reads one settings row through `ai-availability.ts`, which
imports neither. The plain draft's retry loop is template-only. Structural
tests assert each of these from the source, and a behavioural test drives
load, save, resume, rebuild and approve after an AI draft and checks the
provider and the ledger are untouched.

### Pure helpers

`ai-draft.ts` no longer takes a generator or catches errors. It holds the
prompt, the reply schema, message building (business name bounded to 200
characters), and `introductionProblems`. The wrapper owns the call, the
verdict and the usage.

Two tripwires were added, used for the interview only so the profile rewrite
behaviour reviewed in candidate A is unchanged:

- `addedNames`: capitalised words not in the sources (added places,
  clients, people). Blind to a name that starts a sentence or is written in
  lower case.
- `mixesCareerIntoBusiness`: the person's own years in the trade placed
  beside a phrase about the business's age. Both numbers are in the sources,
  so the added-number check cannot see this.

### Screen

Unchanged while AI wording is off. When it is on (only in the fixture):

- Finishing the last question asks for one reworded draft.
- A reworded draft is labelled "Worded for you from your answers", with
  "Worded by our writing assistant… It can get things wrong, so check it
  says only what you told us." It sits beside what is saved, is editable,
  and needs the same explicit save.
- "Show the plain version" builds the fixed-rule draft. "Reword it for me" /
  "Reword it again" is the explicit, budgeted retry.
- Refused, failed, rejected or stale: the plain version with one quiet line.
  Nothing is disabled and nothing retries.
- A draft whose sources changed offers only a plain rebuild.
- After approval the screen and the record say whose words they are: as
  worded by the assistant, or the contractor's own changes.

## Files

| File | Change |
| --- | --- |
| `supabase/migrations/20261010090000_company_narrative_ai_attempt.sql` | New |
| `src/lib/company-interview/ai-wording.ts` | New: the one provider-reachable module |
| `src/lib/company-interview/ai-availability.ts` | New: reads whether rewording is on offer |
| `src/lib/company-interview/ai-draft.ts` | Reduced to pure helpers; career-versus-business check |
| `src/lib/company-interview/guard.ts` | `addedNames` added; existing functions unchanged |
| `src/lib/company-interview/service.ts` | Plain save passes no attempt; two readers exported |
| `src/app/dashboard/settings/profile/interview/` | `rewordInterviewDraftAction`; page passes availability; screen as above |
| `src/lib/company-interview/eval/` | Cases, runner, report, test |
| `src/lib/company-interview/__fixtures__/` | Shared rig with canned generator; fake database learns the attempt rule |
| `e2e/import-fixture/` | Harness on the shared rig; canned AI-wording spec |
| `scripts/test-company-narrative-ai-sql.sh`, `package.json`, `.github/workflows/ci.yml` | SQL test and `eval:interview`, wired in |

**Existing tests changed, and why.** `ai-draft.test.ts` was rewritten because
the function it tested no longer exists. One assertion in
`ai-budget.test.ts` said the AI helpers were "imported by nothing"; it now
says they are imported only by `ai-wording.ts`. The harness guard test lists
the new harness exports. The G.3.1 service and source-binding unit tests,
the G.3.1 interview SQL test, the budget SQL test and the G.2 SQL test are
byte-for-byte unchanged and pass.

## Evaluation (`npm run eval:interview`)

Writes `AI-WIRING-EVAL.md` in this folder, deterministically. 50 cases,
all behaving as expected.

| | Count |
| --- | --- |
| Faithful canned replies | 13: 10 accepted, **3 rejected (false rejections)** |
| Unfaithful canned replies | 32: 29 stopped, **3 let through (known misses)** |
| Cases with no reply expected (off, refused, nothing to narrate) | 5: no call in any |

**False rejections** (faithful, rejected; the contractor gets the plain
version):

1. `false-rejection-digits`: the answer says "twenty miles", the reply
   writes "20 miles".
2. `false-rejection-quoted-term`: the answer puts a trade term in quotes
   and the reply keeps them.
3. `false-rejection-innocent-word`: the reply uses "leading to" as ordinary
   English.

**Known misses** (unfaithful, accepted; only the contractor reading the
draft stands between these and their profile):

1. `known-miss-lowercase-addition`: an added claim in lower case with no
   flagged word ("also builds house extensions").
2. `known-miss-omitted-customers`: an unanswered question filled with a
   generic lower-case answer.
3. `known-miss-injection-own-words`: an answer contains instructions naming
   claims and the reply repeats exactly those claims. The words are in the
   contractor's own answer, so the tripwires treat them as the contractor's.

Categories covered: source faithfulness (added numbers, places, clients,
awards, prices, testimonials, guarantees, markup, length), credentials,
career versus business, omitted answers, prompt injection, sources changing
during the call and between finish and save (answer, skip, business name),
provider and budget outcomes with exact charges, and edited approval.

## Test results

On commit `2dc6d097b7950ae996f37ee08f00c7bfb0df03b9`, on this machine. No real provider was called by
anything.

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | Pass |
| `npx vitest run` | 70 files; 1206 passed, 4 skipped, 0 failed (1123 at base) |
| `npm run eval:interview` | 55 passed; report written |
| `npx eslint .` | 0 errors |
| `npx next build` (no harness present) | Pass |
| `npm run test:company-narrative-ai-sql` (new) | Pass, local PostgreSQL 14, three migrations in order |
| `npm run test:ai-budget-sql` (unchanged) | Pass |
| `npm run test:company-interview-sql` (unchanged, source binding and races) | Pass |
| `npm run test:company-import-sql` (unchanged) | Pass |
| `bash scripts/test-replay-bootstrap.sh` | Pass |
| `npm run e2e:import-fixture` | 12 passed: 4 scenarios on desktop, phone, keyboard |

| Required | Proof |
| --- | --- |
| Attempt binding: foreign, failed, rejected, moved, in flight, missing, non-existent, reused, fingerprint mismatch, model mismatch, no model, version mismatch, wrong feature | SQL `t.refused` cases, each comparing the whole draft table before and after |
| Template with an attempt or a model | SQL |
| Old overload absent | SQL: one function in `pg_proc`, 12 arguments; `to_regprocedure` of the old signature is null; calling it fails |
| Function ACLs across the chain | SQL: no browser role can execute any of the seven interview, narrative or budget functions; service role can |
| Rejection changes nothing | SQL snapshot comparison; unit and evaluation checks that no rejected reply is stored |
| Source binding and races preserved | G.3.1 SQL and unit suites unchanged. New SQL: stale sources refused first for both generators; two real two-session races against an AI save; four simultaneous saves of one attempt give one draft |
| Sources move after finish, before save | SQL: `stale-source`, attempt stays `ok` and unattached, cannot be rewritten. Unit and evaluation: both source checks, separately |
| Finish once, after the checks, before attachment | `ai-wording.test.ts`: attempt is `ok` at the moment the save is called; one finish. Evaluation checks one finish per case |
| AI step outside the retry loop | Structural test on `service.ts` |
| Only the explicit action reaches the provider | Structural: one application importer, one call site, service, page and helpers import none of it. Behavioural: load, save, resume, rebuild, approve make no call and reserve nothing. Browser: counts asserted after answering, plain version, reload, approval |
| Disabled as seeded | SQL after all migrations; unit; browser main scenario asserts zero provider calls, zero attempts, zero budget calls, no rewording controls |
| Environment can only disable | `ai-budget.test.ts` (unchanged), `ai-wording.test.ts`, `ai-availability.ts` reads one variable |
| Refusal, failure, stale source give the plain version quietly | Evaluation; browser: quiet line, save button still enabled, no retry |
| Exact usage and outcomes charged | Evaluation "provider and budget" cases: 120, 90, 77 as reported; 500 when unknown or failed |
| Edited approval truthful | SQL, evaluation, browser: `approved_edited`, generator still `'ai'` |
| Input bounded, business name included | `ai-draft.test.ts`: name cut to 200; worst case stays within the wrapper's request bound |
| Unapproved website suggestions excluded | Rig seeds one; unit, evaluation and browser assert the tables read |
| No production-exposed route | Harness guard test (extended) |

Browser: layout and axe WCAG 2.2 A/AA at four new checkpoints, zero
findings on desktop 1280x800, phone 390x844 (touch) and keyboard-only (20
controls, all with visible focus). Screenshots in `ai-wiring/`:
`01-ai-worded-draft`, `02-ai-plain-version`, `03-ai-quiet-fallback`,
`04-ai-edited-and-approved`, each at both sizes. The earlier G.3.1
screenshots are unchanged.

## Test limitations

- **No real model.** See "What this is not".
- **Local Postgres 14, three migrations only**, not the full chain or the
  pinned image. Cloud replay is the first full-chain run.
- **The in-memory tables and budget mirror the SQL by hand.** The SQL tests
  are the authority.
- **The browser harness** runs the real screen, actions-shaped functions,
  wording flow, wrapper and service over the in-memory rig. It does not
  exercise sign-in, the dashboard shell, the real page loader, real row
  level security or the real `rewordInterviewDraftAction` (its
  authentication and context are covered by unit tests).
- **Tripwire blind spots** are real and listed above. More cases would find
  more of both kinds.

## Remaining gates

1. Independent review of this exact candidate.
2. Cloud CI on the integrated branch, including full migration replay.
3. **Candidate C, owner-gated:** a supervised live evaluation with real
   calls under an owner-set spend cap. This is the only step that produces
   evidence about the model.
4. **Candidate D, owner-gated:** the activation migration, on C's report.
5. Owner choices still open: the limits; whether finishing the interview
   rewords automatically; attempt-row retention; that the rewrite buttons
   become limited when candidate A is deployed.
6. Hosted migrations (G.2, G.3.1, A and this one) and deployment need owner
   approval.

## Risks

- **Service-role key required** for the reword action and the availability
  read. Without it rewording is not offered and the plain flow is unchanged.
- **The availability read is a hint.** If the row is switched off between
  page load and a press, the press returns the plain version silently.
- **`addedNames` will reject faithful replies** that capitalise a word the
  contractor did not (a product, a trade body written differently). That is
  the safe direction; it lowers how often rewording succeeds.
- **A valid reply can be paid for and never used** when sources move after
  it is recorded. That is by design and is visible in the ledger.
- **The migration fails if an `'ai'` draft without an attempt already
  exists.** None can have been created by the application; it fails closed
  if one was created by hand.
