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

## 28 Oct correction (race guard)

| File | Lines (approx) | Change | Intent |
|------|----------------|--------|--------|
| `src/components/postcode-address-picker.tsx` | 35–95, 107–110 | Lookup generation ref + mount guard; invalidate on postcode change; apply results only when generation matches. | Prevent slow query A overwriting fast query B (P2). |
| `src/components/postcode-address-picker.test.tsx` | hooks + 4 new cases | Deferred-promise race, stale error, unmount, dual-picker isolation. | Real async race regression tests. |
| `src/app/dashboard/projects/new/new-project-form-*-address.test.tsx` | `useEffect` mock | Allow mounting picker under existing form harness. | Keep prior 15 form tests green. |

## Verification (this branch)

- Focused Vitest: **4 files, 19 tests PASS** (15 prior + 4 race/isolation; synthetic QA only).
- `tsc --noEmit` PASS.
- Affected ESLint: **0 errors** on changed paths.
- Full `npm run build` (Node 24.19.0) with enforced preview QA target guard (`CONSTRUCTA_NONPROD_SUPABASE_PROJECT_REF=abcdefghijklmnopqrst`, JWT-shaped fake keys in process env only): **PASS** through prerender (31 static pages) + post-build Supabase target check.
