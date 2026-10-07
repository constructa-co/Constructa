# Stage 2G.3.2 candidate A builder report: AI usage budget

- Issue: https://github.com/constructa-co/Constructa/issues/90
- Base: `91d06c2e26b0f2b90697fb19dc3f30af6af81d58` (PR 93 integration head: accepted G.3.1 repair plus the CI replay fix)
- Branch: `claude/stage2g3-ai-budget`, own worktree `constructa-stage2g3-ai-budget`
- Implementation commit: `a6c5f49d9bc8fa18df0b137594038dfc55148eb2`. This report is the commit after it.
- Patch, both commits on the base: `/Users/robertsmith/.codex/worktrees/stage2g-onboarding/stage2g3-ai-budget.patch`
- Local only. Not pushed. No provider call, hosted database, migration applied, deploy, secret or production change.

Design: `STAGE2G3-AI-ACTIVATION-DESIGN.md`, with Kimi's corrections C1 to C4
applied. This is candidate A only.

## What this is, and is not

**Is:** a usage budget, kept in the database, for two AI features, and the
existing Profile "rewrite with AI" buttons moved behind it.

**Is not:**

- **Not an application-wide spending limit.** It covers `profile.rewrite`
  and `company.introduction`. Nine other modules call the AI provider with
  no budget: `projects/brief`, `projects/proposal` and
  `settings/case-studies` (all three reachable in the cohort launch
  profile), and `projects/costs`, `projects/drawings`, `projects/schedule`,
  `projects/contracts`, `projects/lessons-learned`, `foundations/vision`.
  None was changed.
- **Not AI activation.** The interview's AI wording is still imported by
  nothing, and its feature row is seeded `enabled = false`. There is no
  activation migration here.
- **Not approved limits or prices.** The seeded numbers are provisional
  defaults for review. They are counts of calls and tokens. No price is
  stated or implied.
- **Not live.** Nothing changes for any contractor until this is deployed,
  which needs owner approval. When it is, the rewrite buttons become limited
  (see "Behaviour change on deployment").

## Design as built

### Schema (`20261009090000_ai_generation_budget.sql`)

| Object | Purpose |
| --- | --- |
| `ai_generation_features` | One row per feature: `enabled`, and the most output one call may reserve. Only the two named features can have a row |
| `ai_generation_limits` | Two rows. `contractor`: what one contractor may use across both features. `global`: what all contractors together may use. Kept as separate rows because they mean different things (C2) |
| `ai_generation_attempts` | The ledger. One row per reserved attempt: feature, times, outcome, reservation, reported tokens, model, prompt version, source fingerprint. `charged_output_tokens` is generated: reported output if known, otherwise the whole reservation. No prompt or reply text |
| Partial unique index | One attempt in flight per contractor, across both features |
| Guard trigger | A reservation's identity never changes; a finished attempt cannot be changed by anyone |
| `ai_generation_reserve` | Atomic reservation |
| `ai_generation_finish` | Records the outcome, once |

Row level security is on for all three tables with no policy. No browser
role has any grant on them or on either function.

Seeded, provisional: `profile.rewrite` on, 700 output tokens a call;
`company.introduction` **off**, 500. Contractor: 6 attempts an hour, 20 a
day, 12,000 output tokens a day. Global: 2,000 attempts and 1,000,000
output tokens a day.

### Reserve

In one short transaction: take the global lock, then the contractor's;
refuse as `disabled` if the feature is unknown or off or either limits row
is missing; validate the reservation size and fingerprint rule; close this
contractor's calls older than two minutes as `abandoned`; refuse
`in-flight`, `attempt-limit`, `token-limit` or `service-limit`; otherwise
insert and return the attempt id. A refusal inserts nothing.

**Lock order (C4).** Global first, contractor second, in this one function
and nowhere else. `ai_generation_finish` takes no advisory lock. The SQL
test asserts all three facts from the catalogue. Consequence, stated so
nobody "optimises" it later: reservations happen one at a time across the
whole service. That is what makes the global ceiling exact. The provider
call is never inside that transaction.

### What an attempt is charged

| How it ended | Counts as an attempt | Output charged |
| --- | --- | --- |
| `ok` | Yes | What the provider reported |
| `rejected:schema` (not JSON, wrong shape, cut off) | Yes | Reported if known, else the whole reservation |
| `rejected:tripwire` | Yes | What the provider reported |
| `sources-moved` (for candidate B) | Yes | What the provider reported |
| `error` (nothing came back) | Yes | The whole reservation |
| Still in flight | Yes | The whole reservation |
| `abandoned` | Yes | The whole reservation |
| Refused | No row, no call | Nothing |

### Usage preserved on bad replies (C3)

`generateStructured` threw away the provider's usage when a reply failed
its schema. It now throws `AiResponseError` carrying the reported model and
usage (never the reply text) when a response exists but is unusable. A
failure with no response stays a plain error. Usage is never invented: if
the provider reports none, it is `null`, and the attempt is charged its
whole reservation. A usable reply with no usage figure is treated as
unusable, because it could not be budgeted.

### The wrapper (`src/lib/ai-budget.ts`), exactly-once finish (C1)

`withAiBudget(context, request, judge)` is the only code that calls
`generateStructured`, and the only code that calls the two database
functions. In order: emergency stop; fixed size limits; reserve; one call
with the reserved output cap and a fixed time limit; the caller's `judge`
decides the verdict; **then** one finish with the real outcome and usage.

- The verdict is decided before the finish, so a finished attempt is never
  rewritten. A test checks the attempt is still open when `judge` runs.
- A thrown call is finished as `error`. The `finally` finishes only if
  nothing else did.
- If recording a good reply fails, the reply is **not** used: the attempt
  stays open, charged in full, blocks further calls for two minutes and is
  then closed as abandoned.
- Model, output cap and time limit are fixed on the server. A caller cannot
  pass larger ones. The database also refuses a reservation above the
  feature's cap.
- `CONSTRUCTA_AI_DISABLED` stops every call before the budget is consulted.
  It is the only environment variable the wrapper reads, and nothing in the
  environment can switch a feature on.

### Profile rewrite, the narrow integration

Both legacy actions (`rewriteWithAIAction`, `rewriteMdMessageAction`) share
one path: authenticate; validate field and 2,000-character cap; create the
service-role client; `withAiBudget` with feature `profile.rewrite`; map the
result to a message. The reply is still returned as a suggestion that the
form holds as pending (unchanged from G.3.1). The file no longer imports
anything from `@/lib/ai`.

Nothing else on the Profile form or its save action was touched.

### Behaviour change on deployment

| Today (live) | After this is deployed |
| --- | --- |
| Rewrite buttons can be pressed without limit | One at a time; 6 an hour and 20 a day per contractor across both buttons; a daily output allowance; a service-wide daily ceiling |
| Failed presses cost the contractor nothing | Failed presses count |
| Works without the service-role key | Needs `SUPABASE_SERVICE_ROLE_KEY`; without it rewrite is unavailable and makes no call |
| Works before any migration | Needs this migration applied; until then rewrite is unavailable and makes no call |

## Files

| File | Change |
| --- | --- |
| `supabase/migrations/20261009090000_ai_generation_budget.sql` | New |
| `src/lib/ai-budget.ts` | New: the wrapper |
| `src/lib/ai.ts` | `AiResponseError`; `generateStructured` preserves usage on bad replies and no longer defaults missing usage to zero |
| `src/app/dashboard/settings/profile/actions.ts` | Rewrite actions go through the wrapper |
| `src/lib/__fixtures__/fake-ai-budget.ts` | New: in-memory budget for unit tests |
| `src/lib/ai-budget.test.ts`, `ai.structured.test.ts`, `settings/profile/actions.test.ts` | New and extended tests |
| `scripts/test-ai-budget-sql.sh`, `package.json`, `.github/workflows/ci.yml` | SQL test, wired in |

Not touched: the interview service, screen, template, tripwires and
`ai-draft.ts`; the G.3.1 and G.2 migrations and tests; every other AI
caller; the OpenAI SDK, model and vendor.

## Test results

On commit `a6c5f49d9bc8fa18df0b137594038dfc55148eb2`, on this machine. No real provider was called by any
test: the provider function is replaced by canned replies, and the SDK
client is mocked where `generateStructured` itself is tested.

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | Pass |
| `npx vitest run` | 68 files; 1123 passed, 4 skipped, 0 failed (1075 at base; 48 new) |
| `npx eslint .` | 0 errors |
| `npx next build` | Pass |
| `npm run test:ai-budget-sql` | Pass, throwaway local PostgreSQL 14 |
| `npm run test:company-interview-sql` (G.3.1, incl. source binding) | Pass, unchanged |
| `npm run test:company-import-sql` (G.2) | Pass, unchanged |
| `bash scripts/test-replay-bootstrap.sh` | Pass (now counts 107 migrations) |
| `npm run e2e:import-fixture` | 9 passed, unchanged |

| Required | Proof |
| --- | --- |
| Eight simultaneous reservations, one wins | SQL: eight sessions, exactly one `reserved`, seven `in-flight`. Unit: eight simultaneous wrapper calls, one provider call |
| Global ceiling under concurrency | SQL: ten contractors at once against a ceiling of 3 give exactly 3 |
| Cross-feature pool | SQL: three rewrites and three interview calls exhaust the hour for both. Unit: same through the wrapper; both rewrite buttons share it |
| Exact attempt, time, token and global boundaries | SQL: 6th allowed, 7th refused; 59 minutes still counts, 61 does not; 20th allowed, 21st refused; over 24 hours no longer counts; 11,700+300 allowed, +301 refused; service ceiling allowed exactly at, refused one over |
| Failures, in flight, abandoned count | SQL: five of six hourly calls failed or rejected and the 7th is still refused; an abandoned call keeps its whole reservation; another contractor's open reservation counts against the service ceiling |
| No free failures | SQL and unit: six failed calls use up the hour; `error` charged 700 |
| Refusal inserts nothing | SQL: row counts after every refusal and error. Unit: attempts unchanged, no finish |
| Immutable finish, own id, once | SQL: other contractor's finish returns false; second finish false and outcome unchanged; direct updates to outcome, usage or reopening raise, even for the service role; an open reservation cannot be shrunk or moved |
| DB hard bounds on metadata | SQL: unknown outcome, caller-set `abandoned`, `ok` without usage, negative and oversized usage all raise; over-cap and zero reservations raise; fingerprint required for interview and forbidden for rewrite; long model and prompt-version labels cut |
| Actual versus unknown usage | SQL: 120 + 700 = 820. Unit: `AiResponseError` with usage charged as reported, without usage charged in full; `generateStructured` carries usage on not-JSON, wrong shape, cut off, and reports `null` when the provider gave none |
| Unauthenticated, oversized, disabled, refused: zero provider | `actions.test.ts`: no provider, no budget call, and for unauthenticated not even the privileged client |
| Canned injection and invalid replies | `actions.test.ts`: five tripwire cases dropped and recorded as `rejected:tripwire` with real usage; invalid reply recorded as `rejected:schema`; faithful reply returned as a suggestion and nothing saved |
| Emergency stop, zero reserve | `ai-budget.test.ts` and `actions.test.ts`: no budget call, no provider call; the only `process.env` read is the stop |
| No call without budget, structurally | `ai-budget.test.ts`: `generateStructured` is called only in `ai-budget.ts`; the rewrite file imports nothing from `@/lib/ai`; the database functions are named only in the wrapper and its fake; `ai-draft.ts` is imported by nothing |
| Lock order | SQL, from `pg_proc`: one function takes the locks, global before contractor; finish takes none |
| Browser roles | SQL: denied on all three tables and both functions for `authenticated` and `anon`; `has_table_privilege` |
| G.3.1 source binding and G.2 preserved | Their unit and SQL suites pass unchanged |

## Test limitations

- **No real provider.** Nothing here shows what the model writes, how long
  it takes, or what it reports as usage. The shape of the provider's usage
  fields is assumed from the SDK types and the mocked client.
- **Local Postgres 14, this migration alone.** Not the full chain, not the
  pinned Supabase image, not a hosted project. The cloud replay job will be
  the first full-chain run.
- **Service-role bypass is simulated** with a `BYPASSRLS` role, as in the
  G.2 and G.3.1 SQL tests.
- **The in-memory budget mirrors the SQL by hand.** The SQL test is the
  authority.
- **Concurrency tests use real parallel sessions** and do not depend on
  timing for their result, but they exercise eight and ten sessions, not
  load.
- **No browser test of the Profile form.** The pending-suggestion panel was
  built in G.3.1 and is unchanged; the new refusal messages reach it through
  the existing toast path and are covered at the action level only. The
  legacy Profile form has no fixture harness.
- **Input tokens are bounded by character caps, not measured.**

## Remaining gates

1. **Independent review of this candidate** (Kimi, exact pin).
2. **Cloud CI on the integrated branch**, including full migration replay.
3. **Owner decisions**, none of which this candidate takes: the limits; that
   the rewrite buttons become limited on deployment; attempt-row retention.
4. **Hosted migration and deployment** need owner approval. Until then no
   contractor sees any change.
5. **Candidate B** (interview wiring behind the disabled row, the
   `'ai'`-draft-needs-an-attempt rule in `save_draft`, canned evaluation
   harness, browser fixture) starts only after this is reviewed.
6. **Candidates C and D** (live evaluation; activation) are owner-gated
   spending and product decisions.

## Risks

- **A stuck finish blocks a contractor for two minutes.** If recording an
  outcome fails, their next press is refused as "already being written"
  until the attempt is abandoned.
- **The global lock serialises reservations** service-wide. Fine at cohort
  scale; it is a deliberate ceiling, not an oversight.
- **Limits are changed by migration.** There is no admin screen. That is
  intended for now: every change is reviewed.
- **No clean-up of attempt rows.** Retention is an open owner decision; the
  indexes keep the 24-hour queries cheap regardless.
- **`generateStructured` is stricter:** a reply with no usage figure is now
  rejected. Its only caller is the wrapper.
- **Rewrite depends on the migration and the service-role key** once
  deployed (see the behaviour table).
