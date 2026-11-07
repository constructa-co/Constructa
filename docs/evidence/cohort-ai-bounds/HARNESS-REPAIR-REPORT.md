# Cohort AI bounds: hosted-journey harness repair

The required P2 repair from the first review. Harness only. The hosted journey was **not run**: I have no credentials for the disposable project and was not asked to obtain any. Everything below is proved with unit tests and a pretend network. This is not evidence that the cloud journey passes, and it is not a claim of deployment readiness.

Written 8 October 2026 by the primary builder (Claude).

## 1. Pins

| | |
| --- | --- |
| Worktree | `/Users/robertsmith/Documents/GitHub/constructa-cohort-ai-harness-repair` |
| Branch | `claude/cohort-ai-harness-repair` (local only; not pushed, no PR) |
| Base | `0252981f0f76db940ff1138f3492d2e4add80d9a` (the accepted candidate, unchanged) |
| Commit | the single commit that adds this file |
| Patch | `/Users/robertsmith/.codex/worktrees/stage2g-onboarding/cohort-ai-harness-repair.patch` |

## 2. Files changed

All under `e2e/`, plus one workflow line and this report. No file under `src/`, `supabase/` or `scripts/` is changed.

| File | Change |
| --- | --- |
| `e2e/support/brief-ai-mode.ts` (new) | The two modes, the read-only prerequisite check, what each mode expects. |
| `e2e/support/brief-ai-mode.test.ts` (new) | 38 unit tests. |
| `e2e/support/backend.ts` | A read-only inspector of the AI budget, and a read of a synthetic account's attempt count. |
| `e2e/support/global-setup.ts` | Runs the check after the target is proved, before any test. |
| `e2e/phase1-journey.spec.ts` | The Brief step branches on the explicit mode; the provider record says which mode ran. |
| `e2e/support/journey-data.ts` | The job's trades, for the by-hand path. |
| `e2e/README.md` | The modes and the new stop condition. |
| `.github/workflows/e2e.yml` | `E2E_BRIEF_AI_MODE: disabled`, named rather than defaulted. |

`e2e/support/provider-stubs.mjs` is unchanged from the candidate and still answers both the role-separated request and the older single prompt; a test pins both.

## 3. What the repair does

**Two explicit modes, chosen by `E2E_BRIEF_AI_MODE`.** Unset means `disabled`, which is what this branch ships; the workflow also names it. `enabled-with-stub` is the only other value. Anything else is a configuration failure. The mode is a statement about the disposable project's state, not a switch: no harness code turns the feature on or off.

**Disabled mode.** The journey types the description and presses the button, then requires:

- exactly one alert, whose whole text is the application's `COHORT_AI_OFF` constant (imported from the application, not copied);
- no "From the assistant" region and no "Suggestion · not applied";
- the description field unchanged, and the stub's marker nowhere on the page;
- no new request at the provider stub, and zero budget attempts for the new account (read from the database).

It then picks the two trades by hand through the trade search, and carries on unchanged through site notes, review, estimate, programme, proposal, public page, client response and the second version. Nothing is skipped. The "not available" message, or any other error, fails the step: it cannot be mistaken for "switched off".

**Enabled-with-stub mode.** The original assertions are kept as they were (pending suggestion, marker, untouched description, Apply, applied text). Two were added: one provider request and one budget attempt.

**Honest record.** The results file carries `provider.briefAiMode`, `provider.aiSuggestionTested` (false in disabled mode) and `parity.briefAi`, and the recorded step reads "AI suggestion NOT tested". The journey also now requires the provider's request count to equal what the mode expects: 0 or 1.

**Read-only prerequisite check.** In global setup, after the build is proved to name only the approved project and the project has answered its own key, and before any test or account:

| Read | How | Blocks when |
| --- | --- | --- |
| `ai_generation_attempts` | `SELECT id LIMIT 1` | table missing or unreadable |
| `ai_generation_limits` | `SELECT scope` | table missing, or no `contractor` or `global` row |
| `ai_generation_reserve`, `ai_generation_finish` | the API's own description of itself (`GET /rest/v1/`) | function absent, or without the arguments the application passes |
| `ai_generation_features` | `SELECT enabled WHERE feature = 'brief.suggest'` | table missing, no row, state not a boolean, or state not what the mode names |

A failure is an `E2E CONFIGURATION FAILURE` that lists every problem as `PREREQUISITE BLOCKED` or `WRONG STATE`, names the three migrations, and says the harness will not apply them or change a setting. Database errors are reduced to their code. The functions are never called: calling `reserve` could write.

## 4. Verification actually run

Correction, made with the later parser repair: this report first said "46 new tests". The new file had 38; 46 was the total for the `e2e/support` directory. The table below is corrected. See `OPENAPI-REPAIR-REPORT.md` for the current counts.

| Check | Result |
| --- | --- |
| `npx vitest run e2e/support` | 46 pass: the 38 new tests and the 8 existing environment-gate tests |
| `npx vitest run` | 75 files, 1,332 passed, 4 skipped (pre-existing skips) |
| `npx tsc --noEmit` | 0 errors (covers the specs) |
| `npx eslint .` | 0 errors |
| `npx playwright test --list` with nothing configured | stops with the existing configuration failure |
| The same with placeholder, unsigned keys shaped for the approved project | both specs load in unset, `disabled` and `enabled-with-stub` modes; `auto` is refused. Listing starts no server and sends nothing |

What the unit tests cover, against the brief's list:

- **Missing or wrong table or function**: each of the three tables, each function, an older function signature, a missing allowance row, a missing feature row, and a wholly unmigrated project.
- **Wrong project**: the inspector refuses a non-approved URL or reference before any request.
- **Unexpected or unknown state**: on in disabled mode, off in enabled mode, and seven non-boolean values.
- **No secret printing**: a thrown error carrying a key-shaped string and a host produces a message with neither.
- **Disabled versus unavailable**: the real `suggestBrief` returns `COHORT_AI_OFF` over a budget with the feature off, and the Brief's "not available" message when the reserve function answers `PGRST202`. The two are asserted different.
- **Same prerequisites as production**: the names the helper checks are asserted against `src/lib/ai-budget.ts`, `brief-suggest.ts` and the migrations, and the mock answers only to those names.
- **Read-only**: the real inspector runs over a pretend network that records every request; all are `GET` or `HEAD`, none is to `/rpc/`. A source check finds no insert, update, upsert, delete or function call in any harness file.
- **Manual path parity**: the trades picked by hand equal what the stub suggests and are real trade names; every later journey step is still present after the branch; no skip or fixme exists.
- **Enabled assertions still meaningful**: the two modes' expectations are pinned and differ on every field; the enabled branch's original assertions are pinned in the spec.

## 5. Not verified, and other limits

- **No hosted run.** The disabled branch's selectors (the alert, the trade search, the "Remove …" chips) are written from the screen's source and have not been exercised in a browser against the real Brief.
- **The function check depends on the API description.** It assumes the disposable project serves PostgREST's description at `/rest/v1/` to the service-role key and lists these functions in it. I could not confirm that against the live project. If it does not, the run stops with "could not be checked (HTTP n)" or "does not exist". It fails closed, but it would then need a different read-only probe.
- **Expected first cloud result.** If the disposable project does not yet have the three migrations, the run will stop as blocked. That is the intended outcome until an owner-approved schema application, not a defect and not a pass.
- **The check also gates the activation spec**, because it runs once in global setup. That spec makes no AI request, so this is stricter than it needs.
- **The by-hand brief differs from the suggested one in one way**: the description has no stub marker. Client type is the default (domestic) in both. Later steps do not depend on the marker.
- **Only the Brief suggestion is covered.** The journey never exercised proposal wording, case-study wording or the programme update, and still does not.

## 6. Still held for the owner

1. Applying the three budget migrations to the disposable project.
2. Whether and when to switch `brief.suggest` on there and run `enabled-with-stub`.
3. Everything listed in the builder report, unchanged: activation, the six-feature allowance, the proposal input limit, the case-study panel, programme-update authorisation.

## 7. Not done

No push, PR, merge or deploy. No secret read or requested. No hosted read or write was made by me. No migration, activation or setting change. No real provider call. No dependency added. No change to application source or to `src/app/(marketing)/`. Frozen worktrees, including the candidate at `0252981`, are unchanged.
