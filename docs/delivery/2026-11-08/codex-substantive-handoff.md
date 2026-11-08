# Codex substantive offline handoff — 8 November 2026

Branch `codex/evidence-20261108-1020`, starting source `4116d1349a0ee89c904d0e41cac8acca66e5dc38`. QuantFund priority. This is source/offline evidence, not hosted, real-email, human, DB, restoration or release acceptance. No canonical register/dashboard changed. No Cursor integration source was copied or reimplemented.

## Packaging and scope

The requested first action packaged only `docs/delivery/2026-11-08/codex-evidence-a079-a089-a096.md`: commit `e9b49c1`, successful `git push origin codex/evidence-20261108-1020` (new branch). Its final packaging paragraph describes the earlier invocation's failure, not this continuation. A subsequent `git ls-remote origin refs/heads/codex/evidence-20261108-1020` failed with `Could not resolve host: github.com` (exit 128). Remote actions stopped, without alternate routes or retries. Consequently the substantive continuation commit is local only; independent remote SHA confirmation is unavailable.

Inbox continuation ACK appended without clearing anything. Inbox read through Python in full; initial terminal rendering was truncated, so material lines were separately extracted. Latest exact user restrictions govern this continuation. The private record destination is outside writable roots, so this assigned docs path preserves material direction: recovery/checker adversarial tests only; synthetic timeout investigation; comprehensive source analytics/newsletter audit; concrete A020/A025/A026/A097 plans; no implementation duplication, settings, real Git repair, provider activation, build or live acceptance.

## A079 — test-gap audit

Reviewed `scripts/recovery-manifest-check.mjs`, its test file and the prior evidence document. Existing cases already cover conflicting same-repository refs, equal ref names in different repositories, missing refs/SHA mismatch, unsafe paths, credential-shaped manifest values, storage orphan/conflict/exact-repeat identity, owned waivers, missing/modified/resized files and symlink escapes. Do not duplicate Cursor `a3ec486` integration.

Added two missing adversarial regressions: NFC-equivalent Unicode export paths collide on restore; a directory replacing an expected byte file is refused. Both pass on current checker without product changes. The complete focused checker file passed 31 tests.

Important remaining source limits: `COMPLETE_SET` means internal manifest consistency, not actual recovery. The checker does not require a nonempty `git.requiredRefs`, establish repository completeness or validate bundle history against source. An operator can omit a repository from both lists without this checker discovering it. `bytesVerified` indicates that byte verification was requested; callers must also inspect verdict/errors. No manifest result proves deployed identity, independent media, private edits, LFS completeness, source inventories, Auth/Storage/DB recovery or a restored application. These are runbook/operator evidence requirements, not a reason to rewrite Cursor's ref fix.

Owner/next action: RC integration owner carries the existing reviewed ref fix; authorised recovery operator later supplies independently reconciled repo/ref/SHA inventories and read-back evidence under Rob's export/restore authority. A079 remains Partial.

## A089 — discriminating synthetic evidence

Inspected `e2e/import-fixture/guard.test.ts`. This branch uses asynchronous `execFile`, 4000ms per-command deadline and SIGKILL, with an existing 200ms synthetic stalled executable case. It does not contain the per-command fsmonitor exclusions described in historical `6938141` evidence; no verdict on that separate implementation is inferred.

Ran only the existing synthetic stall case, not repository/scratch-Git checks. Added and ran one test with a fake executable exiting 23 and a nonexistent executable. It verifies that stderr/exit code and ENOENT remain distinguishable from a killed deadline. No real Git index manipulation, repo repair, threshold increase or Git configuration changes were performed. Temporary fake files were created/cleaned only by the focused tests.

Hypotheses and limits:

| Hypothesis | Discriminating observation | Current evidence |
| --- | --- | --- |
| Child command stalls | elapsed deadline plus signal/killed | synthetic kill case passes; historical cause unproved |
| Git exits with error | nonzero code and stderr, rather than timeout | synthetic exit23 case passes; no historical stderr available |
| executable unavailable | ENOENT | synthetic case passes; not asserted as original cause |
| index invisibility / wrong fixture root | command output versus expected tracked sentinel | existing source cases exist; not rerun here |
| fsmonitor/cache/platform or resource pressure | same fixture/command fixed and unfixed under original failing conditions | historical Mac fixed/unfixed both passed; no causal discrimination |
| several sequential commands consume a case budget | per-command and total-case timestamps | 4000ms command budget alone does not bound a multi-command case below 5000ms |

The historical 9/9 Mac returns (fixed 0.49s, unfixed 0.54s) remain contrary to claiming a reproduced fix. Next evidence needed is the existing original failing trace with command, fixture identity, elapsed stage, signal/exit and platform. No new unchanged qualification loop is recommended. A089 remains Partial.

## A096 — source analytics and newsletter audit

| Surface | Semantics and duplicate/privacy boundary |
| --- | --- |
| `src/app/page.tsx`, `src/app/landing/page.tsx` | Select full legacy marketing versus `PhaseOneHome` by launch profile. A legacy integration's existence does not show cohort routes use it. Runtime profile was not read. |
| `src/app/layout.tsx`, `behavioral-tracking-boundary.test.tsx` | Existing removal/boundary coverage for global Plausible/Clarity. No collector activation or hosted network assertion here. |
| `src/lib/public-measurement.ts` | Three typed events; collection disabled; no loader/beacon/persistence/provider forwarding. Test sink sees sanitized properties only. Browser pathname overrides stale caller path; explicit public routes only. No deduplication/session attribution. |
| `full-home.tsx` contact handler | Formspree POST; `ContactFormSubmit` only after `response.ok`, not click, rejection or thrown network error. Means endpoint accepted response, not inbox delivery or consent to marketing. Existing wiring tests already cover these paths. Multiple accepted submissions can emit multiple events. |
| `full-home.tsx` CTA handlers | Four named locations feed `TryConstructaClick`; navigation intent only, not account creation/activation. Repeated clicks are repeated events. |
| `full-landing.tsx` | Existing ConvertKit loader plus external subscription form; `WaitlistSubmitAttempt` on submit, no provider confirmation callback. Not verified double opt-in, confirmed subscriber, newsletter consent or delivery. Provider script behaviour is outside the typed no-op collector contract. |
| `src/app/admin/page.tsx` | Existing Plausible reporting queries and account metrics, not a collection loader. Calendar-month signups divided by rolling 30-day visitors is an unattributed mixed-window ratio. UI in website/growth tabs already states this limitation. |
| historical marketing analytics/content plan | Reusable proposal only. No provider choice, legal approval, configured list, suppression, sender ownership or retention verified. |

Added eight analytics regression cases: sensitive extras are discarded, unknown runtime event refused, six private/lookalike routes cannot be overridden, and repeated waitlist attempts remain attempts rather than unique conversion claims. Query/hash and form contents are not forwarded by this module. These tests use an injected sink, not a provider. Existing wiring tests already cover acceptance/rejection/network failures and attempt-only naming; no duplicate replacement instrumentation was added.

Privacy boundaries: do not enable a root collector across contractor/dashboard/admin/auth/proposal routes; do not forward email, project/brief text, quote amounts, company tax/payroll, proposal tokens or raw URL query/fragment. Route allowlisting is not consent approval. Kit/Formspree intentionally receive user form fields through separate mechanisms; disabling public measurement does not establish that these integrations are absent or approved. No account/provider configuration, credentials or environment files were read.

Newsletter next owner: later A101 owner reviews existing form/list purpose, explicit optional opt-in, privacy copy, confirmation, unsubscribe/suppression, retention/deletion and operator ownership with Rob before activation. Keep product waitlist and editorial newsletter purposes distinct. No imports, messages or external form submissions occurred. A096 remains Partial.

## Concrete later-release plans

All four IDs are Later in the read-only register. These are implementable plans, not new Phase 1 RC gates or completed features.

### A020 — useful resource and financial metrics

Owner: product/engineering owner assigned by RC leads. Reuse resource staff/plant/portfolio routes and existing financial helpers; inventory inputs and permission boundaries first. Deliver a metric dictionary and one integrated synthetic dashboard slice: committed workload/capacity (hours per week), estimate cost versus recorded actual (currency excluding/including VAT explicitly), and missing-data state. Avoid invented utilisation or zero actual costs when no records exist.

Acceptance: a synthetic two-project example reconciles to its underlying rows; date filters affect the same time basis; units/currency and as-of date are visible; absent data is unavailable rather than zero; another contractor cannot see the metrics; mobile presentation has no empty placeholder panels. Dependencies: agreed actual-cost/resource source, project/tenant permissions, calendar/capacity definitions and product priority. Ship after those sources exist; no new collection implied now.

### A025 — regional/discipline benchmarks

Owner: product/data owner. Start with `profile-form.tsx` benchmark consent checkbox, `src/app/api/v1/benchmarks/route.ts`, launch-profile capability and admin benchmark views. The checkbox describes contributing anonymised archived-project data; its presence does not prove a collector or anonymisation pipeline. Reconcile wording, persistence, consumer and cohort gate before adding another choice.

Acceptance: documented field-to-consumer map; opt-out/withdrawal behaviour defined; no contribution from nonconsenting contractors; synthetic regional/trade samples show provenance, age, sample count, units and inclusion rules; sparse samples are suppressed; price and programme durations are separate distributions, not unsupported market-rate promises. Dependencies: privacy review, aggregation/reidentification policy, representative licensed data and regional taxonomy. Later-release only; do not activate the existing API or contribution pipeline for RC.

### A026 — customer insights and estimate versus actual

Owner: product/data owner with privacy review. Deliver a versioned dictionary for estimated quantity/unit rate/cost, observed actual cost/duration, missing activity reason and revision/time context. Record unknown actuals distinctly; separate scope changes from estimating error. Synthetic example: estimate1000, actual1200 gives variance200 /20%; unknown actual yields unavailable, not -100%.

Acceptance: synthetic calculations reproduce from rows; currency/VAT/unit/time-basis mismatch is rejected or explicitly converted; amendments and missing activities retain provenance; access/export/deletion rules are documented; no raw confidential project text enters cross-customer analytics; aggregation minima are reviewed. Dependencies: reliable actuals source, A025 consent reconciliation, retention policy and permission model. Phase 1 can retain existing data without starting future customer-insight collection.

### A097 — acquisition and conversion measurement

Owner: growth/product owner with engineering. Reuse public event contract and existing reporting work. First deliver an event dictionary and primary-tool decision comparing existing Plausible against required public reporting, review exclusions, data minimisation and operating cost. No tool is selected or activated by this audit.

Proposed funnel: eligible public visit → CTA intent → server-confirmed account creation → defined activation → first acknowledged proposal milestone. Distinguish contact endpoint acceptance, waitlist attempt and confirmed subscriber; none substitutes for account creation. Use one timezone and reporting interval. Define numerator, denominator, identity boundary and event-specific deduplication before implementation; a repeated click/attempt is allowed as activity but cannot inflate unique account conversion. Avoid joining confidential project payloads or email addresses into marketing analytics.

Acceptance: synthetic sequences with retries/double clicks yield one acknowledged account/milestone conversion, while attempts remain countable; failed/refused actions emit no success; private/review routes and sensitive properties are excluded; denominator/window match; deletion/consent/provider review complete; report labels explain unattributed totals. Dependencies: authorised provider/privacy decision and reliable server success receipts; later authenticated validation needs separate authority. Existing no-op dispatch must remain disabled until that reviewed increment.

## Exact fresh validation

Runtime `node --version`: v26.12.1. This is not original Node24 build evidence. No full build, install, dev server or full suite ran.

Before every test group Python checked `shutil.disk_usage('.').free/2**30 >= 16`: 20.138, 20.129 and 20.121 GiB respectively.

1. `node --test --test-concurrency=1 scripts/recovery-manifest-check.test.mjs` — 31 passed, 0 failed, 364.695ms.
2. `node /Users/robertsmith/dev/constructa-fresh-20261025/node_modules/vitest/vitest.mjs run --config /private/tmp/constructa-codex-evidence-vitest.mjs src/lib/public-measurement.test.ts e2e/import-fixture/guard.test.ts -t 'adversarial public measurement inputs|deadline when the command stalls'` — 2 files passed; 9 passed, 13 skipped, 476ms.
3. Same Vitest command/config, only `e2e/import-fixture/guard.test.ts -t 'distinguishes a synthetic command failure'` — 1 passed, 9 skipped, 389ms.

Temporary config uses this exact worktree as root, node environment, maxWorkers1/fileParallelismfalse and aliases `@` to this worktree src and `vitest` to the existing live repo installation. Shared dependencies used read-only; no copy/install/new node_modules. No actual Git commands run by the selected A089 cases. The unselected cases are not claimed passed. No unchanged tests repeated.

Packaging checks: `git diff --check`; changed-file review and explicit-path staging only. The intended continuation commit covers three test files and this handoff; it was NOT created. No source implementation changes; no build acceptance claimed. Remote push of this continuation is blocked by the observed DNS failure, with no retry under the user's stop rule.


Final packaging result: explicit-path `git add -- scripts/recovery-manifest-check.test.mjs src/lib/public-measurement.test.ts e2e/import-fixture/guard.test.ts docs/delivery/2026-11-08/codex-substantive-handoff.md` failed creating the assigned worktree `index.lock`: Operation not permitted. The subsequent commit command also failed with that error; no commit was created. No permissions workaround or retry followed. Final status: three modified test files and untracked handoff remain locally; only initial e9b49c1 is pushed. Scoped four-file credential-pattern check passed (limited private-key/GitHub/AWS patterns, not comprehensive history validation). `git diff --check` passed. Earlier successful metadata access does not override this actual failure. Stop packaging and hand these exact paths to the authorised owner.
