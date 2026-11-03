# Benchmark scope and checkbox reconciliation (A025 plan artifact)

**Date:** 2026-11-04  
**Branch context:** `cq/cq-0310-a025-benchmark-scope` (plan only; no implementation)  
**Register:** A025 remains **Not started**; this document does not close A025, change action-register status, or alter product behaviour.

**Artifact limits:** Source facts below are taken only from targeted inspection of this worktree. This is not a privacy/legal proof, hosted-migration audit, or collection activation. No inference is made here about whether consent is legally sufficient, whether anonymisation is guaranteed in operation, provider approval, or live DB migration apply state.

---

## 1. Original requests (register)

| ID | Phase | Requested scope (verbatim register text) |
|----|-------|------------------------------------------|
| **A025** | Later | Scope future regional/discipline pricing and programme benchmarks and reconcile the existing benchmark checkbox. |
| **A026** | Later | Track future customer insights on market pricing, durations, missing activities and estimate-versus-actual costs. |

**Relationship:** A025 is aggregation + checkbox reconciliation for cross-contractor benchmarks. A026 is product insight direction (including missing-activity and estimate-vs-actual framing) and should stay separate from phase-one release claims until scoped and gated.

---

## 2. Source facts — current checkbox and storage

### 2.1 Profile UI (Industry Benchmarking section)

Location: `src/app/dashboard/settings/profile/profile-form.tsx` (section `#company-consent`).

| Element | Source fact |
|---------|-------------|
| Section title | `"Industry Benchmarking"` |
| Intro copy | States contribution is anonymised from closed projects; claims no company names, client names, or contact details shared; lists aggregated figures: margin %, project type, contract value band, programme duration. |
| Checkbox `name` | `data_consent` |
| Checkbox `value` when checked | `"true"` |
| Default checked state | `defaultChecked={profile?.data_consent ?? false}` → **defaults unchecked** when profile field is null/undefined. |
| Checkbox label | `"I consent to contributing anonymised benchmark data from my archived projects"` |
| Withdrawal copy | Uncheck to withdraw; states previously contributed data **cannot be retroactively removed** because it is fully anonymised with no link back to the account. |

**Qualified gap (source fact):** Withdrawal is described only as unchecking the box on save. There is **no separate execution path** in app code (beyond profile save) that deletes or flags existing `project_benchmarks` rows, nor a dedicated “withdrawal” action. Future archives are gated at trigger time by `profiles.data_consent` (see §3).

### 2.2 Form payload and server persistence

Location: `src/lib/profile-update.ts` — `profileUpdateFromForm`.

| Field | Rule |
|-------|------|
| `data_consent` | `true` only when `formData.get("data_consent") === "true"` (standard HTML checkbox: absent when unchecked → **false**). |
| `data_consent_at` | ISO timestamp when consent is `true`; **`null` when consent is false** (including after uncheck). |

Schema columns introduced in migration `20260409100000_sprint42_benchmarks.sql`: `profiles.data_consent BOOLEAN DEFAULT false`, `profiles.data_consent_at TIMESTAMPTZ`.

Domain types: `src/types/domain.ts` (`data_consent`, `data_consent_at` optional).

Admin read (consent count only, not described as collection control): `src/app/admin/page.tsx` selects profiles where `data_consent = true` alongside `project_benchmarks` reads.

---

## 3. Source facts — what the checkbox gates today

Migration comment: *“All writes gated on `profiles.data_consent = true`.”*

**Trigger:** `fn_benchmark_on_archive()` (defined in `20260409100000_sprint42_benchmarks.sql`, replaced in `20260930180000_harden_legacy_definer_functions.sql`).

| Condition | Behaviour |
|-----------|-----------|
| Event | `projects.is_archived` transitions to `true` (UPDATE). |
| Consent | Reads `profiles.data_consent` for `NEW.user_id`; if not true, **returns without insert**. |
| Snapshot required | Latest row from `archive_snapshots` for `project_id`; if missing, **no insert**. |
| Target table | **Single insert into `project_benchmarks` only** (no insert into `rate_benchmarks`, `programme_benchmarks`, or `variation_benchmarks` in these migrations). |

**Fields written to `project_benchmarks` (from trigger logic):**

- `project_type` ← `projects.project_type`
- `region` ← **`projects.site_address`** (migration comment: “use site address as region proxy for now”) — **not** `projects.region`
- `contract_value_band` ← banded from `archive_snapshots.contract_value` via fixed £ thresholds (`0-50k` … `500k+`)
- `gross_margin_pct` ← `archive_snapshots.gross_margin_pct` (column name per reconcile migration)
- Programme columns ← `planned_duration_days`, `actual_duration_days`, `programme_delay_days` on snapshot
- `variation_count`, variation rate ← snapshot + contract value
- `subcontract_cost_pct` ← aggregated from `project_expenses` by `cost_type = 'subcontract'`

**Tables present but not populated by this trigger (source fact):** `rate_benchmarks`, `programme_benchmarks`, `variation_benchmarks` are created in `20260409100000_sprint42_benchmarks.sql`; repository search shows **no application/trigger INSERT** paths for those three tables beyond schema and RLS grants (`20260529000000_rls_and_data_api_grants.sql`).

**RLS / access:** Benchmark tables enabled for RLS; policies dropped; `REVOKE` from `anon`/`authenticated`; `GRANT ALL` to `service_role`. Writes documented as via `fn_benchmark_on_archive` only.

---

## 4. Source facts — benchmark API and launch gate

**Capability:** `benchmark-api` in `src/lib/launch-profile.ts`.

| Launch profile | `isCapabilityEnabled("benchmark-api")` |
|----------------|----------------------------------------|
| `cohort` | **false** (not in `COHORT_CAPABILITIES`) |
| `full` | **true** |

**Route:** `GET /api/v1/benchmarks` — `src/app/api/v1/benchmarks/route.ts`.

- Returns **404** `{ error: "Not found" }` when capability disabled.
- Auth: Bearer API key → `api_keys` hash lookup; rate limit via `api_usage_log`.
- Reads **`project_benchmarks` only**; optional filters: `project_type`, `value_band` (query params).
- Response aggregates averages and `sample_size` per `(project_type, contract_value_band)` group; includes programme delay and duration fields from row data.
- **Does not expose `region` in select/aggregate** in this route (columns exist on table).

UI reference to endpoint: `src/app/dashboard/settings/api-keys/api-keys-client.tsx` documents `GET https://constructa.co/api/v1/benchmarks`.

---

## 5. Source facts — canonical pricing and programme inputs (in-app)

These are the **existing** project-level sources relevant to future benchmark design (not asserted as currently exported to benchmark tables except where §3 applies).

| Domain | Canonical storage (types / usage) |
|--------|-----------------------------------|
| **Pricing / estimate (budget)** | `estimates` + `estimate_lines` (+ `estimate_line_components` for labour/plant/material/subcontract breakdown); trade grouping via `estimate_lines.trade_section`; margins via estimate-level `overhead_pct`, `profit_pct`, `risk_pct`, `prelims_pct`. |
| **Labour rate catalogue** | `labour_rates` with `trade`, `role`, `day_rate`, `region` (used in costing flows, e.g. `simple-actions.ts` default `region \|\| "national"`). |
| **Cost library** | `cost_library_items` (system/custom rates); library UI distinguishes custom vs “market benchmark” display — separate from `project_benchmarks` aggregation. |
| **Programme (planned)** | `projects.programme_phases` JSONB (`ProgrammePhase` in `src/types/domain.ts`: durations, offsets, manhours); `projects.start_date`; optional `programme_working_pattern`. |
| **Actual costs** | `project_expenses` (`cost_type`, `trade_section`, amounts; used in trigger for subcontract %). |
| **Closed-project outcomes snapshot** | `archive_snapshots` (financial + programme + variation summary columns added/reconciled in `20261001231000_reconcile_archive_snapshots.sql`). |
| **Geography classification (existing)** | `projects.region`, `postcode`, `lat`, `lng` on project; **`region` not used by archive trigger today** (see §3). |
| **Discipline / trade classification (existing)** | `projects.brief_trade_sections`, `estimate_lines.trade_section`, `profiles.preferred_trades`; fixed trade lists in brief/estimate UI (no new taxonomy proposed here). |
| **Client / site identifiers (must stay out of aggregates)** | `client_name`, `client_email`, `client_phone`, `client_address`, `site_address`, free-text brief/proposal fields, photos/storage — **present on projects**; checkbox copy claims they are not shared, but trigger currently copies **`site_address` into `project_benchmarks.region`** (reconciliation risk). |

**Estimate vs actual (source boundary):** Budget side lives in estimate tables; actual side in `project_expenses` and snapshot fields at archive. There is **no implemented cross-contractor export** of line-level estimate-vs-actual or “missing activity” detection in benchmark code paths (A026 direction only).

---

## 6. Reconciliation — checkbox copy vs current execution contract

| UI / user expectation (profile section) | Current execution (code + migrations) | Gap |
|----------------------------------------|----------------------------------------|-----|
| No client/company/contact details shared | Trigger stores **`site_address` in `region`** | **Misalignment:** site address is not a regional band and may contain identifiable location text. |
| Aggregates use “region” implicitly | API aggregates by **project_type + value_band only**; `region` column unused in public API | Product/API story does not yet match regional benchmark intent in A025. |
| Data from **archived** projects | Requires **`is_archived`** + consent + **non-null archive snapshot** | Projects archived without snapshot produce **no row** (silent skip). |
| Anonymised, no link back | Rows have **no `user_id`/`project_id`** on `project_benchmarks` | Matches table design; **erasure after insert not implemented** (consistent with UI “cannot remove” text, but conflicts with strict GDPR erasure expectations — **legal/policy decision unresolved here**). |
| Withdraw by uncheck | Sets `data_consent = false`, `data_consent_at = null` | Stops **future** trigger inserts only; **no** code path to remove prior benchmark rows. |
| Industry benchmarks (plural tables) | Only **`project_benchmarks`** receives trigger writes | **`rate_*` / `programme_*` / `variation_*` tables empty** unless populated elsewhere outside searched paths. |
| `data_consent_at` | Set on opt-in only | **No** documented use in trigger (consent is boolean at archive time only). |

**Removed from this plan:** Treating `data_consent` as an undefined boundary — it **is** defined in schema, profile save, and trigger guard; what remains undefined is **legal adequacy**, **retention**, and **operational anonymisation proof**, not the boolean gate itself.

---

## 7. Proposed design — future A025 scope (not implemented)

Separate from §2–6. Assumes future work stays **Later / gated** (phase 2/3 intelligence), preserving current holds on main deploy, A023, AI/photo/issuer, and **no activation** in this artifact.

### 7.1 Eligible closed-project aggregate inputs (proposed)

When consent is true and project is closed/archived with sufficient structured data:

| Bucket | Proposed eligible signals | Use existing classification |
|--------|---------------------------|-----------------------------|
| **Pricing** | Band-level sell/cost/margin outcomes; trade-section totals; rate bands derived from estimate lines / expenses | `project_type`, `contract_value_band`, `trade_section`, `cost_type`, `labour_rates.region` where already set |
| **Programme** | Planned vs actual duration, delay days, phase-level duration totals | `programme_phases`, snapshot programme columns |
| **Discipline mix** | Share of cost or lines by trade section | `brief_trade_sections`, `estimate_lines.trade_section` |
| **Region** | **Banded or canonical region only** | Prefer **`projects.region`** (and/or postcode district **if** Rob approves a defined transform); **exclude raw `site_address`** from benchmark store |

### 7.2 Explicit exclusions (proposed)

Do not write to benchmark tables: client names/emails/phones/addresses; full site address strings; free-text brief/scope/proposal/contract text; photos and document URLs; user/project/org IDs; invoice numbers; exact contract values (keep **bands** only).

### 7.3 Grouping dimensions (proposed)

Use **existing** fields only — no new taxonomy in this plan:

- `project_type`, `contract_value_band`, `projects.region` (once source corrected), `trade_section` / `brief_trade_sections`, `client_type` if already on project, time quarter from `captured_at`.

### 7.4 Estimate vs actual and missing activity (A026 alignment)

| Topic | Proposed direction |
|-------|-------------------|
| **Estimate vs actual** | Publish aggregate deltas by trade section and cost type (budget from active estimate at archive, actual from expenses + snapshot), not line-level PII. |
| **Missing activity** | Treat as **uncertainty**: only report “activity coverage” metrics when both estimate lines and expense classifications exist; otherwise bucket as **insufficient data** — no invented completeness scores. |

### 7.5 Opt-in, withdrawal, de-identification, retention (decisions for Rob — recommendations only)

| Decision | Recommendation in plan | Status |
|----------|------------------------|--------|
| Opt-in default | Keep **default false** (matches schema + UI today) unless Rob explicitly changes policy | Aligns with source |
| Withdrawal effect | Document: uncheck stops **future** contribution; define whether **operational** block requires snapshot re-run | Partially implemented |
| Retroactive removal | UI already denies removal; confirm whether policy is **true irreversible anonymisation** vs ** keyed deletion** before scaling collection | **Unresolved** |
| Retention period | Not defined in code | **Unresolved** — needs Rob/legal |
| Region field fix | Stop writing `site_address` to `project_benchmarks.region`; map to `projects.region` or approved district band | **Required before regional claims** |
| Populate secondary tables | Define whether `rate_benchmarks` / `programme_benchmarks` / `variation_benchmarks` are still targets or consolidated into API aggregates | **Unresolved** |

---

## 8. Staged implementation (owner = future engineering; gated)

| Stage | Scope | Gate |
|-------|--------|------|
| **0 (now)** | This plan + checkbox/source reconciliation; **no** schema/UI/trigger changes | A025 plan artifact only |
| **1** | Fix region source; align profile copy with actual fields written; snapshot-required behaviour documented in UI | Rob approval + privacy review (A023 chain) |
| **2** | Consent-checked writers for discipline/pricing/programme aggregates into agreed tables; admin + API filters include region/trade where safe | `benchmark-api` / full profile; no cohort exposure without explicit decision |
| **3** | Contractor-facing insights (A026): estimate-vs-actual and missing-activity **indicators**, percentile copy | Separate product gate; no sample thresholds or performance guarantees in spec until data exists |

**Next action (single):** Rob confirms region mapping policy and retroactive erasure stance; then engineering drafts a minimal migration + trigger revision design (implementation task, not this file).

---

## 9. Bounded follow-ons (tied to source gaps)

1. **Region proxy fix** — Replace `site_address` → `project_benchmarks.region` with approved regional banding (`projects.region` / postcode rule); add regression test on trigger payload shape.
2. **Snapshot completeness** — Document or enforce archive workflow so `archive_snapshots` exists before benchmark insert (today silent no-op).
3. **Secondary table strategy** — Either implement writers for `rate_benchmarks` / `programme_benchmarks` / `variation_benchmarks` or deprecate from public API docs to match single-table reality.
4. **API surface** — Extend `GET /api/v1/benchmarks` filters/aggregations for region and trade_section **after** storage is safe; keep `benchmark-api` launch gate explicit.
5. **A026 product spec** — Separate doc for missing-activity and estimate-vs-actual **contractor insights**, referencing same consent gate and exclusions in §7.2.

---

## 10. Explicit non-goals (this artifact)

- No checkbox, default, payload, legal copy, or schema changes.
- No activation of collection, triggers, or API in production.
- No invented sample sizes, rate thresholds, launch dates, or adoption metrics.
- No whole-code audit, CI/build proof, changelog entry, or register status update.

---

## 11. Key file references

| Topic | Path |
|-------|------|
| Checkbox UI | `src/app/dashboard/settings/profile/profile-form.tsx` (~764–787) |
| Profile save mapping | `src/lib/profile-update.ts` |
| Launch gate | `src/lib/launch-profile.ts`, `src/lib/launch-profile.test.ts` |
| Public API | `src/app/api/v1/benchmarks/route.ts` |
| Trigger + tables | `supabase/migrations/20260409100000_sprint42_benchmarks.sql`, `supabase/migrations/20260930180000_harden_legacy_definer_functions.sql` |
| Snapshot columns | `supabase/migrations/20261001231000_reconcile_archive_snapshots.sql` |
| RLS/grants | `supabase/migrations/20260529000000_rls_and_data_api_grants.sql` |
| Register entries | `walkthrough-action-register.json` (A025, A026) |
