# A074 — Honest proposal cover imagery (draft)

**Status: DRAFT — ROB REVIEW REQUIRED. Design/policy only: no images generated, no uploads, no PDF changes, no code changes.**
Author: Kimi, 2026-11-08, branch `kimi/marketing-drafts-20261108-1020`. Codebase findings from offline source inspection of this branch.

## 1. Register ask and current state

Register A074 (phase "Later", "Not started"): **"Offer an appropriate real cover photo or clearly labelled design/before-after render."**

Current state in `src/lib/pdf/proposal-brochure.ts`: the cover is **logo + typography only** (`cover()`, line 792) — company logo (`document.company.logoUrl`) plus reference/client text. There is no cover-photo feature. Case-study photos elsewhere in the brochure are JPEG-encoded, CORS-fetched client-side images that are **silently skipped** when unavailable (`skippedImages`), so a broken image degrades to absence, never to a broken-image box.

The honest-claim risk is real: a proposal cover is the first thing a client sees, and a render shown without a label reads as evidence of work that hasn't happened.

## 2. The rule set

**Tier 1 — Real cover photo (preferred).**
- Source: the contractor's **own** project photographs, uploaded via the existing case-study/photo-slot upload path (`uploadProfileImageAction` → storage, then `normalisePhotoSlots` in `src/lib/case-library/photos.ts`). Never hotlinked: external URLs can disappear (see current silent-skip behaviour) and hotlinking others' images is a rights problem.
- The photo must be of **work this contractor actually carried out** (their case library is the natural gate).
- No identifiable people, vehicles with readable plates, or neighbouring properties as the focus, unless the contractor confirms they have permission — a consent tick on the upload flow.
- Rights: contractor confirms they own or are licensed to use the image. One line of upload copy is enough; no legal machinery.

**Tier 2 — Design render / before-after (allowed, must be labelled).**
- Always carries an on-image or directly-adjacent caption in the PDF text layer, e.g. **"Artist's impression — not the finished build"** or **"Before / after: indicative design, not yet constructed"**.
- Label wording is **not** contractor-free-text; it's a fixed set of choices, so a render can never ship unlabelled.
- Before-after pairs must be genuinely the same site/view; "before" must not be someone else's project or a stock photo of a generic derelict building.
- The caption must survive export: it is part of the PDF text (findable with Ctrl-F), not baked only into pixels — this is testable.
- Renders are marked in data (e.g. `caption: "artist-impression"`), so any future layout can never accidentally present one as a photo.

**Tier 3 — Never.**
- Stock photography presented as (or implying) the contractor's work.
- AI-generated photorealistic images presented as real projects. (AI-assisted concept work is Tier 2 territory and still needs the render label — whether Constructa offers AI imagery at all is Rob's product decision; this draft assumes renders are contractor-supplied.)
- Watermarked, rights-unclear, or competitor-visible imagery; images lifted from a client's own social media without permission.
- Anything misleading about scale, scope or completeness — no wide-angle "hero" of a £500 job presented as a flagship, no completed-looking renders for work still at design stage without the label.

## 3. Labelled-render guidance (for when the feature is built)

1. **Cover choice UI offers exactly two kinds of image:** "Photo of your work" (from case library) or "Design render / before-after" (with the fixed label picker). The kind is stored on the document.
2. **If a render reaches PDF rendering without a label**, the build fails the render (test-enforced), it does not silently downgrade to unlabelled.
3. Label placement: directly under the image, same width, small but legible size (the brochure already has small-caption styles); never in a running header or footer where it detaches from the image.
4. Before-after: labelled as a pair ("Before — March 2025 / After — artist's impression"), dates only when true.
5. Alt text / accessibility: the caption text doubles as the image description in any HTML preview.

## 4. What to avoid (summary for review)

| Avoid | Why |
| --- | --- |
| Hotlinked or external-URL cover images | Silent skip today; dead links in client-facing PDFs; rights risk |
| Unlabelled renders anywhere in the brochure | Misleading-claim risk; the core of A074 |
| Stock/AI images as cover | Impersonates real capability |
| Images of people/plates without the consent tick | Privacy/permission exposure |
| Letting the label be free text or optional | Labels drift, get deleted, or get "improved" into "photo" |

## 5. Acceptance checks (when implemented)

1. Unit: a document whose cover image has `kind: "render"` and no label is rejected at render time with a named error.
2. Unit: label copy for renders appears in the PDF **text layer** (searchable string), not only drawn pixels.
3. Component: cover picker offers only "photo from case library" or "labelled render"; no free URL input on the cover step.
4. Integration (offline): brochure render with a real photo cover produces 1 cover image, 0 `skippedImages`, and no render-label string on the page.
5. Integration (offline): brochure render with a labelled before-after pair contains exactly two label strings and both photos.
6. Regression: `src/lib/pdf/proposal-brochure.test.ts` stays green (38 tests passed on this branch, 2026-11-08).

## 6. Evidence and limits

- Verified offline: `proposal-brochure.ts` cover is logo+text only; images fetched client-side with silent skip; case-study photos flow through the storage upload action. 38 brochure tests + 99 company-import tests passed from this worktree on 2026-11-08.
- Not verified: no cover-photo feature exists to test against; nothing above is implemented.
- Legal: the consent/rights copy is UX-level, not legal advice — **Rob's review required**.
