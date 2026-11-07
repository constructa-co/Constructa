# Cohort AI bounds: API-description parser repair

A narrow, defensive repair to the harness's read-only prerequisite check, after the final delta review. Harness only. No hosted call was made, so nothing here says what the disposable project serves or whether the cloud journey passes.

Written 8 October 2026 by the primary builder (Claude).

## 1. Pins

| | |
| --- | --- |
| Worktree | `/Users/robertsmith/Documents/GitHub/constructa-cohort-ai-openapi-repair` |
| Branch | `claude/cohort-ai-openapi-repair` (local only; not pushed, no PR) |
| Base | `61b4a85cbedd7979edd49c11067c5e9d3018f6e7` (the harness repair, unchanged) |
| Commit | the single commit that adds this file |
| Patch | `/Users/robertsmith/.codex/worktrees/stage2g-onboarding/cohort-ai-openapi-repair.patch` |

## 2. What is and is not known about the format

The check reads a function's argument names from the API's description of itself. The previous version understood one layout: the body parameter with its schema written inline.

- **That inline layout is valid.** The integrator checked it against PostgREST's own v13.0.5 test suite (`test/spec/Feature/OpenApi/OpenApiSpec.hs`). I did not fetch that file myself; I am relying on that check, and the fixture attributed to it uses this project's argument names and copies nothing from it.
- **Which layout the disposable project serves is not known.** Nobody inspected it. I make no claim about its PostgREST or OpenAPI version.
- **The other layouts are defensive.** Schemas behind local references, and an OpenAPI 3 `requestBody`, are now understood so that a correctly migrated project is not blocked if it serves one of them. They are mocked regression targets, not observed failures.

## 3. Files changed

All under `e2e/support/`, plus `e2e/README.md` and two reports. No application source, migration, script, workflow or journey spec is changed.

| File | Change |
| --- | --- |
| `e2e/support/api-description.ts` (new) | The parser. Pure; it fetches nothing. |
| `e2e/support/api-description.test.ts` (new) | 43 tests. |
| `e2e/support/backend.ts` | Uses the parser; time limit and size limit on the description; time limits on the table reads; errors reduced to safe codes. |
| `e2e/support/brief-ai-mode.ts` | The old inline-only helper removed; "could not be checked" now says it implies nothing about the function. |
| `e2e/support/brief-ai-mode.test.ts` | One test replaced, nine added (38 to 47). |
| `e2e/README.md` | One bullet for the new stop condition. |
| `HARNESS-REPAIR-REPORT.md` | Test count corrected (see section 6). |

## 4. What the repair does

**Three answers, kept apart.**

| Answer | When | What the run says |
| --- | --- | --- |
| absent | the description has no `/rpc/<name>` path | "does not exist" |
| arguments | a body schema was understood | passes, or "does not take …" if an expected argument is missing |
| unreadable | the description is in a form the parser does not understand | "could not be checked (code). This says nothing about whether the function exists or what it takes." |

Before, an unrecognised layout produced an empty argument list and the false statement that the function "does not take" its arguments. All three still block the run; only the wording of the third was wrong.

**Layouts understood.** The request body of `POST /rpc/<name>`, as: Swagger 2 `parameters[]` with `in: "body"` and an inline schema (unchanged); the same with the parameter or the schema behind a reference; OpenAPI 3 `requestBody.content[...].schema`, inline or behind a reference, preferring `application/json`. Nothing else: no `allOf`, no response schemas, no general traversal.

**References are local and bounded.**

- Only `#/parameters/…`, `#/definitions/…`, `#/components/schemas/…`, `#/components/requestBodies/…` and `#/components/parameters/…` are followed.
- JSON Pointer escapes (`~1`, `~0`) and percent escapes are decoded.
- At most 8 references in a row. A cycle is detected and refused.
- Anything that does not start with `#` is refused as external. No reference is ever fetched; the parser has no network access to fetch with.
- Lookups use own properties only, so `__proto__` and `constructor` resolve to nothing.

**Bounded reads.** The description is fetched with one `GET`, a 10 second limit, redirects refused, and an 8 MB size limit. The three table reads and the mid-journey attempt count carry the same 10 second limit. No function is called and nothing is written.

**Safe codes only.** A failure is reported as `timeout`, `network`, `http-<status>`, `api-description-not-json`, `api-description-too-large`, `api-description-unreadable:<reason>`, or a database error code that is a short alphanumeric token. Any other code becomes `unknown`. No message, body, address or key is repeated.

Unchanged: the approved-project guard, the check's place after the target is proved and before any account exists, the two explicit modes, the by-hand journey, the enabled-mode assertions, and the absence of any switch or bypass.

## 5. Verification actually run

| Check | Result |
| --- | --- |
| `npx vitest run e2e/support` | 98 pass: 43 parser, 47 mode and inspector, 8 existing environment-gate |
| `npx vitest run` | 76 files, 1,384 passed, 4 skipped (pre-existing skips) |
| `npx tsc --noEmit` | 0 errors |
| `npx eslint .` | 0 errors; no warnings in `e2e/support` |

Fixtures, against the brief's list:

- **Inline shape**, attributed to the upstream v13.0.5 tests, with synthetic arguments.
- **Swagger 2 schema reference**, **parameter reference** (with its schema behind a second reference), **OpenAPI 3 requestBody** inline, by schema reference and by requestBody reference.
- **Reference chains** and **pointer escaping**, including `~01` as a literal `~1`.
- **Missing or malformed**: 17 shapes, each reported unreadable and none as an empty argument list.
- **Refused references**: unresolved, external (relative file, web address, `file:`), malformed, outside the allowed places, through the prototype; cycles of one and three and from a parameter; depth 8 accepted, 9 and 500 refused.
- **Supported schema missing an argument**: still "does not take", in both Swagger 2 and OpenAPI 3.
- **Through the real inspector over a pretend network**: both reference layouts accepted end to end; four unreadable descriptions give "could not be checked" and never "does not take" or "does not exist"; a non-JSON and an oversized description fail as reads.
- **Time limit**: a server that never answers produces five `(timeout)` problems in well under five seconds, with every request's signal aborted.
- **No secrets**: a thrown connection error and a 403 body that both repeat a key-shaped string leave only `network`, `http-403` and `unknown`.
- **Read-only, expected host only**: every recorded request is `GET` or `HEAD`, none is to `/rpc/`, all are to the approved host, and an external reference causes no request.

I checked that the tests bite by breaking the code twice and restoring it: removing the fetch's time limit failed the timeout test; removing the depth limit and the external-reference refusal failed six tests.

## 6. Correction to the earlier report

`HARNESS-REPAIR-REPORT.md` said "46 new tests". The new file had 38; 46 was the `e2e/support` directory total including 8 existing tests. Both lines are corrected in this commit, with a note saying so.

## 7. Limits

- **No hosted run, as before.** The disabled-mode selectors are still unexercised in a browser.
- **The check still depends on the API description being served** to the service-role key at `/rest/v1/`. If it is not, the run stops with a safe code. That fails closed, but would need a different read-only probe.
- **A layout outside the three understood** stops the run as "could not be checked". That is deliberate: it is reported truthfully and not guessed at.
- **The size limit counts characters of the decoded text**, and applies after the body has been received. The time limit is what bounds a slow or endless response.
- **The first cloud run on an unmigrated disposable project is still expected to stop as blocked.** That is not a pass.

## 8. Not done

No push, PR, merge or deploy. No hosted read or write. No secret read or requested. No migration, activation or setting change. No real provider call. No dependency added. No application source changed. Frozen worktrees, including `0252981` and `61b4a85`, are unchanged.
