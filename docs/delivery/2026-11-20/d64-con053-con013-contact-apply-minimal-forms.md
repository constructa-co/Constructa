# D64 — CON053 / CON013 contact and apply minimal forms (source-only)

**Date:** 2026-11-20  
**Lane:** Source-only; no local build/test run, commit, push, env apply, SQL, or live submissions in this session.  
**Release:** Eligible under D58 only after root CI and independent review.

## Outcome

Public **contact** (`/contact`, full profile + home contact panel) and **apply** (`/apply`) now share one minimal field set:

- Name, email, required message, optional company, required consent checkbox.
- **Collection default-off** via `CONSTRUCTA_PUBLIC_FORM_COLLECTION_ENABLED` (exactly `1` when opted in).
- Destinations referenced **by env var name only** in source and UI copy:
  - `CONSTRUCTA_PUBLIC_CONTACT_FORM_DESTINATION`
  - `CONSTRUCTA_PUBLIC_APPLY_FORM_DESTINATION`
- Server actions and submission helpers **fail closed** when the flag or destination is absent; no Formspree POST, no fetch, no store, no email while off.
- Cohort profile `/contact` remains **mailto-only** (no form).

## Files touched (product source)

| Area | Paths |
|------|--------|
| Gates + schema | `src/lib/marketing/public-form-collection.ts`, `public-marketing-form-schema.ts`, `public-marketing-form-submission.ts` (+ focused tests) |
| Apply | `src/lib/founding-cohort/application-schema.ts`, `submission-adapter.ts`, `src/app/apply/actions.ts`, `page.tsx`, `src/components/marketing/founding-cohort-apply-form.tsx`, `founding-cohort-apply-page.tsx`, `founding-cohort-apply-storage-notice.tsx`, `founding-cohort-apply.module.css` |
| Contact | `src/app/contact/page.tsx`, `actions.ts`, `src/components/marketing/contact-marketing-form.tsx`, `public-marketing-lead-form.tsx`, `public-form-collection-notice.tsx` |
| Home (full) | `src/components/marketing/full-home.tsx` (Formspree removed) |
| Tests | `src/app/apply/*.test.*`, `src/app/contact/*.test.*`, `src/components/marketing/*test*`, `src/lib/founding-cohort/*.test.ts`, `src/lib/marketing/*.test.ts` |

## Limits / not claimed

- Destination **routing is not implemented**: when collection is enabled and a destination value is present, `submitPublicMarketingForm` still throws (`…not implemented…`) — no HTTP, DB, or provider calls.
- **No test execution** in this lane; evidence is source + focused Vitest files only.
- **No env values** set or documented beyond variable names.
- Full-profile **home** contact panel reads collection readiness in a client bundle (non-`NEXT_PUBLIC` env → stays off in the browser); server-rendered `/contact` and `/apply` pass readiness from the server.

## Operator enablement (later, not in this change)

1. Set `CONSTRUCTA_PUBLIC_FORM_COLLECTION_ENABLED=1`.
2. Set destination values for contact and/or apply in the respective `*_DESTINATION` vars.
3. Implement approved routing in `public-marketing-form-submission.ts` under root review.
Codex integration before packaging: disabled fieldset and absent form action prevent data entry/native submission while OFF; public notice omits environment internals, while source uses names only. No network/storage routing is implemented. Unused non-async server-action exports removed.

Independent review repair: Zod4 consent option corrected; absent optional company maps to undefined; shared form markup tests replace obsolete shallow tree assumptions. Home collection remains explicit false to avoid hydration mismatch; notice reference fixed, client filters React action fields out before validation. Collection and routing stay off.
