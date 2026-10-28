# A040 Postcode-First Address Selection — 28 October 2026

## Intent

Deliver postcode-first **site** and separate **client** address UX with manual structured Use/Clear (existing) and unusual-site fallback, without activating a live lookup provider or copying client → site.

## Files amended

| File | Change |
|------|--------|
| `src/lib/postcode-address.ts` (new) | Types, normalisation, honest messages; no network/provider. |
| `src/lib/postcode-address.test.ts` (new) | Synthetic normalisation/message tests. |
| `src/components/postcode-address-picker.tsx` (new) | Postcode-first UI; optional injected `lookup`; explicit candidate pick only. |
| `src/components/postcode-address-picker.test.tsx` (new) | Unconfigured vs injected lookup behaviour. |
| `src/components/job-address-field.tsx` (new) | Site/client field: picker + free text + unusual-site + `ManualAddressEntry`. |
| `src/app/dashboard/projects/new/new-project-form.tsx` | Replace plain textareas with `JobAddressField`; optional `postcodeLookup` prop for QA. |
| `src/app/dashboard/projects/new/new-project-form-manual-address.test.tsx` | Mount tree walks `JobAddressField` / `PostcodeAddressPicker`. |
| `src/app/dashboard/projects/new/new-project-form-postcode.test.tsx` (new) | Injected lookup isolation and unusual-site site-only guidance. |
| `src/app/dashboard/projects/settings/client-page.tsx` | Postcode picker + unusual-site note on site; separate client/site textareas preserved. |

## Limits (A040 remains Partial)

- **Provider gap:** `product-decisions-20261018.json` — no live address search activation. Production shows postcode-first UI and manual paths only; `Find addresses` reports not connected until a provider is chosen and wired.
- **Legacy:** `src/components/postcode-lookup.tsx` still calls postcodes.io if used elsewhere; not wired into new-project/settings in this slice.
- No schema/SQL/env keys/hosted signup/publication.

## Verification (this branch)

- Focused Vitest: 4 files, 15 tests PASS (synthetic QA only).
- `tsc --noEmit` PASS.
- `eslint .` — 0 errors (pre-existing warnings retained).
- Full `npm run build` — see commit message / agent output for pass/fail.
