# Rob-approved AI caps and public forms (source-only)

**Date:** 2026-11-20  
**Authority:** `CTO-20261120-1752-AUTHORITY.md` items 4 and 5  
**Branch:** `codex/rob-approved-ai-forms-20261120`  
**Lane:** Source only. No build, SQL apply, env values, push, or live submissions in this lane.

## Outcome

### Forms (CON-013 / CON-053)

- Fields: **name, email, optional company, message** — no new collection fields.
- Contact and apply share one inbox env name: `CONSTRUCTA_PUBLIC_MARKETING_INBOX_DESTINATION` (proposed `hello@constructa.co` — mailbox live status not verified in repo).
- **Collection OFF:** `CONSTRUCTA_PUBLIC_FORM_COLLECTION_ENABLED` must be `1` and inbox env non-empty before ready; routing still throws (no transport/store/send).
- Policy when off: **12-month retention**, **Rob-only access**; privacy link unchanged.

### AI (CON-008)

- No new features; existing `withAiBudget` path only.
- **FILE ONLY** migration `20261120174500_founding_cohort_ai_monthly_pence_caps.sql` extends atomic `ai_generation_reserve` / `finish` (global advisory lock retained).
- **Global** month ceiling seeded: **2500 pence (GBP 25)**.
- **Per-company** month ceiling seeded: **500 pence (GBP 5)** — R1 conservative seed within approved scope; **not** a verified billing rate.
- Per-feature **verified upper bound** (`max_reserve_pence`) is **not** seeded: features without it return `disabled` on reserve (fail-closed).
- Each attempt stores immutable `reserved_pence` at reserve time; monthly sums and finish charge use that column, not live feature rows.
- Historical attempts in the London calendar month with `reserved_pence IS NULL` block new reserves (`disabled`).
- Abandoned / error finishes charge `reserved_pence`; no token-to-pence conversion.
- Operator rollback: `docs/delivery/2026-11-20/rollback/20261120174500_founding_cohort_ai_monthly_pence_caps.rollback.sql` (not under `supabase/migrations`).

## Operational pending (honest)

| Step | Status |
|------|--------|
| Migration reviewed and applied to target | Pending owner |
| Per-feature `max_reserve_pence` integers set for each enabled feature | Pending operator — **cost gate**; monetary reserve stays off until set |
| Inbox destination live + `CONSTRUCTA_PUBLIC_MARKETING_INBOX_DESTINATION` | Pending |
| `CONSTRUCTA_PUBLIC_FORM_COLLECTION_ENABLED=1` | Pending — routing not implemented |
| Remove `supabase/migrations/20261120174500_*.rollback.sql` stub before glob apply | Pending operator |

## Limits / not claimed

- Migration **not applied** in this lane.
- Provider worst-case cost is **not** verified; per-feature pence bounds are operator-authored ceilings, not live pricing.
- No Resend/Formspree/DB storage for forms.

## Tests (focused, not run here)

| Area | Files |
|------|--------|
| Schema / gates | `public-marketing-form-schema.test.ts`, `public-form-collection.test.ts`, `public-marketing-form-policy.test.ts` |
| Refusals | `public-marketing-form-submission.test.ts`, `application-schema.test.ts`, `submission-adapter.test.ts`, contact/apply `actions.test.ts` |
| UI | `contact-labels.test.tsx`, `apply-route.test.tsx` |
| AI policy | `founding-cohort-spend-policy.test.ts` |
| SQL lane (disposable) | `scripts/test-ai-budget-sql.sh` — pence-cap section after base budget proofs |

## Operator enablement (later)

1. Confirm inbox; set `CONSTRUCTA_PUBLIC_MARKETING_INBOX_DESTINATION`.
2. Set `CONSTRUCTA_PUBLIC_FORM_COLLECTION_ENABLED=1` only when routing exists.
3. Apply AI migration; set each enabled feature’s `max_reserve_pence`; re-run `scripts/test-ai-budget-sql.sh`.
R1 grade: rollback comment stub moved out of migrations into private preservation; executable rollback only under docs. NULL/zero pricing and NULL monthly limits fail closed. Fixed global-cap SQL case to use 100pence and a second contractor (avoids earlier in-flight refusal). This covers ai_generation_* and its current cohort callers; the separate job-assistant route remains gated/off and is not claimed covered by this new GBP ledger. No real provider price bounds verified, no production apply or active cap claim. Local validation blocked below18GiB; GitHub CI required.
