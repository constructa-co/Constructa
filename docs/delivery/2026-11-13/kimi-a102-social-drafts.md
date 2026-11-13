# A102 — LinkedIn & Facebook draft posts from approved Guides content

**Artifact status:** DRAFT · NOT APPROVED · NOT PUBLISHED · NOT SENT · NOT SCHEDULED
**Author:** Kimi (offline pass, 2026-11-13), branch `codex/r1-20261113-a102-social`
**Purpose:** Channel-ready draft posts for human review and manual posting only. Nothing here has been posted, sent, scheduled or published anywhere.
**Packaging:** Codex owns review, grading and draft-PR packaging. This file is saved only; no commit, push or PR by Kimi.

---

## Source Guides (approved existing content — cited, not invented)

All post copy below is drawn only from the two approved Guides articles in the repository:

| Guide | Title | Route | Source file |
| --- | --- | --- | --- |
| 1 | Review your company profile, brief and price | `https://www.constructa.co/guides/review-brief-and-price` | `src/lib/marketing-guides.ts` (`GUIDE_ARTICLES`, slug `review-brief-and-price`) |
| 2 | Check programme and proposal before sharing | `https://www.constructa.co/guides/programme-and-proposal-before-sharing` | `src/lib/marketing-guides.ts` (`GUIDE_ARTICLES`, slug `programme-and-proposal-before-sharing`) |

- Guides hub: `https://www.constructa.co/guides` (served by `src/app/guides/page.tsx` → `src/components/marketing/guides-hub.tsx`)
- Guide article pages: `src/app/guides/[slug]/page.tsx` → `src/components/marketing/guide-article-view.tsx`
- Guide attribution per source: author "Constructa", preparation "AI-assisted draft guidance", content updated 4 November 2026 (`GUIDE_ARTICLE_ATTRIBUTION` in `src/lib/marketing-guides.ts`). Posts should not present the guides as expert-reviewed.
- Guides hub framing (source): checklists "written for people using an existing review account — not a claim that every held feature is available."

## Shared boundaries from the source (must not be contradicted)

From `GUIDE_ARTICLES` (`previewNote`, `intro`, step text) in `src/lib/marketing-guides.ts`:

- This is a **phase-one preview for existing review accounts**. Do not imply new sign-up is open.
- **Held back — do not imply available:** live AI assistance, new sign-up, payments/checkout, complete photo or consent journeys, release for live customer jobs.
- Proposal step facts: on-screen preview; **PDF marked as a draft — downloading it sends nothing**; client response options ask for **receipt or a non-binding intention to proceed, and neither is acceptance**.
- Brief/price step facts: job in your own words with trades, access, restrictions, assumptions, likely start date; one-price items with quantities and rates; price lines with a running total; exclusions and clarifications kept with the job.
- Programme step facts: target start date or working days from Day 1; job duration; optional stages; programme at a glance; finish date or finish day.
- No testimonials, adoption stats, savings figures, price quotes, security certification, or launch dates — none exist in the source.

## Canonical links used in posts (no UTMs, no short links, no new paths)

- `https://www.constructa.co/guides`
- `https://www.constructa.co/guides/review-brief-and-price`
- `https://www.constructa.co/guides/programme-and-proposal-before-sharing`

---

## Post 1 — LinkedIn draft (from Guide 1: company profile, brief and price)

**Status: DRAFT · NOT APPROVED · NOT PUBLISHED**

Before a client sees your number, it is worth pausing on the job itself — not just the bottom line.

Constructa's phase-one review includes a short checklist for exactly that. On the company side: name, trading address, logo, insurance details, accreditations, specialisms and past jobs — with the check that your details are current and each past job suits the proposal it appears in.

On the job side: the brief is the job in your own words — trades involved, access, restrictions, assumptions and a likely start date — plus one-price items with quantities and rates. You get price lines with a running total, and exclusions and clarifications stay with the job. The check is simple: the scope, quantities, rates and total are the ones you intend to stand behind.

These checklists are written for people already using a review account in the phase-one preview — they are working notes for checking your own work, not a claim that every held feature is available.

Read the checklist: https://www.constructa.co/guides/review-brief-and-price
All guides: https://www.constructa.co/guides

---

## Post 2 — Facebook draft (from Guide 1: company profile, brief and price)

**Status: DRAFT · NOT APPROVED · NOT PUBLISHED**

Quick self-check before anything leaves your desk:

1. Company details current — and each past job suits the proposal it appears in.
2. Brief = the job in your own words: trades, access, restrictions, assumptions, likely start date.
3. Price lines have quantities, rates and a running total — and exclusions stay with the job.

The test: the scope, quantities, rates and total are the ones you intend to stand behind.

From Constructa's phase-one review checklists (existing review accounts). Full checklist: https://www.constructa.co/guides/review-brief-and-price

---

## Post 3 — LinkedIn draft (from Guide 2: programme and proposal before sharing)

**Status: DRAFT · NOT APPROVED · NOT PUBLISHED**

A proposal is more than a price PDF — it is dates, stages and terms read together.

Constructa's phase-one review checklist for this stage has two parts. Programme: a target start date (or working days from Day 1), how long the job takes, and optional stages. You get a programme at a glance, and either a finish date or a finish day when the start is not known. The check: the dates, working days and stage order are realistic for this job.

Proposal: payment stages, how many days the price stays valid, and the terms for this proposal. You get an on-screen preview and a PDF marked as a draft — downloading that PDF sends nothing to a client. The checklist's reminder: read the whole preview, and note that client response options ask for receipt or a non-binding intention to proceed — neither is acceptance.

As with the rest of the phase-one preview, these notes are for people using an existing review account, and held items such as live AI assistance, new sign-up and payments are not part of it.

Read the checklist: https://www.constructa.co/guides/programme-and-proposal-before-sharing
All guides: https://www.constructa.co/guides

---

## Post 4 — Facebook draft (from Guide 2: programme and proposal before sharing)

**Status: DRAFT · NOT APPROVED · NOT PUBLISHED**

Before you hit send on a proposal, two checks from Constructa's phase-one review checklist:

Programme — dates, working days and stage order realistic for this job? You get a programme at a glance and a finish date (or finish day if the start isn't fixed).

Proposal — payment stages, how many days the price is valid, and the terms. Read the whole on-screen preview. The PDF is marked as a draft: downloading it sends nothing. And a client "response" is receipt or a non-binding intention to proceed — not acceptance.

Existing review accounts only in this preview. Full checklist: https://www.constructa.co/guides/programme-and-proposal-before-sharing

---

## Pre-publish factual review checklist

Before any manual posting, confirm each item against the cited source files — not against memory or live site behaviour:

- [ ] Every post still says **phase-one preview** / **existing review account** where access is mentioned; no promise of new sign-up, checkout, payments or live customer jobs.
- [ ] No **live AI assistance** or AI capability claims anywhere.
- [ ] Brief/price copy matches Guide 1 step text only (trades, access, restrictions, assumptions, likely start date; one-price items, quantities, rates; running total; exclusions and clarifications kept with the job).
- [ ] Programme copy matches Guide 2 (target start date or working days from Day 1; duration; optional stages; programme at a glance; finish date or finish day).
- [ ] Proposal copy keeps all three facts: on-screen preview; **draft PDF — downloading sends nothing**; client response = receipt or non-binding intention, **not acceptance**.
- [ ] Links are exactly the three canonical routes above — no UTMs, trackers, short links or new paths.
- [ ] Guides are not presented as expert-reviewed (source attribution is "AI-assisted draft guidance", updated 4 November 2026).
- [ ] No testimonials, stats, savings claims, price quotes, security certification or launch dates (none in source).
- [ ] Final wording approved by a human before anything is posted; nothing posted by automation.

---

## Document control

| Field | Value |
| --- | --- |
| Task | A102 — LinkedIn/Facebook drafts from approved Guides content |
| File | `docs/delivery/2026-11-13/kimi-a102-social-drafts.md` |
| Created | 2026-11-13 |
| Sources cited | `src/lib/marketing-guides.ts`; `src/app/guides/page.tsx`; `src/app/guides/[slug]/page.tsx`; `src/components/marketing/guides-hub.tsx` |
| Prior related drafts (not in this branch) | `docs/marketing/approved-content-copy-kit-20261104.md` (d7cb6d9); `docs/delivery/2026-11-08/kimi-marketing-drafts.md` (fb2d075) |
| Publication / sending | None — drafts for human review only |
| Actions taken | File write only. No builds, installs, deletes, settings, credentials, live SQL, signup, push or deploy. |
