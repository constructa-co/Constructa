# Staged Platform Path (A104)

Plan artifact, 4 November 2026. Source baseline: `d499865373b05b25fa892617ca414994b6fcd1dc`
on `cq/cq-0120-a104-platform-path`.

This is a plan only. It does not build, enable, deploy, merge or approve anything,
and it does not change any action in `walkthrough-action-register.json`. A104 is
recorded there as `Later` / `Not started`. Whether this document moves it on is
for the parent and Rob to decide. The ordering below is relative and not a
commitment. It sets no launch date, price, cohort size or approval.

## 1. Sources and what they establish

These approved facts come from the repository at the baseline:

- **Two launch profiles.** `src/lib/launch-profile.ts` defines `cohort` (the
  default, which fails closed) and `full` ("internal testing only",
  `DEVELOPMENT.md`). `cohort` enables `company-profile`, `pipeline`,
  `project-setup`, `brief`, `estimating`, `programme` and `proposal`. Everything
  else, including `contract-shield`, `drawing-takeoff`, `video-walkthrough`,
  `client-boq-import`, `benchmark-api` and `extended-modules`, needs `full`.
- **Retained delivery and closure modules exist and are gated, not deleted.**
  `src/components/sidebar-nav.tsx` shows them only when `extended-modules` is on:
  - Live Projects: `projects/overview`, `contract-admin`, `billing`,
    `variations`, `p-and-l`, `change-management`, `programme`, `communications`.
  - Closed Projects: `archive`, `final-account`, `handover-documents`,
    `lessons-learned`.
  - Resources and reporting: `resources/portfolio`, `accounting`, `reporting`,
    `management-accounts`, `cis`, `materials`.
  - Integrations: `settings/integrations` (Xero, `src/app/api/xero`) and
    `settings/api-keys`, plus `src/app/api/v1/benchmarks`.

  Their Server Actions authenticate through
  `src/lib/supabase/extended-module-auth-utils.ts`, which 22 action files under
  `src/app/dashboard` import (24 files counting two library tests).
- **The register requires preservation.** A078 ("Keep all later-phase
  application modules … while adding phase one") and A118 ("Hide future …
  panels … without removing later-phase modules") are `Complete`. A080 (a plan
  for a recoverable phase-two/three continuation before replacing the public
  site) is `Complete`.
- **Known quarantine.** Delay/claims, Contract Admin actions and the alert cron
  (`src/app/api/cron/contract-alerts`) stay disabled until GitHub issue `#34`
  settles the date convention and replaces the four skipped assertions
  (`DEVELOPMENT.md`).
- **Phase-one single sources of truth** (`DEVELOPMENT.md`, "Proposal Document"):
  - `src/lib/programme-plan.ts` works out every programme date (Monday–Friday).
  - `src/lib/proposal-publication.ts` builds the immutable
    `proposal_publications` snapshot, and the web view and PDF both render from
    it.
  - `src/lib/proposal-response.ts` asks clients for receipt or a non-binding
    intention to proceed. Binding acceptance is not offered.
- **Pre-contract lock (source).**
  `supabase/migrations/20260930000000_lock_accepted_precontract_records.sql`
  freezes pre-contract records once a proposal is accepted and tells the
  contractor to record later changes as variations. Whether it has been applied
  to any hosted project was not checked here.
- **Register snapshot** (`updatedAt` 2026-11-03T18:18Z): 118 actions, 82
  Complete, 17 Partial, 18 Not started, 1 Blocked (A093). 22 actions are tagged
  `Later`.

The `CLAUDE.md` sprint roadmap and `VISION.md` show past intent. They are not
an approved sequence and are not used as one here.

## 2. Preservation rule

The existing phase-two and phase-three work **must be kept and reused, not
rebuilt or deleted**. The later stages promote modules from the `full` profile
into the cohort one module at a time, using the existing capability mechanism.
They do not rewrite modules in parallel. A module gets promoted only after it
has been reconciled with the phase-one boundaries below.

| Boundary | Keep as canonical | Reuse rule |
| --- | --- | --- |
| Domain identity | `projects.id` as the job; `estimate_lines.id` as the work-breakdown key (already referenced as `estimate_line_id` by cost capture and the pre-contract lock) | No new job or line identifiers. Delivery records hang off these keys. |
| Owner access | RLS owner checks (`user_id = auth.uid()` or organisation membership); `extended-module-auth-utils.ts` for deferred modules | Change a module to the base auth helper only when that module is deliberately promoted (`DEVELOPMENT.md`). No cross-tenant reads outside admin service-role paths. |
| Canonical financials | Current source: estimate lines as the cost budget; an immutable `proposal_publications` snapshot of what was proposed, with only a non-binding client response, so publication does not establish a binding contract sum. Proposed, and only if Rob's undecided contract-formation and handoff decision selects one: that snapshot as the contract sum and terms, with variations as the only way to change the sum afterwards | **Gap (targeted source search only, not a runtime finding):** a targeted search found no `proposal_publications` reads in `billing`, `p-and-l`, `overview` or `final-account`. `billing`, `p-and-l` and `final-account` work from estimate data instead. They need reconciling before promotion. |
| Programme | `programme-plan.ts` for dates; the saved phase-one programme as the baseline | The retained `projects/programme` and `overview` read `programme_phases`, and `programme` has an `operational-baseline` test. Tracking compares against this baseline and doesn't recompute it. |
| Deployment isolation | `src/lib/deployment/supabase-target.mjs` | Every stage keeps the fail-closed preview and E2E database checks. |

## 3. Staged sequence

### Stage 1 — Phase-one core (current focus)

- **User outcome:** A contractor sets up the company and moves one job through
  brief, estimate, programme and a published proposal, then records the
  client's response and the move to Won (A114, A115).
- **Existing capability:** The cohort profile. 82 register actions are
  `Complete`, most of them in this core.
- **Unbuilt or open:**
  - Partial: A001, A023, A038, A055, A063, A079, A085, A086, A089, A091, A092,
    A105, A106.
  - Blocked: A093.
  - Not started: A109.
- **Dependencies:** Recovery (A079), consent and terms (A023), credential
  containment (A105, A106), an exact-candidate review (A093).
- **Owner:** Engineering for source items. Rob for human, legal, consent and
  release decisions. The pending engineering work is not only waiting on Rob.
- **Recommendation:** Finish Stage 1 under its current holds before promoting
  anything. Keep later modules gated.

### Stage 2 — Operational project delivery

- **User outcome:** A won job continues in the same project: billing against
  the agreed payment stages, variations, cost capture and job P&L, and
  programme tracking against the proposal baseline.
- **Existing capability (gated):** `overview`, `billing`, `variations`,
  `p-and-l` (with `estimate_line_id` cost capture), `change-management`,
  `programme`, `communications`, `resources/staff` and `resources/plant`.
  Payment stages are already chosen during pricing (A065).
- **Unbuilt pieces:**
  - **Handoff trigger.** Phase one deliberately offers only a non-binding
    intention, so what starts delivery and what records the agreed contract
    sum is undecided.
  - **Financial source (proposed).** Conditional on the handoff decision
    above, Billing, P&L and Final Account would read the immutable snapshot
    that decision selects as the contract sum. Publication alone does not fix
    a binding sum.
  - **Delivery-side tests.** These modules need tests against current
    phase-one data.
  - **Pipeline and dashboard metrics.** These need connecting without blank
    blocks (A016, A020).
  - **Contract Admin and delay.** These stay out until `#34` is resolved.
- **Dependencies:** All of Stage 1. A079 must give a real recovery path before
  operational financial data accumulates. `#34` before Contract Admin.
- **Owner:** Rob decides the handoff and contract-formation model. Engineering
  does the reconciliation and tests.
- **Recommendation:** Promote one module at a time, starting with
  overview/programme tracking (closest to the existing baseline), then
  billing/variations, then P&L.

### Stage 3 — Integrated platform

- **User outcome:** One platform to run the business: closeout and handover,
  final accounts, cross-project resources, management accounts, CIS, and
  accounting sync.
- **Existing capability (gated):** `final-account`, `handover-documents`,
  `archive`, `lessons-learned`, `resources/portfolio`, `accounting`,
  `management-accounts`, `cis`, `reporting`, Xero
  (`settings/integrations`, `api/xero`), `api-keys` and `api/v1/benchmarks`.
  Also `contract-shield`, `drawing-takeoff` and `video-walkthrough`.
- **Unbuilt pieces:**
  - Consolidated financials that sum the Stage 2 canonical numbers instead of
    recomputing them.
  - Provider activation for Xero and any AI.
  - Benchmark consent and aggregation (A025 and A026 not started). The
    `intelligence` route is noted in source as gated pending missing tables.
- **Dependencies:** Stage 2 financials. Provider accounts and agreements.
  Privacy and consent scope (A024, A098). Data-processing terms.
- **Owner:** Rob for providers, accounts, legal and pricing. Engineering for
  integration.
- **Recommendation:** Treat every provider-backed module as off until Rob gives
  explicit activation authority. That authority is not given or implied here.

### Stage handoffs

- **Stage 1 → 2 (proposed):** The project ID carries over unchanged. In current
  source a publication is an immutable snapshot and the client response is
  non-binding, so it does not fix a binding contract sum. What forms the
  contract and starts delivery is undecided and Rob's decision. Only if that
  decision selects a snapshot would it supply the contract sum, terms and
  payment stages. The pre-contract lock (source) moves later changes into
  variations. The saved programme becomes the baseline.
- **Stage 2 → 3 (proposed):** Closed projects keep their IDs. Final Account
  would equal the contract sum fixed by that decision plus approved
  variations. Consolidated reports read
  project-level canonical figures. Benchmarks use only consented,
  de-identified data.

## 4. Cross-cutting dependencies and boundaries

- **Data, recovery and privacy are critical.**
  - A079 is qualified source and runbook work (`docs/recovery/a079-recovery-runbook.md`),
    not full recovery. On 31 October a qualified encrypted export was
    successfully restored into a disposable localhost database (9 schemas,
    114 table/view entries, 25 archive objects). That limited result stands.
    It is not full Auth, configuration, Storage-service, both-repository
    all-refs or private-asset recovery.
  - Stage 2 must not start accumulating live financial records until recovery
    is real.
  - Preview and E2E must never use production data (`DEVELOPMENT.md`).
- **Content and marketing boundary.**
  - `src/app/(marketing)/` stays a separate surface.
  - Not-ready add-ons stay off sale (A083).
  - Guides, editorial, newsletter and syndication (A099–A103) are `Not
    started`. When built, they must use a human-reviewed publish step with no
    automatic publication.
  - Product marketing must not advertise Stage 2 or 3 modules as available.
- **AI and photos.**
  - A038 photo enhancement is OFF, the photo wire switch is FALSE, and the
    photo migration is unapplied.
  - The AI photo issuer hold stays.
  - A055 and A063 remain Partial.

## 5. Current holds (unchanged)

No PR, main, merge, CI dispatch, deploy, settings, SQL, credentials, provider,
new account or customer write. Preview HOLD and sign-up OFF.

- **A023:** human QA answer is NO / on hold.
- **A079:** qualified, not full recovery.
- **A091:** not deployed; full real journey not accepted.
- **A093:** Blocked / not ready.
- **AI photo issuer:** held.

This plan does not waive or answer any of these, and it adds no new questions.

## 6. Proposed decisions (not approved)

1. Promote modules through the existing `LaunchCapability` mechanism, splitting
   `extended-modules` into per-module capabilities when needed. No parallel
   rewrite.
2. Conditional on decision 4: if that step selects an immutable
   `proposal_publications` snapshot, make it the contract-sum source for every
   Stage 2 and 3 financial view. Publication alone does not do this.
3. Treat the pre-contract lock plus variations as the only route for changing
   the price once the contract sum is fixed under decision 4.
4. Decide on a binding contract-formation step before Stage 2 is offered. This
   is Rob's decision.

## 7. Immediate follow-ons (from existing open items)

1. Continue the existing Stage 1 Partial and Blocked items (A023, A038, A079,
   A085, A086, A091, A093) under their current holds.
2. Resolve `#34` (date convention) and replace the four skipped
   `delay-analysis.test.ts` assertions. This is a source-only prerequisite for
   Contract Admin and delay.
3. Design the Won → delivery financial handoff once Rob has decided the
   contract-formation step: if it selects a snapshot, make `billing`,
   `p-and-l` and `final-account` read that snapshot. Bounded source work with
   tests, kept behind `full`.
4. A016/A020: connect operational dashboard metrics only where the canonical
   data exists, with no placeholder blocks.
5. A079: finish independent recovery proof before any Stage 2 data
   accumulates.

## 8. Known unknowns

- Not checked here: whether retained modules pass their own tests on the
  current baseline, which migrations are applied on hosted projects, whether
  the delivery modules' RLS matches current phase-one tables, or how `live/`
  and `projects/overview` overlap.
- Billing, P&L and Final Account sources were found by targeted search only.
  Confirm them before acting on the follow-on in section 7, item 3.
