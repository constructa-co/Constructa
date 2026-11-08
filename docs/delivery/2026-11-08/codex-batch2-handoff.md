# Codex batch 2 — measurement scope and evidence handoff

8 November 2026, 12:00 UAE allocation. Tool: Codex exec tools; owned branch `codex/evidence-20261108-1020`; starting HEAD `2d3f26e`. Initial worktree clean. This document preserves the current material directions because the private execution-record directory is outside this run's writable roots. No canonical register/dashboard mutation.

Rob's current scope, in order: A097 concrete acquisition/conversion event and attribution evidence plan grounded in source, offline tests only; A025 benchmark checkbox/source reconciliation and scope; A026 measurement design; A020 scope/acceptance; optional A089 causal gaps, document only. QuantFund has priority. Maximum 90 minutes, no artificial delay; approximately 2 points/hour ceiling, actual points not exposed by these tools. No collector, builds, installs, new worktree/dependencies, servers, live SQL, credentials, external messages, main/production writes, commits or pushes authorised. Coordinator owns later packaging on this branch. No integration claim follows from this document.

## A097 — decision and concrete evidence contract

Keep the existing inert typed contract. Reuse the existing specification's proposed Plausible choice for a future public collector increment; do not enable it here. This is a source-grounded continuation of `docs/marketing/public-measurement-spec.md`, not new vendor research or a claim about current vendor features, pricing or configured accounts. No additional tracker is justified by the three currently wired outcomes. Search Console setup and newsletter-provider confirmation remain separate work.

### Current event inventory

| Contract/event | Exact source boundary | Evidence meaning and missing scope |
| --- | --- | --- |
| `TryConstructaClick`, `{location}` | `src/components/marketing/full-home.tsx:285,331,427,636`; four literal section tokens | Repeated CTA clicks, not unique visitors or account creation. `solution`, `apart`, `how-it-works`, `about` only. |
| `ContactFormSubmit`, `{}` | Same file:187–188, after HTTP `response.ok` | Endpoint acceptance; no email delivery, human response or CRM acceptance evidence. |
| `WaitlistSubmitAttempt`, `{}` | `src/components/marketing/full-landing.tsx:141`, form `onSubmit` | Attempt only; no successful subscription/double opt-in receipt. |
| Public route guard and sanitizer | `src/lib/public-measurement.ts` | Exact public allowlist plus `/guides` descendants; current browser pathname wins over caller override; strips everything except valid CTA token. |
| Production collection | Same module; disabled constant, dispatch ends with optional test sink | No production forwarder, loader, storage or transport is implemented by this module. Flipping the constant alone cannot implement collection. |
| Active marketing branch | `src/app/page.tsx`, `src/app/landing/page.tsx` | Both choose legacy full marketing or `PhaseOneHome` by launch profile. These three callsites are in full components; cannot infer cohort coverage from their existence. No runtime configuration read. |

A097 remains **Partial / Later**. The present contract neither counts page views nor carries acquisition channel, session identity, campaign, signup or proposal outcomes. Route allowance is permission for dispatch, not evidence that every allowed route has a handler. Do not derive counts from tests or infer visitors from click totals.

### Proposed reporting dictionary (design only)

| Measure | Numerator / denominator / time basis | Receipt and interpretation |
| --- | --- | --- |
| Public engagement | Count valid CTA events by location and UTC day | Event occurrence count only. No unique-user denominator currently exists. |
| Contact acceptance rate | Accepted contact responses / actual submit attempts in same period | Only accepted numerator exists today. Add a reviewed attempt boundary before showing a rate; rejection/transport failure are not acceptances. |
| Newsletter completion | Confirmed provider subscriptions / submitted attempts for a matured cohort | Attempt exists, confirmation does not. Until verified provider receipt exists, report attempts only. |
| Public acquisition | Public eligible visits by coarse approved channel and UTC day | No current visit/channel contract. Future loader must obey route and review/consent policy; do not auto-inherit all provider page capture. |
| Signup conversion | Deduplicated account-created receipts / eligible attributed visits within a declared window | No current join. Real signup is outside this batch. Anonymous public events cannot establish this rate. |
| Product activation | Account cohort reaching first acknowledged estimate save or first durable proposal within declared window | Future private operational aggregate, not public behavioural tracking. Define milestone/receipt with the product owner before instrumentation. |

Keep public marketing analytics and private operational measures separate in purpose and access. A future join requires an explicit reviewed privacy/data decision and a minimal server-side linkage design; do not put account/project identifiers or proposal tokens into public events. If linkage is not approved, display separate aggregate trends and label them **unattributed**.

The admin ratio described in the existing spec (calendar-month signup count / rolling-30-day visitors) is a mixed-window, unlinked ratio. It cannot establish signup conversion. A proposed conversion report must show UTC start/end, eligible denominator, matured observation window, bot/internal/review exclusions, receipt source, dedup rule, unknown attribution count and late-event policy together.

### Attribution plan to review before implementation

1. Default to aggregate, unlinked reporting. Unknown/direct remains an explicit bucket; never guess a channel from missing data.
2. For public acquisition only, propose a fixed allowlist of campaign tokens supplied by approved published links, plus a coarse source class. Raw query strings, arbitrary UTM values, complete referrer URLs, email, form text, user IDs and private route names remain excluded. The current contract accepts **none** of these new properties.
3. Product/data owner chooses first versus last eligible public touch and a declared observation window using the actual campaign question. These are unresolved design choices, not implemented defaults. Do not claim cross-device or cross-session attribution.
4. Server-confirmed milestones, if later approved, require a stable receipt identity for idempotent counting. Repeated clicks/attempts retain occurrence semantics. A request retry cannot mint a second account-created or proposal milestone; edits to one proposal cannot masquerade as new acquisition.
5. Privacy owner decides collection notice/consent, retention, export/deletion, processor configuration and review-mode exclusion before activation. The server review-layout guard is not a client collector gate. This run does not verify privacy compliance or remote collection state.

### Bounded implementation/evidence slices for the owner

- **Slice 1, offline coverage:** inventory the intended launch profile's actual CTA and form boundaries. Synthetic accepted/rejected/thrown responses must yield correct events; absent sink must cause no network/storage; navigation into private pages must stop events. Existing wiring tests are reusable; do not repeat unchanged tests for volume.
- **Slice 2, reviewed collector:** only after explicit authority, implement a fail-closed transport with positive public-route gating, minimal properties, review exclusion and provider-independent contract tests. Verify no automatic private-page pageviews, no duplicate global/route loader and no capture of queries/fragments. Required deployed evidence must name exact candidate, profile and network destinations; not supplied here.
- **Slice 3, honest reports:** align observation windows, report unknown attribution, validate synthetic duplicates/retries/late receipts and distinguish attempts, accepted responses and confirmed outcomes. A real-email/hosted run requires separate authority. No test sink output can substitute for it.

Owner: Codex evidence owner delivers this plan; product/marketing owner selects report definitions; privacy owner and Rob approve activation boundaries; integration owner packages only accepted source on the assigned branch. No external dispatch made.

## A025 — checkbox reconciliation and benchmark scope

Register snapshot read only: A025 is Later/Partial. Existing source is broader than a checkbox but narrower than reliable regional/discipline pricing intelligence:

| Layer | Actual source | Consequence for scope |
| --- | --- | --- |
| Consent UI | `src/app/dashboard/settings/profile/profile-form.tsx:835–857` | Optional `data_consent`, false if absent; text promises anonymised archived-project figures, no company/client/contact details, and no retroactive removal. |
| Persistence construction | `src/lib/profile-update.ts:44–45` | Form literal `true` maps to boolean and current timestamp; unchecked maps false/null. This is source mapping, not a DB save/read-back receipt or versioned consent history. |
| Archive producer | `supabase/migrations/20260930180000_harden_legacy_definer_functions.sql:28–118`; original trigger installation in `20260409100000_sprint42_benchmarks.sql` | On transition to archived, checks owner's consent and latest snapshot. Writes project type, value band, margins/durations/delay/variations/subcontract percentage. No runtime migration/apply assertion here. |
| Sensitive geography | Hardened function assigns `NEW.site_address` directly to `v_region` then stores it in `project_benchmarks.region` | Raw site address is not a reviewed regional classification. This conflicts with confidently treating stored rows as fully anonymised; must resolve before extending or endorsing the checkbox promise. API omitting region does not erase stored sensitivity. |
| Benchmark API | `src/app/api/v1/benchmarks/route.ts` | Capability-gated off in cohort; filters project type/value band, up to 500 records, aggregates means; no region/trade filter, currency/unit provenance or minimum sample suppression. No API request made. |
| Other consumers | Admin benchmark tab and admin aggregator; dormant intelligence client | Admin copy describes automatic archive contributions. `src/app/dashboard/intelligence/page.tsx` redirects and documents missing backing sources; dormant client is not a delivered intelligence surface. |
| Reference rates | `src/app/dashboard/library/page.tsx`, `rate-override-client.tsx` | Catalogue market-base rates/own overrides are distinct from consented archived-project outcome data. Resetting an own rate to a catalogue benchmark does not create a customer contribution. |

Specific source caveats to resolve in the future plan: API `sample_size` counts all group rows while each metric mean excludes its nulls; on-time calculation treats null delay as zero/on-time. `limit(500)` without ordering/pagination is a bounded selection, not a complete population. Trigger inserts on each eligible unarchived→archived transition; idempotency/re-archive policy is not established by a single-project transition guard. Missing contract value is coerced to zero/lowest band. These are source observations, not repairs or evidence of live data defects.

Proposed scope: separate **reference catalogue rates**, **private own-company performance** and **cross-customer aggregate benchmarks** in labels and permission rules. Define a geography classifier, discipline taxonomy plus contractor free-text mapping, currency/VAT/unit basis, date/vintage, sample provenance, duration calendar/working-day basis and inclusion criteria. Never substitute a regional rate for an unavailable own rate. Programme comparisons need comparable activity/scope and working patterns, not merely similar contract values.

Acceptance plan, before any enablement:

- Trace consent UI → acknowledged persistence → archive eligibility → stored minimised fields → aggregate → withdrawal behaviour using synthetic fixtures. Decide consent version/audit semantics and review existing irrevocability wording; do not claim legal approval.
- Exclude raw addresses/identifying narratives from shared contributions. Review sparsity/combination risks, minimum group suppression and whether repeated API filters permit differencing. Product/privacy owner must choose a justified minimum; no arbitrary number is declared approved here.
- Test opt-out, missing snapshot, null/unknown value, withdrawn consent, re-archive, stale source, metric-specific denominators and absent actual duration. Unknown delay must not count as known on-time delivery.
- A benchmark output must identify source period, eligible/known sample counts per metric, units, methodology/version and uncertainty. Small/empty groups show unavailable, never invented zeros or confident market rates.
- Preserve cohort/API gates, tenant isolation and dormant modules. Migration deployment, authorisation and authenticated/DB evidence remain separately gated; offline SQL reading cannot prove any of them.

Owner/next action: product/data owner reconciles purpose and data dictionary with privacy owner; integration owner assesses a separately authorised source increment. Keep A025 Partial; do not change register to Complete from this plan.

## A026 — customer pricing and duration measurement design only

Register remains Later/Not started. Reuse owned estimates, programme snapshots, expenses and archive outcomes where reliable; do not start collection or send customer data to marketing analytics. Source anchors: management-accounts page queries, benchmark snapshot fields above, and existing programme/estimating modules. Their presence does not establish actual-cost completeness or comparable market observations.

| Proposed measure | Grain/basis and formula | Required missing-data rule |
| --- | --- | --- |
| Own quoted unit price | Frozen estimate revision + activity + quantity unit + currency/VAT basis; line selling amount / positive quantity | Do not mix lump sums and per-unit rates; zero/unknown quantity unavailable. Keep cost and selling price separate. |
| Programme duration insight | Frozen baseline activity/project + working calendar + actual start/finish; compare same basis | Missing actual finish means incomplete, not zero delay. Calendar days and working days cannot be pooled. |
| Estimate-to-actual cost variance | Same scope/revision: posted eligible actual cost − baseline estimated cost; percentage divided by positive baseline cost | Explicit posted/committed status, approved changes, cutoff date and coverage. No actuals is unknown, not profit. |
| Missing activity | Stable activity identity plus user-confirmed omission reason, first added revision and scope-change flag | New scope is not automatically an estimating omission; free text stays private. |
| Market insight | Separately consented, minimised aggregate of comparable rows | Own-company private insights do not imply permission for cross-customer sharing. Apply A025 review first. |

Measurement schema to design: private organisation/project/activity identity, baseline revision and timestamp, source receipt/revision, measured-at/cutoff, scope-change category, currency/unit/VAT/calendar basis, completeness and provenance. Shared output drops private identifiers and raw text; it needs a separate minimisation/aggregation contract. Do not blindly export this private schema.

Illustrative acceptance fixtures for a future implementation: estimated cost 100 and known posted actual 120 gives +20 cost variance and +20%; changing selling price does not alter that cost variance. Missing actual gives unavailable. Baseline zero gives no percentage. A 5-working-day baseline versus a 7-calendar-day actual requires explicit calendar conversion. Reopening/changing an estimate creates a new comparison revision rather than rewriting the frozen baseline. These are design examples, **not executed calculations**.

Owner: product/data owner with contractor domain review. Next concrete decision is source/coverage of actuals and baseline revision identity, then a minimal private dictionary with access/retention rules. No market-pricing recommendation or synthetic benchmark delivered here.

## A020 — resource and financial scope / acceptance plan

Register remains Later/Not started. Preserve later modules and current cohort hiding; a generic dashboard tile is not a useful integrated metric.

Source inventory: `src/app/dashboard/resources/page.tsx` loads organisation `mom_items` and infers labour/plant by category/code; that is a rate/resource catalogue, not scheduled availability, worker attendance or capacity. `resources/actions.ts` adds/deletes catalogue entries. `src/app/dashboard/management-accounts/page.tsx` loads owned active estimates (including line totals for preliminaries handling), invoices, expenses with cost status, variations and archive snapshots. It currently falls back query results to empty lists; therefore a future dashboard must distinguish failed/unavailable reads from confirmed zero. Existing legacy client benchmark ranges are UI text, not validated regional industry evidence. Cohort dashboard route allowlist in `src/lib/launch-profile.ts` does not expose these extended modules.

First useful slice proposal: a private period-filtered **posted cost and invoice status** summary with drilldown to its existing records, separately labelled from estimated contract value/margin. Do not call estimates cash, invoices bank receipts, resource rates utilisation or quotations earned revenue. Add capacity only once actual available-hours and assigned-hours sources exist.

| Candidate metric | Definition to approve | Delivery evidence required later |
| --- | --- | --- |
| Posted project cost | Sum eligible posted expense amounts in declared period/currency | Reconcile detail sum; exclude drafts/voids according to approved rules; unknown read must show unavailable. |
| Overdue invoice balance | Outstanding eligible net invoice balance with due date before cutoff | Partial payments, retention, credits and voids handled once; timestamp/timezone explicit. Existing selected fields alone do not prove ledger completeness. |
| Estimated margin | Approved selling-value calculation versus estimated cost on one active revision | Reuse existing contract-sum helper semantics, no double-counted preliminaries; clearly forecast, not realised margin. |
| Labour/plant capacity (deferred) | Assigned eligible hours / available eligible hours over same calendar | Catalogue price/hour is not either denominator; absence means unavailable. No guessed productivity percentage. |

Acceptance plan: synthetic period boundaries and owner isolation; drilldown totals reconcile exactly; zero versus unavailable/loading/error are distinct; currency/VAT/status/cutoff visible; range changes update all values consistently; no double-counted archive/live rows or repeated invoices. Retain keyboard/mobile access and links to actionable detail. Keep incomplete metrics hidden rather than blank future-feature cards. Hosted/DB/RLS tests and release enabling require separate scope/authority, not granted by this document.

Owner: product owner chooses one actionable question; financial domain owner approves definitions; data/integration owner identifies reliable receipts. This plan removes ambiguity about catalogue versus capacity and forecast versus realised measures without building another disconnected panel.

## A089 — remaining causal evidence, document only

No tests, repair or real Git experiments for A089 in this batch. Prior handoff's synthetic killed/exit23/ENOENT evidence remains adequate to describe diagnostics. Historical Mac fixed and unfixed 9/9 passes do not discriminate a timeout cause.

The original failing command/stage trace is the concrete missing evidence: exact fixture and working directory identity, Git/version/platform, bounded relevant non-secret configuration, command start/end and total-case elapsed time, stdout/stderr, exit/signal/killed status, and runner contention at failure. Do not inspect credential configs or sessions to obtain it under this run. An existing authorised operator should retrieve the original non-secret failure artifact if retained. If absent, label the historical cause unknown; do not launch repeated unchanged passing checks.

A command deadline proves bounded attempted execution only. Several commands with 4-second budgets may exceed a 5-second case budget; `execFile` timeout/SIGKILL is not proof every OS-stuck child exits promptly. Distinguish timeout, process launch failure, nonzero Git exit, wrong index/fixture and total-case budget exhaustion. Recommend reopening investigation only with a fresh failure or original trace, not another runner-hardening task. A089 remains Partial.

## Fresh offline validation and packaging

Only changed test source: `src/lib/public-measurement.test.ts` (three new A097 cases). Product implementation untouched. New cases check no fetch/beacon/storage effects without sink; no query/fragment attribution leakage into sink payload; current-route guard after navigation. They are bounded source/unit evidence, not network capture of a running app, real-email delivery, hosted collection or DB acceptance. Existing 13 cases were skipped deliberately; prior results are not relabelled fresh.

Before test group: Python `shutil.disk_usage('.').free/2**30`, asserted >=16: **18.335 GiB**. Runtime `node --version`: **v26.12.1**, not Node24 build evidence. Command:

```sh
node /Users/robertsmith/dev/constructa-fresh-20261025/node_modules/vitest/vitest.mjs run --config /private/tmp/constructa-codex-batch2-vitest.mjs src/lib/public-measurement.test.ts -t 'A097 offline evidence boundaries'
```

Result: exit 0; **1 file passed, 3 tests passed, 13 skipped; 141ms**. Temporary config roots this owned worktree, uses node environment, maxWorkers 1, fileParallelism false, aliases `@` to owned src and `vitest` to existing live dependencies. Shared dependency installation used read-only; no new node_modules, install or build. Tests use synthetic globals/sink only.

Inbox was read in full by Python (1,544,455 bytes / 6,505 lines at initial receipt); initial terminal rendering of the full file was truncated, recent material separately extracted. Latest exact user batch restrictions supersede historical dispatch/build/packaging directions. No inbox instructions cleared. This batch ends when the scoped plans and three new checks are complete; elapsed-time target is not a reason to repeat adequate checks or wait artificially.

Commit: **not attempted**. Push: **not attempted**. Coordinator must review and package the changed test and this document on `codex/evidence-20261108-1020`; no index or Git metadata mutation by this run. This is not an integrated candidate or RC acceptance receipt.

Final local hygiene: `git diff --check` exited 0. Handoff section/status assertions passed. Final status contains only the modified public-measurement test and this untracked handoff. No commit/push attempt.
