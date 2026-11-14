# A103 — Contractor guide draft: exclusions and clarifications

**Artifact status:** DRAFT · NOT APPROVED · NOT PUBLISHED
**Author:** AI-assisted draft (coordinator session, 2026-11-14)
**Purpose:** One original contractor guide draft for the A103 content pilot, prepared for Codex to review and package. Nothing here is published, linked from navigation, or indexed.
**Packaging:** Saved tracked for Codex review and draft packaging only. No commit, push or PR by this session.

---

## De-duplication against existing Guides and drafts

Checked before drafting:

| Existing item | Location | Topic covered |
| --- | --- | --- |
| Guide 1: Review your company profile, brief and price | `src/lib/marketing-guides.ts`, slug `review-brief-and-price` | Company details, brief fields, price lines, running total |
| Guide 2: Check programme and proposal before sharing | `src/lib/marketing-guides.ts`, slug `programme-and-proposal-before-sharing` | Programme dates/stages, proposal preview, draft PDF, client response |
| Guide pilot draft | `docs/marketing/contractor-guide-pilot.md` | Short summaries of the same two Guides |
| A102 social drafts | `docs/delivery/2026-11-13/kimi-a102-social-drafts.md` (merged, #122) | Checklist posts from both Guides |
| A102 social drafts, batch 2 | `docs/delivery/2026-11-14/kimi-a102-social-drafts-20261114.md` | Connected journey and founding cohort angles |

Exclusions and clarifications appear in the sources only as a single line — "Exclusions and clarifications kept with the job" (brief/price step, Guide 1) — and are never developed as a topic in any Guide or draft above. This draft is deliberately narrower and practical: how a contractor decides what to exclude and what to clarify so the total they stand behind means something.

## Sources used (approved public product copy and existing Guides — cited, not invented)

| Source | What it contributes |
| --- | --- |
| `src/lib/marketing-guides.ts` (`GUIDE_ARTICLES`) | Article structure (summary, intro, preview note, add/get/check steps, closing checks), attribution wording, phase-one preview framing, all brief/price/proposal facts |
| `src/lib/marketing-guides.ts` (`GUIDE_ARTICLE_ATTRIBUTION`) | Author "Constructa", preparation "AI-assisted draft guidance" |
| `src/components/marketing/phase-one.tsx` (`stages`, Estimate) | "Describe the job, build your price lines and see how the total comes together. Your scope and your numbers, in one place." / "One-price items, quantities, rates and adjustments." |
| `src/components/marketing/phase-one.tsx` (`Questions`) | "Check the scope, programme and terms for each proposal before sharing it." |
| `src/components/marketing/guides-hub.tsx` (as quoted in the A102 source table) | Guides are "written for people using an existing review account — not a claim that every held feature is available." |

## Shared boundaries (must not be contradicted)

- This is a **phase-one preview for people using an existing review account**. Do not imply general sign-up is open.
- **Held back — do not imply available:** live AI assistance, new sign-up, payments/checkout, complete photo or consent journeys, release for live customer jobs.
- Proposal facts preserved exactly where referenced: on-screen preview; a PDF marked as a draft — downloading it sends nothing; client response options ask for receipt or a non-binding intention to proceed, and neither is acceptance.
- No testimonials, adoption stats, savings figures, price quotes, security certification or launch dates — none exist in the sources.
- No product capability is asserted beyond the cited source lines. In particular, the draft does not claim exclusions appear in a specific proposal section, are auto-generated, or are legally reviewed.

---

## Draft guide article

Proposed slug: `exclusions-and-clarifications` (new path — publication decision belongs to editorial review, not this draft)

**Title:** Set out exclusions and clarifications with the job

**Summary:** What to write down alongside your price lines so the scope, quantities, rates and total are the ones you intend to stand behind.

**Preview note:** In this phase-one preview, using an existing review account.

**Attribution:** Author "Constructa" · Preparation "AI-assisted draft guidance" · (content-updated date to be set by editorial review at publication)

### Intro

The brief and price guides cover what to add. This note is about the companion habit: writing down what is not in the price and what you are assuming. In Constructa, exclusions and clarifications are kept with the job, so they stay attached to the scope they belong to instead of living in a separate email or a memory. These notes are for checking your own work while using an existing review account — not for live customer jobs or release claims.

### Step 1 — Exclusions: say what the price does not cover

**Add:**

- Anything the client might reasonably assume is included, but is not
- Work that belongs to other trades or to the client themselves
- Items that depend on decisions the client has not made yet

**Get:**

- Exclusions kept with the job, beside the price lines they qualify
- A shorter list of surprises when the work starts

**Check:** Every exclusion is specific to this job — not a copied paragraph that no longer matches the brief.

### Step 2 — Clarifications: say what you are assuming

**Add:**

- The access, restrictions and assumptions already recorded in the brief, where they affect the price
- What the one-price items, quantities and rates assume about the work
- Anything that would change the total if it turns out differently

**Get:**

- Clarifications kept with the job, next to the scope and numbers they explain
- A running total you can stand behind because its conditions are written down

**Check:** The scope, quantities, rates and total are the ones you intend to stand behind — with the exclusions and clarifications read together, not separately.

### Closing checks

- Every exclusion is specific to this job — not a copied paragraph that no longer matches the brief.
- The scope, quantities, rates and total are the ones you intend to stand behind — with the exclusions and clarifications read together, not separately.
- Check the scope, programme and terms for each proposal before sharing it.

---

## Pre-publish editorial review checklist

Before any publication, confirm each item against the cited source files — not against memory or live site behaviour:

- [ ] Article keeps the **phase-one preview / existing review account** framing; no promise that general sign-up is open.
- [ ] Attribution stays "AI-assisted draft guidance"; the guide is not presented as expert-reviewed.
- [ ] The only product claims are the cited ones: exclusions and clarifications kept with the job; one-price items, quantities and rates; price lines with a running total; checking scope, programme and terms before sharing.
- [ ] No held feature (live AI assistance, new sign-up, payments, complete photo/consent journeys) is implied as available.
- [ ] No testimonials, stats, savings claims, price quotes, security certification or launch dates.
- [ ] Proposed slug `exclusions-and-clarifications` does not collide with existing guide routes; final URL verified before publication.
- [ ] If published, the guide is noindex or not linked from navigation per the A103 pilot gate (CTO 15:25 direction, 13 Nov 2026).
- [ ] Fact and tone pass by a human reviewer (UK small-contractor accuracy, no unverifiable claims) before any publication.

---

## Document control

| Field | Value |
| --- | --- |
| Task | A103 — one original contractor guide draft (exclusions and clarifications) |
| File | `docs/delivery/2026-11-14/a103-guide-draft-exclusions-clarifications.md` |
| Created | 2026-11-14 |
| Sources cited | `src/lib/marketing-guides.ts`; `src/components/marketing/phase-one.tsx`; `src/components/marketing/guides-hub.tsx` (via A102 source table) |
| Prior related items | Existing Guides (slugs `review-brief-and-price`, `programme-and-proposal-before-sharing`); `docs/marketing/contractor-guide-pilot.md`; `docs/delivery/2026-11-13/kimi-a102-social-drafts.md`; `docs/delivery/2026-11-14/kimi-a102-social-drafts-20261114.md` |
| Publication / sending | None — unpublished draft for Codex packaging and human editorial review |
| Actions taken | File write only. No builds, installs, pushes, deletes, settings, credentials, live SQL, signup or deploy. |
