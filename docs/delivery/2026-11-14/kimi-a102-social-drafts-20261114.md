# A102 — LinkedIn & Facebook draft posts (batch 2: phase-one journey and founding cohort)

**Artifact status:** DRAFT · NOT APPROVED · NOT PUBLISHED · NOT SENT · NOT SCHEDULED
**Author:** Kimi (offline pass, 2026-11-14), branch `kimi/a102-social-20261114`
**Purpose:** Channel-ready draft posts for human review and manual posting only. Nothing here has been posted, sent, scheduled or published anywhere.
**Packaging:** Saved tracked for Codex review and draft-PR packaging. No commit, push or PR by Kimi.

---

## De-duplication against existing drafts

The merged batch-1 file `docs/delivery/2026-11-13/kimi-a102-social-drafts.md` (main via #122) already covers the two approved Guides articles — checklist-style posts from `review-brief-and-price` and `programme-and-proposal-before-sharing`. This batch deliberately avoids repeating that angle:

- No re-use of the guides' "what to add / what to check" checklist framing.
- New angle A: the **one connected work-winning journey** (Company → Price → Programme → Proposal) from the approved phase-one marketing pages.
- New angle B: the **founding cohort announcement** (opens 7 December 2026), stated exactly as the approved page states it.

## Source copy (approved public site content — cited, not invented)

All post copy below is drawn only from approved public marketing pages in the repository:

| Source | Route | Source file |
| --- | --- | --- |
| Phase-one home | `https://www.constructa.co/` | `src/components/marketing/phase-one.tsx` (`PhaseOneHome`) |
| Phase-one features | `https://www.constructa.co/features` | `src/components/marketing/phase-one.tsx` (`PhaseOneFeatures`) |
| Preview access / pricing | `https://www.constructa.co/pricing` | `src/components/marketing/phase-one.tsx` (`PhaseOnePricing`) |
| Founding cohort apply | `https://www.constructa.co/apply` | `src/app/apply/` |

Exact approved phrases used, with their source:

- "Good work. Clearly priced. Better presented." — hero, `phase-one.tsx`
- "One connected work-winning journey. Company profile, brief, price, programme and proposal, with room for your own experience and judgement." — `PhaseOneFeatures` intro, `phase-one.tsx`
- Journey steps (titles and descriptions): "Make it your business." / "Put a price to the work." / "Give the job a plan." / "Present the whole picture." — `Journey` data, `phase-one.tsx`
- "This phase-one preview brings together company profiles, estimating, programmes and proposals. It is a working review, not a claim that every part is ready for release." — `Scope`, `phase-one.tsx`
- "Founding cohort opens 7 December 2026. Apply is separate from sign-in. This preview does not take a payment." — `Invitation`, `phase-one.tsx`
- "Phase one review · Built for domestic and commercial contractors" — hero review note, `phase-one.tsx`
- "This page does not sell a subscription, promise a free trial or take payment for later-phase features." — `PhaseOnePricing` intro, `phase-one.tsx`

## Shared boundaries (must not be contradicted)

- This is a **phase-one review for people using an existing review account**. Do not imply general sign-up is open; the only public access route named in the source is applying to the founding cohort.
- **Held back — do not imply available:** live AI chat assistance, payments/checkout, complete photo or consent journeys, release for live customer jobs.
- No testimonials, adoption stats, savings figures, price quotes, security certification or launch dates — none exist in the source. The only date used is the approved "Founding cohort opens 7 December 2026".

## Canonical links used in posts (no UTMs, no short links, no new paths)

- `https://www.constructa.co/`
- `https://www.constructa.co/features`
- `https://www.constructa.co/pricing`
- `https://www.constructa.co/apply`

---

## Post 1 — LinkedIn draft (angle A: one connected journey)

**Status: DRAFT · NOT APPROVED · NOT PUBLISHED**

Good work. Clearly priced. Better presented.

Constructa's phase-one preview is built as one connected work-winning journey: company profile, brief, price, programme and proposal — with room for your own experience and judgement.

The journey in four steps:

1. Make it your business. Introduce your company, your experience and the work you are proud of — a profile you can use again.
2. Put a price to the work. Describe the job, build your price lines and see how the total comes together.
3. Give the job a plan. Set out when the work starts, how long it takes and the stages along the way.
4. Present the whole picture. Bring your business, scope, price, programme and terms together, and check the finished proposal before sharing it.

This is a phase-one review for people using an existing review account — a working review, not a claim that every part is ready for release.

See the phase-one scope: https://www.constructa.co/features
How preview access works: https://www.constructa.co/pricing

---

## Post 2 — Facebook draft (angle A: one connected journey)

**Status: DRAFT · NOT APPROVED · NOT PUBLISHED**

Four steps in Constructa’s phase-one preview

1. Make it your business — company profile, your experience, the work you're proud of.
2. Put a price to the work — describe the job, build your price lines, see the total.
3. Give the job a plan — start date, duration, stages along the way.
4. Present the whole picture — business, scope, price, programme and terms in one proposal, checked before sharing.

That's the phase-one Constructa preview, built for domestic and commercial contractors — currently a review for existing review accounts.

More: https://www.constructa.co/features

---

## Post 3 — LinkedIn draft (angle B: founding cohort)

**Status: DRAFT · NOT APPROVED · NOT PUBLISHED**

Constructa's founding cohort opens 7 December 2026.

The phase-one preview brings together company profiles, estimating, programmes and proposals — the work-winning essentials, not a catalogue of add-ons. It is a working review, not a claim that every part is ready for release.

Two things worth knowing from the preview-access page itself:

- Apply is separate from sign-in. This preview does not take a payment.
- The preview does not sell a subscription, promise a free trial or take payment for later-phase features.

The application form is a preview. It cannot accept submissions yet.

Phase one review, built for domestic and commercial contractors.

See the founding cohort application preview: https://www.constructa.co/apply
How preview access works: https://www.constructa.co/pricing

---

## Post 4 — Facebook draft (angle B: founding cohort)

**Status: DRAFT · NOT APPROVED · NOT PUBLISHED**

Constructa's founding cohort opens 7 December 2026.

Phase one brings company profiles, estimating, programmes and proposals into one work-winning journey for domestic and commercial contractors.

The application form is separate from sign-in. It is a preview and cannot accept submissions yet. The preview takes no payment.

See the application preview: https://www.constructa.co/apply

---

## Pre-publish factual review checklist

Before any manual posting, confirm each item against the cited source files — not against memory or live site behaviour:

- [ ] Every post keeps the **phase-one review / existing review account** framing; no promise that general sign-up is open.
- [ ] The founding cohort date appears exactly as "7 December 2026" and only as stated in `phase-one.tsx`.
- [ ] "Apply is separate from sign-in. This preview does not take a payment." is preserved where the cohort is mentioned.
- [ ] No **live AI assistance** or AI capability claims anywhere.
- [ ] No testimonials, stats, savings claims, price quotes, security certification or launch dates (none in source).
- [ ] Links are exactly the canonical routes above — no UTMs, trackers, short links or new paths.
- [ ] No overlap with the merged batch-1 guides checklist posts (`docs/delivery/2026-11-13/kimi-a102-social-drafts.md`); if both batches are scheduled, they should not run on the same day as near-identical content.
- [ ] Final wording approved by a human before anything is posted; nothing posted by automation.

---

## Document control

| Field | Value |
| --- | --- |
| Task | A102 — LinkedIn/Facebook drafts, batch 2 (phase-one journey + founding cohort) |
| File | `docs/delivery/2026-11-14/kimi-a102-social-drafts-20261114.md` |
| Created | 2026-11-14 |
| Sources cited | `src/components/marketing/phase-one.tsx`; `src/app/apply/` |
| Prior related drafts | `docs/delivery/2026-11-13/kimi-a102-social-drafts.md` (merged, #122); `docs/marketing/approved-content-copy-kit-20261104.md` (d7cb6d9, not in main); `docs/delivery/2026-11-08/kimi-marketing-drafts.md` (fb2d075, not in main) |
| Publication / sending | None — drafts for human review only |
| Actions taken | File write and `git add` only. No tests, builds, installs, deletes, settings, credentials, live SQL, signup, push or deploy. Untracked consent review `docs/reviews/2026-11-14-a023-signup-terms-consent-redteam-draft.md` preserved untouched. |
