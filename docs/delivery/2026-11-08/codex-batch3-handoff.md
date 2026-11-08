# Codex batch 3 — programme design, case tags and provider inventory

8 November 2026, 12:27 UAE allocation. Tool: Codex exec tools. Owned branch
`codex/evidence-20261108-1020`, starting HEAD `b99b293`; initial status clean.
Source/offline evidence only. No UI, runtime configuration or database changes.
No canonical register/dashboard edits or status promotions. Coordinator packages
changed files on this branch after this run; no git add/commit/push attempted.

## Authority and delivery boundaries

Current material direction preserved here because the private records directory
is outside this run's writable roots: Constructa only; QuantFund priority; scope
in order A061 later-release design/acceptance, A037 source/data/offline plan,
A096 remaining read-only inventory. Maximum 90 minutes and 15:30 UAE hard stop;
finish early when done, no artificial delay or repeated unchanged tests. Hourly
ceiling approximately 2 points; exact points unavailable through these tools.
No subagents, full build, install/new node_modules/worktree, server, deploy,
merge, main/production/settings writes, SQL, credentials, destructive actions,
external messages, account login or other agents' worktrees. No repeat work on
A089/A097/A025/A026/A020/A079. Inbox ACK appended first; inbox fully processed
with Python (1,546,672 characters / 6,523 lines at that read). Initial raw display
was truncated; subsequent filtering processed every line, displaying recent
material instructions separately from receipt/run lines. No inbox entries cleared.

Agreed deliverable: an implementable later-release brief grounded in this
candidate, a small test of the existing tag contract's relevant limitation, and
an inventory that distinguishes source configuration from provider acceptance.
Blockers removed: ambiguity over which programme model to reuse, whether tags
already exist, and whether legacy newsletter/API code means a configured service.

## A061 — clearer programme and Gantt views (Later; plan only)

### Source map and implications

| Owned source | Existing behavior | Design consequence |
| --- | --- | --- |
| `src/app/dashboard/projects/schedule/simple-programme-client.tsx` | Simple programme and optional detailed planner; working-pattern controls; save/regenerate journey | Preserve a simple default. Advanced detail is deliberate and uses the same job context. |
| `src/components/programme-overview.tsx` | Activity labels, dates/durations, shared continuous calendar tracks, explicit calendar span, proportional bars and separate tiny-activity start markers | Extend this readable overview rather than introducing another date calculator. Preserve the difference between markers and duration. |
| `src/components/programme-timeline.tsx` | Reusable light/dark/document timeline; textual ranges and basis note | Proposal and document presentation remain tied to the same facts. |
| `src/lib/relative-programme.ts` | Display plan, axis, stage range/bar/facts helpers for dated and relative programmes | Use this projection for labels and geometry. Relative Day 1 does not acquire an invented date. |
| `src/lib/programme-plan.ts` | Working/calendar durations, source resolution, phase coverage and dated geometry; rejects explicit relative data in dated reader | Retain calculations, coverage guard and source precedence; visual redesign must not silently drop invalid stages. |
| `src/app/dashboard/projects/programme/programme-client.tsx` | Separate as-built view with baseline/revised/actual dates, completion, delays and phase colours; guarded canonical baseline reuse | This is existing later-module source, not evidence of immutable baselines or accepted current/baseline comparison. Do not equate its fallback baseline with a frozen agreed programme. |
| `src/components/programme.module.css` | Overview styling and theme variables | Put future presentation tokens here or in the established theme, rather than an unrelated colour system. |

Direction authority: `docs/backup-snapshots/2026-10-20/programme-benchmark-direction-20261018.json`.
TeamGantt's supplied simple illustrations lead; cleaner Smartsheet-style advanced
grid is secondary. These are Rob's recorded references, not fresh vendor research
or permission to copy their calculations, sharing or critical-path behavior.

### Proposed delivery slices

1. **Readable overview, presentation only.** On desktop, align activity name,
   start/finish and working duration beside one continuous shared axis; keep the
   calendar-span explanation. Add legible week groupings without changing daily
   bar coordinates. Distinguish non-working time with a subdued background based
   on the saved job working pattern; an activity spanning a weekend stays visually
   continuous. At phone width, preserve wrapping labels and exact textual ranges,
   with an overview that fits its container. No dense editable grid by default.
2. **Optional detailed workspace.** Align row labels and timeline rows, preserve
   name/context during deliberate horizontal scrolling, and keep save state and
   action discoverable. Expose only existing editable fields; view switches must
   retain unsaved inputs and cannot save/regenerate implicitly. Dependency or
   milestone cues appear only when supported by the reviewed underlying data;
   never infer dependencies from adjacent bars. Existing planner-only calendar
   distinctions must remain explicit until their contracts are reconciled.
3. **Later comparison, separately scoped.** Before enhancing current/baseline
   overlays, define baseline provenance, explicit capture/version identity,
   authorized replacement and mapping of renamed/reordered/deleted activities.
   Existing `Phase` fields alone do not establish these semantics. Distinguish
   baseline, revised plan, actual and forecast in labels and legend; variance
   units/calendar and missing actuals need an agreed policy. No new snapshot,
   automatic reschedule, critical path or persistence design is approved here.

Purposeful colour proposal: a restrained activity identity palette with textual
labels; neutral/outlined baseline if comparison is later approved, distinct
actual/progress encoding, and warning colour reserved for an explicitly defined
warning. Colour alone never conveys status. Unspecified activity colours retain
a stable fallback; reordering must not misleadingly change identity colours.
Use the existing brand/theme tokens and check light/dark contrast when implemented.
No new colour values or status thresholds are accepted by this plan.

### Future acceptance tied to existing evidence seams

| Fixture / action | Required observable result | Reuse seam (not run here) |
| --- | --- | --- |
| Dated programme crossing weekends and month boundary, five-day and custom working week | Same start/end, working duration and calendar span in editor, overview, proposal and PDF; bars and week ticks share one axis | `programme-plan.test.ts`, `simple-programme-working-pattern.test.ts`, `programme-working-pattern-integration.test.tsx`, `pdf/proposal-programme-bars.test.ts` |
| Explicit relative programme | Day 1…N throughout; no fabricated project start, actual dates or calendar weekend interpretation | `relative-programme.test.tsx`, `programme-relative-whole-name.test.ts` |
| Very short activity in a long programme | True proportional span plus separate marker, readable dates, no inflated duration inference | `src/components/programme-short-bars.test.tsx` |
| Long names, overlaps, one activity and empty/invalid plan | Wrapped usable names; visible overlaps; honest unavailable state; saved phases cannot disappear silently | `src/components/programme-overview.test.tsx`, `programme-inclusion.test.tsx` |
| Desktop/phone and keyboard, light/dark | Label/row/axis alignment, usable scrolling only in detailed view, visible focus, status readable without colour | Existing `e2e/local-phase1/programme-styled.spec.ts` and `programme-mode.spec.ts`, extend only affected cases |
| Switch views, edit, refused save and explicit retry | Draft preserved, no automatic save/regenerate or mutation caused by visual controls | `src/app/dashboard/projects/schedule/simple-programme-workspace.test.tsx` |
| Later comparison with missing/changed baseline identity | Explicitly unavailable comparison; no guessed variance or relabelled current plan as agreed baseline | Add only after comparison contract is approved |

These are a future focused acceptance plan, not new RC gates or fresh test
receipts. No UI acceptance claimed. Proposed owner: programme implementer assigned
by Cursor/Claude leads; first job is slice 1 on the current integrated candidate.
Rob/product owner resolves comparison semantics before slice 3.

## A037 — trade and sector tags for examples (Later; plan only)

### Existing source and data contract

- `src/lib/case-library/labels.ts`: custom discipline labels; active limit 12,
  at most six per study, 80 code points per label. Canonical suggestions combine
  brief trades and project types, not a typed sector taxonomy. Comparison folds
  ASCII case and spaces; do not assume Unicode case/accent normalization.
- `src/lib/case-library/store.ts`: `StoredDiscipline` has id, label, position,
  revision and archived; `StoredStudy.disciplineIds` links studies to disciplines.
  Reads are contractor-scoped; unavailable is distinct from empty.
- `supabase/migrations/20261012090000_case_library_foundation.sql`: contractor
  disciplines, case studies, join table, ownership constraints, RLS, revisioned
  RPCs and approved copies. Inspected source only; no migration applied or DB
  state inferred.
- `src/lib/case-library/content.ts`: exact version-1 content keys, `work_type`
  free text, approved `disciplines: string[]` snapshot. No `sectors` or tag-kind
  field. Adding an arbitrary `sectorIds` key to draft JSON breaks the contract.
- `src/lib/case-library/service.ts`: draft and tag writes may return partial,
  conflict or unknown; approval checks a coherent revision and copies labels.
  `resolve.ts` carries approved labels/revision into proposal resolution.
- `src/app/dashboard/settings/case-studies/library/case-study-editor.tsx`:
  existing “Kinds of work” chips and add/suggest logic. Library page integration
  is in `src/app/dashboard/settings/case-studies/page.tsx`, gated by
  `src/lib/case-library/gate.ts`; default off unless explicitly set to `1`.
  Runtime gate value was not read. Legacy profile case studies remain separate.
- `groupByTag` has no non-test caller elsewhere in `src` in this candidate.
  Existing library/editor wiring does not prove proposal recommendations use
  this grouping helper. Stale “not used yet” file headers are not reliable
  inventories; concrete imports and callsites above establish actual reuse.

### Proposed scope and data shape

Trades answer **what work was done** (Roofing); sectors answer **what kind of
client/building context** (Residential/Commercial). Examples are illustrative,
not an approved exhaustive taxonomy. Both are optional; allow multiple values
where the real example spans contexts. Never derive sector from a client name,
address or delivered narrative, and never retag an existing study automatically.

Reuse existing contractor-owned disciplines for trades/kinds of work. For true
separate sector selection, propose a versioned extension with sector records
`{id, label, position, revision, archived}` and study-sector links scoped to the
same contractor, plus approved sector labels captured with their revision.
This is a design sketch, not SQL or an approved migration. Product owner must
choose reusable custom sectors versus a small suggested vocabulary and set
sector limits before implementation. Keep old v1 approvals readable and
unchanged; represent missing old sectors as untagged, not an inferred category.
A future v2 reader/writer and approval snapshot contract must agree before writes.
Do not overload `work_type`, encode `sector:` strings as a hidden schema, or
silently repurpose existing discipline IDs.

Filtering proposal: OR within each facet; AND between nonempty trade and sector
facets; no filter means show all eligible examples, with untagged discoverable.
Keep user proposal selection independent from filtering/ranking; existing saved
ticks persist when filtered out. Current helper uses OR across all supplied IDs
and job signals. It cannot implement the two-facet intersection unchanged.
Draft edits cannot change already approved/publication snapshots; approved tag
renames follow the same explicit reapproval discipline as existing labels.

### Offline plan and new evidence

Existing `library.test.ts`, `service.test.ts`, `coherent-read.test.ts`,
`contract.test.ts`, `editor-state.test.ts`, `proposal-wiring.test.ts` and
`store.test.ts` cover much of the present flat-tag boundary. They were inspected
selectively, not rerun or counted as new passes. Reuse them when implementing.

Added `src/lib/case-library/a037-facet-boundaries.test.ts` with two synthetic
cases against existing `groupByTag` only:

1. Roofing + Residential selected chips return roof-house, roof-shop and
   tile-house. This proves the current OR behavior cannot be reported as
   trade-and-sector filtering.
2. Reversing job-signal order preserves results; frozen caller studies and
   arrays remain unchanged. Matching/filtering does not modify case content.

Future implementation tests: cross-product fixture (two trades × two sectors,
plus multi-sector and untagged), OR-within/AND-across results; clearing one facet;
identical labels in different facets; archived/missing/foreign IDs; per-facet
limits; revision conflicts and partial tag save; approved label snapshots after
rename/archive; legacy v1 approval resolution; no automatic selection; runtime
feature gate off and unavailable reads. Add these only when their source exists.
SQL parity/RLS and actual save/reload need separately authorized database evidence;
a pure test does not prove them. Owner proposal: case-library implementer under
Cursor/Claude leads; next action review facet semantics and v1/v2 compatibility
before any schema/UI job. A037 remains unimplemented as a separate sector feature.

## A096 — remaining source/configuration inventory (Partial)

This extends the earlier evidence document without rerunning A097's contract
checks or choosing/activating a new provider. No environment files, secret
values, auth configuration, provider accounts or runtime settings were read.

| Gap inspected | Exact source evidence | Conclusion / remaining boundary |
| --- | --- | --- |
| Analytics server wiring | `src/app/admin/page.tsx:159` reads the name `PLAUSIBLE_API_KEY`, hardcodes site `constructa.co`, requests 30-day aggregate/page/source endpoints with 3600-second revalidation | Reader exists; no credential value read or request executed. `PLAUSIBLE_DOMAIN` guidance in growth tab does not control this hardcoded site. |
| Reader failure semantics | Same function returns unavailable if key absent, aggregate request non-OK or caught failure; failed breakdowns can become empty lists while aggregate succeeds | Available aggregate does not prove page/source breakdown completeness. Zero/default UI data is not evidence of zero traffic. |
| Admin interpretation | `src/app/admin/tabs/website-tab.tsx` and `growth-tab.tsx`; `types.ts` metrics shape | Existing ratio caveat retained. Growth setup guidance that connecting API enables the full funnel overstates what a read-only aggregate API join proves. Record for later copy correction; unchanged here. |
| Newsletter entry point | `src/components/marketing/full-landing.tsx:135–164` embeds ConvertKit JS and native POST action for public form 7919715; required `email_address`; CTA “Join the waitlist”; hook records attempt | Concrete waitlist form exists, not proof of newsletter purpose, confirmed subscriber, double opt-in, consent provenance or welcome delivery. Public form ID is not a credential. |
| Route/profile reachability | `src/app/landing/page.tsx` selects full landing only for full profile; `/` selects full-home; otherwise both use `PhaseOneHome`. `getLaunchProfile` defaults to cohort | Cannot say waitlist is displayed at current hosted `/` or `/landing`; runtime profile unverified. |
| Cohort / editorial placement | Literal newsletter/subscribe/waitlist search of `src/components/marketing/phase-one.tsx` and `src/app/guides` returned no matches | No signup implementation found in those inspected surfaces. This is bounded literal source evidence, not proof no newsletter exists on another branch or provider. |
| Transactional email separation | `package.json` includes Resend; provider references in `src/lib/email.ts`, admin report action and contract-alert route | Transactional/report/alert transport is separate from Kit waitlist. It does not supply newsletter list ownership, subscriber consent or unsubscribe configuration. No send called. |
| Browser collection | Existing root/legacy loader-removal boundary and inert `src/lib/public-measurement.ts` documented in prior handoff | No new runtime assertion. Server stats access and third-party waitlist script must be inventoried separately from removed root trackers. |

Source search was bounded to `src`, `scripts`, `docs/marketing`, `next.config.*`
and `package.json` (excluding tests/lockfile for provider references). It found
no separate Mailchimp/Brevo/PostHog/GA loader/provider implementation in that
search; “clarity” prose and regex `closingTag` hits are not trackers. No runtime
provider state, remote configuration, data inventory or deployed absence claim.

Read-only source/configuration gaps for this assigned candidate are now mapped.
Remaining provider facts cannot be closed without authorized owner evidence:
Plausible site ownership and intended domain; deployed route/profile and loader
state; existing Kit form/list purpose and ownership; confirmation flow;
consent timestamps/provenance; sender identity; suppression/unsubscribe; retention,
export/deletion and processor approval. A provider API key or UI connection alone
cannot answer those questions. Retain A096 Partial.

Next owners: coordinator forwards this document internally through the established
handoff (no external send here); Rob/provider owner supplies non-secret setup and
policy evidence; newsletter implementer reuses the existing waitlist only if its
purpose/consent fit is confirmed. Review desired newsletter purpose before
replacing tools or treating waitlist members as newsletter subscribers. No new
account, provider activation, contact import or subscription test is authorized.

## Exact verification and packaging receipt

One tiny test group only. Disk preflight:
`python3` using `shutil.disk_usage('.').free/2**30`, asserted `>=16`:
**18.061 GiB**. `node --version`: **v26.12.1**; this is not Node24 build evidence.

Command (exit 0):

```sh
node /Users/robertsmith/dev/constructa-fresh-20261025/node_modules/vitest/vitest.mjs run --config /private/tmp/constructa-codex-batch2-vitest.mjs src/lib/case-library/a037-facet-boundaries.test.ts
```

Result: **1 file passed, 2 tests passed, 131ms**, start 12:28:40 UAE. Existing
temporary config reused: root is this worktree; aliases `@` to owned `src` and
`vitest` to existing live dependency's `dist/index.js`; node environment,
`maxWorkers: 1`, `fileParallelism: false`. Live dependencies used read-only;
no new node_modules or dependency install. Tests exercise pure existing source,
synthetic tags only; no network/DB/browser/email acceptance.

Read-only inspection used `rg`/`sed`/`cat` on named sources above and
`git status --short --branch`. Initial broad outputs were truncated, so targeted
reads established the specific findings; no exhaustive all-source review claimed.
Guessed nonexistent `vitest.config.ts`, library `page.tsx`/`actions.ts` and
the nonexistent components/guides directory produced read errors; actual config is `.mts`,
page integration is the parent case-studies page and editorial source is
`src/app/guides`. No app/config mutation followed those probes.

Final documentation/path/whitespace validation and final worktree status are
recorded below after execution. No full build, full suite, TypeScript or Supabase
execution required for this plan/test-only batch under Rob's explicit limits.
No commit/push attempted; coordinator packaging pending. Existing earlier work
at b99b293 is retained, not claimed as freshly built or integrated acceptance.

Final checks: cited-path/scope/new-file whitespace Python validation **PASS**
(29 cited repository paths exist); `git diff --check` **PASS** (untracked file
whitespace covered explicitly by Python). First path check flagged the intentionally
nonexistent diagnostic path in this narrative; formatting was clarified, then
validation passed. No test rerun. Final disk **18.034 GiB**. Final
`git status --short --branch`: owned branch unchanged, exactly this handoff and
`src/lib/case-library/a037-facet-boundaries.test.ts` untracked. No tracked source
edits. **Tests: 2 passed. Commit: not attempted. Push: not attempted.**
Coordinator owns packaging both files. Finished early because all assigned
source/planning gaps were handled within authority; no additional test/build
loop is justified. A061/A037 remain later implementation; A096 remains Partial.
