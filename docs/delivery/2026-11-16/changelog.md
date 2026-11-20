## D49 PR #185 blockers — VAT legacy, gate order, preview parity, cover prepend — 16 November 2026

| File | Lines (approx.) | Change | Intent |
| --- | --- | --- | --- |
| `src/lib/company-vat-settings.ts` | vatFrom + select | Legacy 20% when gate off or `vat_registered` null; VAT columns only when gate on | Migration before env `=1` |
| `supabase/migrations/20261116103000_con018_profile_vat_settings.sql` | vat_registered | `DEFAULT NULL` | No false “not registered” for existing rows |
| `src/app/dashboard/projects/proposal/page.tsx` | profile select | `profilePublicationSelectColumns()` | Match publish path |
| `src/lib/proposal-site-photos.ts` | (new) | Prepend on cover upload | First site photo = cover target |
| `src/lib/proposal-site-photos.test.ts` | (new) | cover vs scope ordering | CON-026 regression |

## D49 CON-018 / CON-025 / CON-026 — Company VAT, interview load, cover upload — 16 November 2026

| File | Lines (approx.) | Change | Intent |
| --- | --- | --- | --- |
| `src/lib/company-vat-settings.ts` | (new) | Company VAT helpers + deploy gate | CON-018 |
| `supabase/migrations/20261116103000_con018_profile_vat_settings.sql` | (new) | Profile VAT columns | NOT APPLIED — owner gate |
| `src/lib/company-interview/service.ts` | load paths | Missing storage → empty interview | CON-025 |
| `src/app/dashboard/projects/proposal/review-send-client.tsx` | cover | Upload cover photo in cover section | CON-026 |

## CON-073 — Board stage move confirmation (S45) — 18 November 2026

Checks: focused Vitest on board feedback, board-actions, stage history, A115 source guard (no full build in this session).

| File | Change | Intent |
| --- | --- | --- |
| `src/app/dashboard/project-board.tsx` | Confirm gate before moves; operational copy | Stop accidental Proposal Sent one-clicks |
| `src/app/dashboard/pipeline-stage-move-dialog.tsx`, `src/lib/pipeline-stage-move-copy.ts` | Dialog UI + strings | Clear from/to + cancel |
| `src/lib/pipeline-stage-history.ts`, `src/app/dashboard/board-actions.ts` | Post-write append | History via `project_pipeline_stage_events` when present (schema gate if absent) |

## D51 snags 054 / 061 / 065 — Case-study media: limits, upload feedback — 16 November 2026

Checks: **NOT RUN** in the authoring session (no shell). Evidence, commands to run and the open owner decision are in `d51-case-study-media-evidence.md`.

| File | Lines (approx.) | Change | Intent |
| --- | --- | --- | --- |
| `src/lib/storage/public-image.ts` | 31–62 | `publicImageProblem` (size and declared type) and `PUBLIC_IMAGE_LIMITS_HINT`; `validatePublicImage` now calls the same check | One wording for the 10 MB / JPEG-PNG-WebP limit on screen and at upload |
| `src/app/dashboard/settings/case-studies/case-studies-client.tsx` | 32–33, 150–186, 301–346, 525–560 | Limits in the photo label; oversize/unsupported/empty picks refused before sending; per-slot "Uploading…" tied to the latest pick; input cleared after each pick; same-file-twice note | Accurate limit messages; feedback for concurrent and repeated picks |
| `src/app/dashboard/settings/case-studies/library/case-study-editor.tsx` | 132–160 | Same pre-send refusal; thrown upload reported, not left unhandled; reply placed on current photos | Two library uploads on their way no longer undo each other (path still gated off) |
| `src/app/dashboard/settings/case-studies/library/case-study-photo-slots.tsx` | 6–15, 43, 57, 65 | Limits in the copy; input cleared after each pick | Same limit wording; same file can be chosen again |
| `src/lib/storage/public-image.test.ts` | 52–82 | `publicImageProblem` cases and wording parity with the upload | Regression |
| `src/app/dashboard/settings/case-studies/photo-upload-outcomes.test.tsx` | 312–470 | Limits, uploading state, refused later pick, same file again and twice | Regression |

Not changed: `saveCaseStudiesAction`, `save-state.ts`, `savePricingExperienceAction` and `saveProposalDraftAction` (no save or compare-and-set path touched); which past jobs a proposal starts with (owner decision, see evidence note).

## D46 CON-028 / CON-029 / CON-030 — Programme regenerate, dependencies, drag — 16 November 2026
## D51 snags 027 / 038 / 039 / 059 — Proposal site photos, director's message, programme labels, terms gap — 16 November 2026

Branch `claude/d51-proposal-evidence`. Presentation versioning resolved against #194 (`caf912d`, #186 label suppression shipped at v3): D51 layout changes are stamped v4; v1–v3 snapshots are drawn as issued. Checks NOT RUN in this session; see `d51-proposal-evidence.md`.

| File | Lines (approx.) | Change | Intent |
| --- | --- | --- | --- |
| `src/lib/proposal-site-photos.ts` | new | `sitePhotoOrigin`, `sitePhotosForJob`, `SITE_PHOTO_ELSEWHERE_ERROR` | 027: tell a photo uploaded for this job from one stored for another job, as branding or as a case study |
| `src/lib/proposal-publication.ts` | 14, 134–147, 520–523, 590–597 | Snapshot and cover photo use only this job's site photos; `CURRENT_DOCUMENT_PRESENTATION_VERSION = 4` | 027: unrelated photo never previewed or sent; 038/039: new layout only on new snapshots |
| `src/app/dashboard/projects/proposal/actions.ts` | 30, 136–141 | Draft save refuses a photo that belongs elsewhere, before any write | 027: unrelated photo never saved to the job |
| `src/app/dashboard/projects/proposal/review-send-client.tsx` | 36, 810–814, 1151 | Inline notice on a saved photo that is left out; closing helper copy states the message is shown once | 027 visibility; 038 copy matches behaviour |
| `src/lib/proposal-document.ts` | 86–87, 213–231, 518 | From presentation 4, director's message already used as the closing is not repeated under About; `presentationVersion` on the document | 038: message shown once; issued snapshots unchanged |
| `src/lib/pdf/proposal-brochure.ts` | 575–583, 600–624 | From presentation 4, a long stage name wraps and its row grows; earlier snapshots keep the first-line layout | 039: no clipped stage label in new PDFs; issued PDFs unchanged |
| `src/lib/proposal-site-photos.test.ts` | new | Origin rules, snapshot/document/preview filtering, issued snapshot untouched | 027 regression |
| `src/app/dashboard/projects/proposal/actions.test.ts` | 23, 56–57, 257–300 | Save refusal without write; publish omits another job's photo with reviewed-content parity | 027 regression |
| `src/lib/proposal-document.test.ts` | 401–480 | Message once on page and PDF; presentations 2 / 3 / absent still show both; full stage name in PDF; presentations 2 / 3 keep one-line rows | 038 / 039 regression |
| `docs/delivery/2026-11-16/d51-terms-gap.md` | new | Terms gap described from source, quoting existing clauses only | 059: documented, no wording changed |
| `docs/delivery/2026-11-16/d51-proposal-evidence.md` | new | Scope, behaviour, evidence limits, owner decisions | Handoff evidence |

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