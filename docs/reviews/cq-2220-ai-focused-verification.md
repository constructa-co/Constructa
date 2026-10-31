FAIL — shared integration test and full `tsc --noEmit` failed on pinned `baf3a9c`; new CQ-2210 vitest files passed at runtime.

# CQ-2220 A055/A063 focused verification (execution evidence)

Checker: grade this report and pinned paths at HEAD below. Do not treat `docs/reviews/cq-2210-a055-a063-readiness.md` as runtime proof; it remains the prior Claude permission-FAIL handoff (immutable).

## Pin

| Field | Value |
| --- | --- |
| Worktree | `/Users/robertsmith/dev/constructa-fresh-20261025/.cq-wt/cq-0711-a089-fixture-cause` |
| Branch | `cq/cq-2210-a055-a063-readiness` |
| HEAD | `baf3a9c2d916c65741b9089ca805ce7f054ee0cf` (`baf3a9c`) |
| Prior review base (not re-run for RED) | `24b9dcd` |
| Node binary | `/usr/local/bin/node` (`/usr/local/bin/node24` absent on host) |
| Node version | `v24.19.0` |
| ROOT `node_modules` | `/Users/robertsmith/dev/constructa-fresh-20261025/node_modules` |
| Vitest | `/Users/robertsmith/dev/constructa-fresh-20261025/node_modules/vitest/vitest.mjs` (v5.0.2) |
| ESLint | `/Users/robertsmith/dev/constructa-fresh-20261025/node_modules/eslint/bin/eslint.js` |
| TypeScript | `/Users/robertsmith/dev/constructa-fresh-20261025/node_modules/typescript/bin/tsc` |
| Temp | `TMPDIR=/tmp` |
| Worktree vitest symlinks | `node_modules/vitest`, `vite`, `vite-node`, `@vitest` → ROOT (pre-existing) |
| Runner handle (uncommitted) | `node_modules/.bin/vitest-runner.mjs` → ROOT `vitest/vitest.mjs` |
| Config | Existing `vitest.config.mts` / `tsconfig.json`; no config edits |

## Runtime-evidence blocker removed (no product/test edits)

Claude cq-2210 session could not execute vitest/tsc (non-interactive permission gate; recorded in cq-2210 doc). This run used direct Node invocation against ROOT packages with `TMPDIR=/tmp`. No source or test file was modified for verification.

## Immutable prior FAIL doc

| Path | SHA256 (unchanged) |
| --- | --- |
| `docs/reviews/cq-2210-a055-a063-readiness.md` | `e9c66ef37eda31c060757599e634e2aacc7d5184943ea5a44e353a639a3365a2` |

## SHA256 — 23 code paths (before = after)

| Path | SHA256 |
| --- | --- |
| `src/lib/job-assistant-readiness.ts` | `54846d3611d249c7fed984f6d1f579eedb3497ace933e6921ff2ae757fc56d5e` |
| `src/lib/server/job-assistant-readiness.test.ts` | `a44534ba067c9c30bc61e0f36806708cee8426c21ed6813d623826dc6595b5b0` |
| `src/app/dashboard/projects/job-assistant-readiness-pages.test.tsx` | `da43c914bef5980ca327c208861086769fb24320855ffb2fa81406aa9f6685c1` |
| `src/lib/server/job-assistant-transport.ts` | `cab179abd03a45a33e362f10dd13eaf2797943fb09e7b531315877cbe835f881` |
| `src/lib/server/job-assistant-ledger.ts` | `832341207abc805cf92070a3e0376e06ed64ff23de75a0b9d6d9f2884772a322` |
| `src/lib/server/job-assistant-generation.ts` | `671b0716afbec84e2a8bb27e41c7fac1f3c9928e7af401ab331664970c8c1e0e` |
| `src/lib/server/brief-request.ts` | `4f668f99ba7e79e6759877cb8685eadeaa090c58fe63f76495a054ab75333d8b` |
| `src/lib/server/pricing-request.ts` | `ec5e4e83f7140439e6c2baacb11c74cd44366c026994c427d7f263fd2ab910d6` |
| `src/lib/server/planning-request.ts` | `b0a57f98d4a64bfb80a7dfce8fed8e093db503f7efb5dc56cd3ecb3943fc1c1d` |
| `src/lib/reviewed-conversation.ts` | `b00a57a091f355bcb69742cef55543da1556f7947001eec5e28ae9ae31abf449` |
| `src/lib/pricing-conversation.ts` | `0781b77be18a9c444c635a7c4db31faa9ce092e38bbe1056015f2c9748b9a144` |
| `src/components/brief-conversation-panel.tsx` | `b9c5af0ccc1bab7df9381f44cf86fafd857609f8e6786406339eec33f07d968d` |
| `src/components/pricing-assistant-panel.tsx` | `16e482425d0456ed1a77d444b52b278a1bc52f08589d5ab6076fe7b4d460f201` |
| `src/components/planning-conversation-panel.tsx` | `4fd98b869d522415364b74ae1f207abb80d0fcf15c880974d1c4fca0eda39ba7` |
| `src/app/dashboard/projects/brief/assistant-actions.ts` | `80fd13ab027bb1280e8e2a2d87643461379ce3f53a7d484b48aad3d122911374` |
| `src/app/dashboard/projects/brief/brief-client.tsx` | `4a573877f79bee71daa08cb9f957165cda078f6f26ec6bc34304ff6dfa8df588` |
| `src/app/dashboard/projects/brief/page.tsx` | `dd2ae10748aba65e20c078ffe6b8502931b6ca348a7977d43e2a5443bf2e2fc6` |
| `src/app/dashboard/projects/costs/assistant-actions.ts` | `608e50f5a6a55009b71aa5d77656fbdf04da07cf0b88c1b76ad52fa73fdb42be` |
| `src/app/dashboard/projects/costs/estimate-client.tsx` | `ec8e4f59cd353e5b188698c1dbd11b97c1c5d874b2fe42d50e67184e8a98b0fd` |
| `src/app/dashboard/projects/costs/page.tsx` | `9c4e6b6d4706597169ac3890195f0cc949bee732e3f3032369d4ec677ce5fa30` |
| `src/app/dashboard/projects/schedule/assistant-actions.ts` | `68603f37db8de3955bba54679857f71da5cb0679bf1b77fe603636af0caab824` |
| `src/app/dashboard/projects/schedule/page.tsx` | `538dfd6644255665d3f552cf84fb07a3395f0282992c064cf54601e15567745d` |
| `src/app/dashboard/projects/schedule/simple-programme-client.tsx` | `0cf12babc252d69fb46b403b6ea0bda9116ca78af2e7beb75990067714ab283f` |

This file is new evidence only.

## Scope executed

- Vitest: new CQ-2210 tests, then the 12 shared integration files listed in cq-2210 review (material retained coverage).
- ESLint: 20 changed production paths only.
- TypeScript: full project `tsc --noEmit --incremental false`.
- Not run: baseline RED at `24b9dcd`, Next build, whole-app suite, live DB/auth/browser/settings.

## 1. Vitest — new tests

**cwd:** worktree above

**argv:**

```text
/usr/local/bin/node /Users/robertsmith/dev/constructa-fresh-20261025/node_modules/vitest/vitest.mjs run --cache=false src/lib/server/job-assistant-readiness.test.ts src/app/dashboard/projects/job-assistant-readiness-pages.test.tsx --reporter=verbose
```

**env:** `TMPDIR=/tmp`

**exit code:** `0`

**stdout (raw):**

```text

 RUN  v5.0.2 /Users/robertsmith/dev/constructa-fresh-20261025/.cq-wt/cq-0711-a089-fixture-cause

 ✓ src/app/dashboard/projects/job-assistant-readiness-pages.test.tsx > CQ-2210 Brief page readiness > tells the owner which prerequisite is missing when the ledger refuses the QA approval 4ms
 ✓ src/app/dashboard/projects/job-assistant-readiness-pages.test.tsx > CQ-2210 Brief page readiness > gives no reason to a viewer who does not own the job, and no more availability 1ms
 ✓ src/app/dashboard/projects/job-assistant-readiness-pages.test.tsx > CQ-2210 Brief page readiness > offers the assistant with no reason once every prerequisite is met 1ms
 ✓ src/app/dashboard/projects/job-assistant-readiness-pages.test.tsx > CQ-2210 Brief page readiness > leaves Production as it was: off, unexplained, no ledger read 0ms
 ✓ src/app/dashboard/projects/job-assistant-readiness-pages.test.tsx > CQ-2210 Estimating page readiness > tells the owner which prerequisite is missing when the ledger refuses the QA approval 0ms
 ✓ src/app/dashboard/projects/job-assistant-readiness-pages.test.tsx > CQ-2210 Estimating page readiness > gives no reason to a viewer who does not own the job, and no more availability 0ms
 ✓ src/app/dashboard/projects/job-assistant-readiness-pages.test.tsx > CQ-2210 Estimating page readiness > offers the assistant with no reason once every prerequisite is met 0ms
 ✓ src/app/dashboard/projects/job-assistant-readiness-pages.test.tsx > CQ-2210 Estimating page readiness > leaves Production as it was: off, unexplained, no ledger read 0ms
 ✓ src/app/dashboard/projects/job-assistant-readiness-pages.test.tsx > CQ-2210 Programme page readiness > tells the owner which prerequisite is missing when the ledger refuses the QA approval 0ms
 ✓ src/app/dashboard/projects/job-assistant-readiness-pages.test.tsx > CQ-2210 Programme page readiness > gives no reason to a viewer who does not own the job, and no more availability 0ms
 ✓ src/app/dashboard/projects/job-assistant-readiness-pages.test.tsx > CQ-2210 Programme page readiness > offers the assistant with no reason once every prerequisite is met 0ms
 ✓ src/app/dashboard/projects/job-assistant-readiness-pages.test.tsx > CQ-2210 Programme page readiness > leaves Production as it was: off, unexplained, no ledger read 0ms
 ✓ src/app/dashboard/projects/job-assistant-readiness-pages.test.tsx > CQ-2210 panels > Brief names the missing prerequisite in the visible summary and the open panel 4ms
 ✓ src/app/dashboard/projects/job-assistant-readiness-pages.test.tsx > CQ-2210 panels > Planning names the missing prerequisite in the visible summary and the open panel 1ms
 ✓ src/app/dashboard/projects/job-assistant-readiness-pages.test.tsx > CQ-2210 panels > Pricing names the missing prerequisite in the visible summary and the open panel 1ms
 ✓ src/app/dashboard/projects/job-assistant-readiness-pages.test.tsx > CQ-2210 panels > Brief keeps today's words for no reason and for no approval 0ms
 ✓ src/app/dashboard/projects/job-assistant-readiness-pages.test.tsx > CQ-2210 panels > Planning keeps today's words for no reason and for no approval 0ms
 ✓ src/app/dashboard/projects/job-assistant-readiness-pages.test.tsx > CQ-2210 panels > Pricing keeps today's words for no reason and for no approval 0ms
 ✓ src/app/dashboard/projects/job-assistant-readiness-pages.test.tsx > CQ-2210 panels > Brief ignores a reason while the assistant is available 0ms
 ✓ src/app/dashboard/projects/job-assistant-readiness-pages.test.tsx > CQ-2210 panels > Planning ignores a reason while the assistant is available 0ms
 ✓ src/app/dashboard/projects/job-assistant-readiness-pages.test.tsx > CQ-2210 panels > Pricing ignores a reason while the assistant is available 0ms
 ✓ src/lib/server/job-assistant-readiness.test.ts > CQ-2210 readiness names the missing prerequisite on the one activation contract > the emergency stop > agrees across availability, generation and all three real handlers, and touches nothing 6ms
 ✓ src/lib/server/job-assistant-readiness.test.ts > CQ-2210 readiness names the missing prerequisite on the one activation contract > no approval on this target > agrees across availability, generation and all three real handlers, and touches nothing 1ms
 ✓ src/lib/server/job-assistant-readiness.test.ts > CQ-2210 readiness names the missing prerequisite on the one activation contract > an approval that fails the schema > agrees across availability, generation and all three real handlers, and touches nothing 2ms
 ✓ src/lib/server/job-assistant-readiness.test.ts > CQ-2210 readiness names the missing prerequisite on the one activation contract > features stating different monthly caps > agrees across availability, generation and all three real handlers, and touches nothing 3ms
 ✓ src/lib/server/job-assistant-readiness.test.ts > CQ-2210 readiness names the missing prerequisite on the one activation contract > a provider with no adapter > agrees across availability, generation and all three real handlers, and touches nothing 1ms
 ✓ src/lib/server/job-assistant-readiness.test.ts > CQ-2210 readiness names the missing prerequisite on the one activation contract > the provider's key missing > agrees across availability, generation and all three real handlers, and touches nothing 1ms
 ✓ src/lib/server/job-assistant-readiness.test.ts > CQ-2210 readiness names the missing prerequisite on the one activation contract > no settings row > agrees across availability, generation and all three real handlers, and touches nothing 1ms
 ✓ src/lib/server/job-assistant-readiness.test.ts > CQ-2210 readiness names the missing prerequisite on the one activation contract > the ledger table missing (PostgREST) > agrees across availability, generation and all three real handlers, and touches nothing 1ms
 ✓ src/lib/server/job-assistant-readiness.test.ts > CQ-2210 readiness names the missing prerequisite on the one activation contract > the ledger table missing (Postgres) > agrees across availability, generation and all three real handlers, and touches nothing 1ms
 ✓ src/lib/server/job-assistant-readiness.test.ts > CQ-2210 readiness names the missing prerequisite on the one activation contract > the ledger disabled, as the migration ships > agrees across availability, generation and all three real handlers, and touches nothing 1ms
 ✓ src/lib/server/job-assistant-readiness.test.ts > CQ-2210 readiness names the missing prerequisite on the one activation contract > the ledger disabled with ceilings set > agrees across availability, generation and all three real handlers, and touches nothing 1ms
 ✓ src/lib/server/job-assistant-readiness.test.ts > CQ-2210 readiness names the missing prerequisite on the one activation contract > ceilings not set > agrees across availability, generation and all three real handlers, and touches nothing 1ms
 ✓ src/lib/server/job-assistant-readiness.test.ts > CQ-2210 readiness names the missing prerequisite on the one activation contract > a ceiling below the approved monthly cap > agrees across availability, generation and all three real handlers, and touches nothing 1ms
 ✓ src/lib/server/job-assistant-readiness.test.ts > CQ-2210 readiness names the missing prerequisite on the one activation contract > a ceiling below the approved attempt > agrees across availability, generation and all three real handlers, and touches nothing 1ms
 ✓ src/lib/server/job-assistant-readiness.test.ts > CQ-2210 readiness names the missing prerequisite on the one activation contract > a failed settings read > agrees across availability, generation and all three real handlers, and touches nothing 1ms
 ✓ src/lib/server/job-assistant-readiness.test.ts > CQ-2210 readiness names the missing prerequisite on the one activation contract > no service-role client > agrees across availability, generation and all three real handlers, and touches nothing 2ms
 ✓ src/lib/server/job-assistant-readiness.test.ts > CQ-2210 readiness names the missing prerequisite on the one activation contract > the ledger failing to construct > agrees across availability, generation and all three real handlers, and touches nothing 1ms
 ✓ src/lib/server/job-assistant-readiness.test.ts > CQ-2210 readiness names the missing prerequisite on the one activation contract > with every prerequisite met, each feature is offered and a turn source runs one recorded attempt 3ms
 ✓ src/lib/server/job-assistant-readiness.test.ts > CQ-2210 readiness names the missing prerequisite on the one activation contract > reads the settings row once for one readiness answer and never writes 0ms
 ✓ src/lib/server/job-assistant-readiness.test.ts > CQ-2210 readiness names the missing prerequisite on the one activation contract > stays fail-closed for a ledger that only answers covers 0ms
 ✓ src/lib/server/job-assistant-readiness.test.ts > CQ-2210 readiness names the missing prerequisite on the one activation contract > keeps the ledger's covers answer the same as its readiness, for every row 0ms
 ✓ src/lib/server/job-assistant-readiness.test.ts > CQ-2210 only the job's owner is told why > withholds the reason from anyone but the verified owner, with the same availability 0ms
 ✓ src/lib/server/job-assistant-readiness.test.ts > CQ-2210 only the job's owner is told why > never reaches readiness for a signed-out or stale request 0ms
 ✓ src/lib/server/job-assistant-readiness.test.ts > CQ-2210 the server's own activation on real targets (stubbed environment, fake database) > QA with the approval and key: no settings row is named on the real Server Actions and nothing is reserved 1ms
 ✓ src/lib/server/job-assistant-readiness.test.ts > CQ-2210 the server's own activation on real targets (stubbed environment, fake database) > QA with the approval and key: the shipped disabled row is named on the real Server Actions and nothing is reserved 0ms
 ✓ src/lib/server/job-assistant-readiness.test.ts > CQ-2210 the server's own activation on real targets (stubbed environment, fake database) > QA with the approval and key: ceilings below the QA caps is named on the real Server Actions and nothing is reserved 0ms
 ✓ src/lib/server/job-assistant-readiness.test.ts > CQ-2210 the server's own activation on real targets (stubbed environment, fake database) > QA with the approval but key "" says the provider is not connected, before any ledger client 0ms
 ✓ src/lib/server/job-assistant-readiness.test.ts > CQ-2210 the server's own activation on real targets (stubbed environment, fake database) > QA with the approval but key "   " says the provider is not connected, before any ledger client 0ms
 ✓ src/lib/server/job-assistant-readiness.test.ts > CQ-2210 the server's own activation on real targets (stubbed environment, fake database) > Production stays unapproved with the same key and URL: generic words, and no ledger client 0ms
 ✓ src/lib/server/job-assistant-readiness.test.ts > CQ-2210 the server's own activation on real targets (stubbed environment, fake database) > an emergency stop outranks a ready ledger on the real path 0ms
 ✓ src/lib/server/job-assistant-readiness.test.ts > CQ-2210 the conversation shows the server's explanation when a turn goes off > planning, on the real handler 1ms
 ✓ src/lib/server/job-assistant-readiness.test.ts > CQ-2210 the conversation shows the server's explanation when a turn goes off > pricing, on the real handler 1ms
 ✓ src/lib/server/job-assistant-readiness.test.ts > CQ-2210 the conversation shows the server's explanation when a turn goes off > the wording itself carries no key, project, provider or service detail 0ms

 Test Files  2 passed (2)
      Tests  54 passed (54)
   Start at  22:22:06
   Duration  496ms (transform 63%, import 31%, tests 6%, worker 1%)

```

## 2. Vitest — shared integration (material retained coverage)

**argv:**

```text
/usr/local/bin/node /Users/robertsmith/dev/constructa-fresh-20261025/node_modules/vitest/vitest.mjs run --cache=false src/lib/server/job-assistant-request.test.ts src/lib/server/deepseek-job-assistant.test.ts src/lib/server/brief-request.test.ts src/lib/server/pricing-request.test.ts src/lib/pricing-conversation.test.ts src/lib/pricing-assistant-session.test.ts src/lib/planning-conversation.test.ts src/components/pricing-assistant-panel.test.tsx src/components/planning-conversation-panel.test.tsx src/app/dashboard/projects/brief/brief-assistant-request.test.tsx src/app/dashboard/projects/costs/pricing-assistant-request.test.tsx src/app/dashboard/projects/schedule/planning-assistant-request.test.tsx --reporter=verbose
```

**env:** `TMPDIR=/tmp`

**exit code:** `1`

**summary (raw tail):**

```text
 Test Files  1 failed | 11 passed (12)
      Tests  1 failed | 274 passed (275)
   Start at  22:22:09
   Duration  1.64s (transform 54%, import 33%, tests 13%, worker 1%)

  Transform  transforming modules took 3.82s · 54% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns

EXIT:1
```

**failure (raw):**

```text
 FAIL  src/lib/planning-conversation.test.ts > no hidden writes or reused authority > is mounted without a default generator
AssertionError: expected 'import { createClient } from "@/lib/s…' to contain 'planningAssistantEnabled={await jobAs…'

- Expected
+ Received

- planningAssistantEnabled={await jobAssistantAvailable("planning")}
+ import { createClient } from "@/lib/supabase/server";
+ …
+     const assistant = await jobAssistantReadiness("planning", { owner: project.user_id === user.id });
+ …
+                 planningAssistantEnabled={assistant.available}
+                 planningAssistantOffReason={assistant.offReason}
+ …

 ❯ src/lib/planning-conversation.test.ts:261:22
    261|         expect(page).toContain('planningAssistantEnabled={await jobAss…
```

**Cause (factual, not repaired here):** `schedule/page.tsx` now uses `jobAssistantReadiness` and passes `assistant.available` / `assistant.offReason`; the retained test still asserts the old `jobAssistantAvailable("planning")` string in page source.

274 other assertions in this batch passed.

## 3. ESLint (20 changed production paths)

**argv:**

```text
/usr/local/bin/node /Users/robertsmith/dev/constructa-fresh-20261025/node_modules/eslint/bin/eslint.js src/lib/job-assistant-readiness.ts src/lib/server/job-assistant-transport.ts src/lib/server/job-assistant-ledger.ts src/lib/server/job-assistant-generation.ts src/lib/server/brief-request.ts src/lib/server/pricing-request.ts src/lib/server/planning-request.ts src/lib/reviewed-conversation.ts src/lib/pricing-conversation.ts src/components/brief-conversation-panel.tsx src/components/pricing-assistant-panel.tsx src/components/planning-conversation-panel.tsx src/app/dashboard/projects/brief/assistant-actions.ts src/app/dashboard/projects/brief/brief-client.tsx src/app/dashboard/projects/brief/page.tsx src/app/dashboard/projects/costs/assistant-actions.ts src/app/dashboard/projects/costs/estimate-client.tsx src/app/dashboard/projects/costs/page.tsx src/app/dashboard/projects/schedule/assistant-actions.ts src/app/dashboard/projects/schedule/page.tsx src/app/dashboard/projects/schedule/simple-programme-client.tsx
```

**exit code:** `0`

**stdout (raw):**

```text

/Users/robertsmith/dev/constructa-fresh-20261025/.cq-wt/cq-0711-a089-fixture-cause/src/app/dashboard/projects/costs/estimate-client.tsx
  298:34  warning  Error: Calling setState synchronously within an effect can trigger cascading renders
  … react-hooks/set-state-in-effect

✖ 1 problem (0 errors, 1 warning)

```

## 4. TypeScript

**argv:**

```text
/usr/local/bin/node /Users/robertsmith/dev/constructa-fresh-20261025/node_modules/typescript/bin/tsc --noEmit --incremental false
```

**cwd:** worktree

**exit code:** `2`

**stdout (raw):**

```text
src/app/dashboard/projects/job-assistant-readiness-pages.test.tsx(116,99): error TS1501: This regular expression flag is only available when targeting 'es2018' or later.
```

**stderr:** *(empty)*

## Failures (verification verdict)

| Check | Result |
| --- | --- |
| New CQ-2210 vitest (54 tests) | PASS (exit 0) |
| Shared integration vitest (275 tests) | **FAIL** — 1 failed (`planning-conversation.test.ts`), exit 1 |
| ESLint changed production paths | PASS with 1 pre-existing-style warning (exit 0) |
| `tsc --noEmit` | **FAIL** — TS1501 in new page test at line 116 (exit 2) |

No fixes, skips, or test weakening were applied in this verification pass.

## Limitations

1. **No baseline RED** at `24b9dcd` — not run; not fabricated.
2. **`/usr/local/bin/node24`** missing; used `/usr/local/bin/node` v24.19.0 with ROOT dependencies (same pattern as cq-2216 A038 verification).
3. **Grok whole-source audit** is out of scope for this document (execution evidence only).
4. **Hosted QA** (live ledger row, real provider, browser) remains unproven.
