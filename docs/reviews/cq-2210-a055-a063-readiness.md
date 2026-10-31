# CQ-2210 A055/A063 assistant readiness explanation

**Status: source written, NOT verified. No test, type check or lint ran in this session.**
A055 and A063 are not Complete. Real paid QA is separate and there is no live SQL or settings authority.

Base: `24b9dcd`, branch `cq/cq-2210-a055-a063-readiness`. Changes are uncommitted for the runner.

## Failure diagnosed

Signed-in QA shows only "Not enabled" on Brief, Estimating and Programme. From source:

1. `createRpcUsageLedger().covers()` reduced every refusal (no table, no row, disabled, ceilings, read failure) to `false`.
2. `prepare()` in `job-assistant-transport.ts` reduced every prerequisite to `null`, and pages received one boolean.
3. `deepSeekQaApproval` returned null when the key was missing, so "QA with no key" looked like "not approved".
4. `reviewed-conversation.ts` and `pricing-conversation.ts` discarded the server's off message and showed a fixed string.
5. The reason text sat inside a collapsed `<details>`, with only "Not enabled" visible.

Which prerequisite is failing on the live QA target is not known here. No live read was made.

## Repair

- `assess()` replaces the body of `prepare()` with the same checks in the same order. Each refusal now carries a code. `prepare()`, `approved*Generator()` and `jobAssistantAvailable()` still return their existing shapes.
- `ledger.assess()` is the one settings read, and `covers()` is derived from it (`=== "ready"`).
- `deepSeekQaApproval` now follows `onQaPreview()`. A missing key still refuses, at the existing provider check, and is reported as `provider_unavailable`.
- Pages call `jobAssistantReadiness(feature, { owner })`. `owner` is `project.user_id === user.id`; the Estimating page now selects `user_id` for this. A non-owner gets the same availability and `offReason: null`.
- Server Actions pass `jobAssistantTurnSource(feature)`. The reason is read only after the handler has verified the owner, the lock and the revision.
- Words live only in `src/lib/job-assistant-readiness.ts`, keyed by code, so database or provider text has no route to a page.
- Panels show `Not enabled: <short reason>` in the collapsed summary and the full sentence when opened.

| Code | Visible note |
| --- | --- |
| `emergency_stop` | AI is paused |
| `not_approved` | none: today's words unchanged |
| `approval_mismatch` | approved limits disagree |
| `provider_unavailable` | AI provider not connected |
| `ledger_not_installed` | usage ledger not installed |
| `ledger_disabled` | usage ledger switched off |
| `ledger_limits` | usage ledger limits too low |
| `ledger_unreadable` | usage ledger could not be checked |
| `check_failed` | readiness check did not finish |

Unchanged: caps, prices, approvals, provider choice, migrations, reserve and settle. No fallback provider, no Production activation, no terms acceptance, no diagnostic runner.

## Changed paths

New:
- `src/lib/job-assistant-readiness.ts`
- `src/lib/server/job-assistant-readiness.test.ts`
- `src/app/dashboard/projects/job-assistant-readiness-pages.test.tsx`
- `docs/reviews/cq-2210-a055-a063-readiness.md`

Modified:
- `src/lib/server/job-assistant-transport.ts`
- `src/lib/server/job-assistant-ledger.ts`
- `src/lib/server/job-assistant-generation.ts`
- `src/lib/server/brief-request.ts`
- `src/lib/server/pricing-request.ts`
- `src/lib/server/planning-request.ts`
- `src/lib/reviewed-conversation.ts`
- `src/lib/pricing-conversation.ts`
- `src/components/brief-conversation-panel.tsx`
- `src/components/pricing-assistant-panel.tsx`
- `src/components/planning-conversation-panel.tsx`
- `src/app/dashboard/projects/brief/assistant-actions.ts`
- `src/app/dashboard/projects/brief/brief-client.tsx`
- `src/app/dashboard/projects/brief/page.tsx`
- `src/app/dashboard/projects/costs/assistant-actions.ts`
- `src/app/dashboard/projects/costs/estimate-client.tsx`
- `src/app/dashboard/projects/costs/page.tsx`
- `src/app/dashboard/projects/schedule/assistant-actions.ts`
- `src/app/dashboard/projects/schedule/page.tsx`
- `src/app/dashboard/projects/schedule/simple-programme-client.tsx`

No existing test was changed, skipped or weakened.

## Command outputs

Every verification command was refused by this session's permission gate, and the session is non-interactive, so approval could not be given. Other launchers and subagents were not used to get around the gate.

| Command | Output |
| --- | --- |
| `node_modules/.bin/vitest run --cache=false <new tests>` with a pipe to `grep`, `sort`, `uniq` | `This Bash command contains multiple operations. The following part requires approval: node_modules/.bin/vitest run ...` |
| `npx vitest run --cache=false <new tests>` | `This command requires approval` |
| `npm test -- --cache=false <new tests>` | `This command requires approval` |
| `npx tsc --noEmit --incremental false` | `This command requires approval` |

ESLint was not attempted, because the same gate refused the test and type commands. `git status --short` and `git diff --stat` did run: 20 tracked files changed, 153 insertions, 67 deletions, before this document.

**There is no red run.** The new tests were written before the implementation as intended, but they were never executed against the old source. No failing-counterexample or green evidence exists.

## Runner must do

The red check needs a stash of the source changes, or a run of the new tests on a checkout of `24b9dcd` with only `src/lib/job-assistant-readiness.ts` and the two test files added.

```bash
npx vitest run --cache=false src/lib/server/job-assistant-readiness.test.ts src/app/dashboard/projects/job-assistant-readiness-pages.test.tsx
npx vitest run --cache=false src/lib/server/job-assistant-request.test.ts src/lib/server/deepseek-job-assistant.test.ts src/lib/server/brief-request.test.ts src/lib/server/pricing-request.test.ts src/lib/pricing-conversation.test.ts src/lib/pricing-assistant-session.test.ts src/lib/planning-conversation.test.ts src/components/pricing-assistant-panel.test.tsx src/components/planning-conversation-panel.test.tsx src/app/dashboard/projects/brief/brief-assistant-request.test.tsx src/app/dashboard/projects/costs/pricing-assistant-request.test.tsx src/app/dashboard/projects/schedule/planning-assistant-request.test.tsx
npx tsc --noEmit --incremental false
npx eslint <changed paths>
```

The second line is here because the shared code they cover changed, not as a repeat of accepted suites. Fix any failure in the source or the new tests, never by weakening an existing test.

## Limitations and points for the checker

- The new tests have type casts and a page database fake that have never been compiled or run. Expect that some may need adjusting.
- `covers`-only ledgers (test fakes) report `ledger_unreadable` when they refuse. The real ledger always has `assess`.
- `unwrapAssistantTurn` replaces a blank or over-500-character server message with its fallback, so such an off answer would show the failure wording instead of the off wording. The server's own messages are short.
- A page's reason is fixed at page load. A turn that goes off later shows the server's current reason as an alert.
- `emergency_stop` is checked before approval, so a job's owner on Production sees "AI is paused" if the stop is set. It reveals no detail, but it is a visible Production wording change in that one case. `not_approved` on Production is unchanged.
- `not_approved` keeps generic words by design. A QA deployment that fails the `onQaPreview()` target check therefore still looks generic. Existing tests pin this wording on the real Server Action.
- The ledger reads the settings row only. It does not prove the `job_assistant_*` functions exist, and `reserve` still decides every attempt.
- Comments now out of date, left alone: the header of `job-assistant-generation.ts` ("activation is OFF") and the existing test title "only on QA Preview with a key", which now describes the combined activation result, not the approval object alone.
