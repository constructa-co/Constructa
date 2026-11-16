## D49 P2 visual bundle CON-055–060 — 16 November 2026
## D57 PR #184 repair — postcode gates in the browser, UK date copy — 16 November 2026

Address search stays **off by default**. It turns on only when both `NEXT_PUBLIC_POSTCODE_LOOKUP_ENABLED=1` and `NEXT_PUBLIC_POSTCODE_DATA_TRANSFER_APPROVED=1` are present **at build time** (they are inlined into the client bundle; changing them needs a rebuild).

| File | Lines (approx.) | Change | Intent |
| --- | --- | --- | --- |
| `src/lib/postcode-address-provider.ts` | 21–34 | Gates read as literal `process.env.NEXT_PUBLIC_*` instead of computed `process.env[name]` | Computed access is undefined in client bundles, so lookup could never enable and server/client render disagreed |
| `src/lib/postcode-address-provider.test.ts` | 38–64 | Off when unset or not exactly `1`; source-form guard against computed/destructured env access | Node tests cannot see the browser inlining failure |
| `src/components/postcode-address-picker.tsx` | 62–66, 124–150, 182–186 | With no lookup: postcode box and Find are disabled, gap copy shown once as the described-by hint, no status echo | CON-034 fallback copy was shown twice behind a Find that could only say "not available" |
| `src/components/postcode-address-picker.test.tsx` | 125–163 | Enabled-Find test injects a lookup; unconfigured test asserts disabled controls, one copy, no fetch | Regression |
| `src/components/uk-date-input.tsx` | 11–15, 35, 60–63 | Preview written with full month; help copy no longer claims a browser field order or a proposal/PDF format | CON-035 copy overstated what `lang="en-GB"` controls |
| `src/components/uk-date-input.test.tsx` | whole file | Change-event coverage for uncontrolled and controlled paths, timestamp slicing, `readOnly`/`disabled` pass-through, help-copy guard | Uncontrolled path only had a static-markup test |
| `src/app/dashboard/projects/brief/brief-edit-lock.test.tsx` | 337–345, 412 | Count the `UkDateInput` wrapper as the one input when unlocked; assert no date control when locked | Input count had been weakened from 1 to 0 |

## D49 CON-017 / CON-034 / CON-035 — Brief figures, postcode lookup, UK dates — 16 November 2026

| File | Lines (approx.) | Change | Intent |
| --- | --- | --- | --- |
| `src/lib/proposal-figure-consistency.ts` | 1–82 | Parse £ in brief/proposal text; compare to ex/inc VAT and payment stages | CON-017 consistency checks |
| `src/app/dashboard/projects/proposal/review-send-client.tsx` | imports, `figureWarnings`, readiness alert | Show non-blocking warnings before send | CON-017 visibility on Review & Send |
| `src/lib/postcode-address-provider.ts` | 1–81 | postcodes.io behind `NEXT_PUBLIC_POSTCODE_LOOKUP_ENABLED` and `NEXT_PUBLIC_POSTCODE_DATA_TRANSFER_APPROVED` (both required); configuration gap copy | CON-034 authorised provider + manual fallback |
| `src/components/postcode-address-picker.tsx` | Find + hint | Surface configuration gap when lookup unset | CON-034 UX |
| `src/app/dashboard/projects/new/new-project-form.tsx` | lookup + date | `clientPostcodeLookup()`; `UkDateInput` for start date | CON-034 / CON-035 wiring |
| `src/app/dashboard/projects/settings/client-page.tsx` | pickers + start date | Same lookup + UK date on project settings | CON-034 / CON-035 |
| `src/app/dashboard/projects/brief/brief-client.tsx` | start date | `UkDateInput` with UK preview | CON-035 |
| `src/components/uk-date-input.tsx` | 1–43 | `lang="en-GB"`, written preview, uncontrolled `defaultValue` | CON-035 shared control |
| Tests under `src/lib`, `src/components`, `review-send-client.test.ts` | (new/updated) | Focused regressions | CON-017/034/035 |

## D46 CON-028 / CON-029 / CON-030 — Programme regenerate, dependencies, drag — 16 November 2026

| File | Change | Intent |
|------|--------|--------|
| `src/lib/proposal-document.ts` | Display helpers for job type and fee section titles | CON-055 |
| `review-send-client.tsx` | Cover type filter + signature preview block | CON-055/056 |
| `proposal-document-view.tsx` + `proposal-web-pages.module.css` | Heading breaks + paginated logo sizing | CON-057/060 |
| `proposal-brochure.ts` | Signature field layout logging | CON-056 |
| Tests + `reader-styled.spec.ts` | Regressions and offline reader layout checks | Synthetic evidence |