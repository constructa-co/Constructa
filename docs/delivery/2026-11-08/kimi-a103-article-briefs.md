# A103 — Contractor-content pilot design (draft)

**Status: DRAFT — ROB REVIEW REQUIRED. No publication, no CMS posting, no ranking/traffic guarantee, no analytics change.**
Author: Kimi, 2026-11-08, branch `kimi/marketing-drafts-20261108-1020`. Purpose: design a small, expert-reviewed content pilot tied to the product, with explicit human-review gates, per the A103 register wording ("small useful contractor-content pilot and review search/traffic/conversion results").

## 1. Pilot shape (proposal)

- **Volume:** 4 articles total, published over ~8 weeks (fortnightly cadence). Small on purpose — quality and review depth over volume.
- **Audience:** UK SME construction firms — general builders, small commercial contractors, specialist trades doing quoted work (vocabulary grounded in the A006 draft in this folder).
- **Home:** a `/guides`-style area already exists in the app (`src/lib/marketing-guides.ts`, `src/components/marketing/guide-article-view.tsx`, `src/app/guides/...`) with a prior "truthful Guides attribution" commit — new pilot content should follow that same truthful-attribution pattern. Publishing mechanism itself is a separate reviewed action.
- **Goal:** earn qualified organic visits from contractor-intent searches and demonstrate those visitors reaching the product (signup/preview interest), not to hit volume targets.

## 2. Article briefs (4)

Each brief: working title, target reader, search intent, product tie, structure, review needs. Titles are drafts and may change at review.

### Brief 1 — "How to price a building job: a small builder's guide to quoting"
- Reader: general builders / single-trade firms quoting domestic extensions, refurb, small commercial works.
- Intent: informational ("how to quote a building job", "how to price building work UK").
- Angle: walk through measure → materials/labour build-up → margin → presenting the quote, with the failure modes (under-pricing variations, forgetting prelims, dayworks).
- Product tie: the estimate/proposal flow (existing pillars "Fast, accurate proposals", "Built-in cost control"). Reference the product once, honestly, near the end.
- Review: needs a practising builder or estimator to sanity-check the pricing steps; Rob to approve the product mention.

### Brief 2 — "Programme vs schedule of works: what small contractors actually need to plan a job"
- Reader: small contractors moving from verbal/handwritten planning to a visible programme.
- Intent: mixed informational/comparison ("construction programme template", "schedule of works template").
- Angle: demystify the programme as a client-communication tool (ties to existing "One-tap updates"/client-delivery imagery) — milestones, look-ahead weeks, what to show clients vs what is internal.
- Product tie: simple programme feature; show a real screen capture if Rob approves, labelled as such per A084 imagery rules.
- Review: practitioner check that the planning language matches site reality; accessibility check on any table/images.

### Brief 3 — "CIS for small builders: the subcontractor paperwork that trips people up"
- Reader: builders who engage subbies (labour-only and supply-and-fix).
- Intent: informational with compliance weight ("CIS tax subcontractors", "construction industry scheme guide").
- Angle: plain-English explainer — registration, monthly returns, deduction rates, record keeping; explicitly **not** tax advice, point to GOV.UK.
- Product tie: light — cost-control/record-keeping framing only; no tax claims in product copy.
- Review: **higher gate** — this touches tax/regulation; requires a human with relevant knowledge (accountant or experienced contractor) plus Rob sign-off; if no reviewer available, drop this brief rather than publish unreviewed.

### Brief 4 — "Winning repeat work: how clients choose a small building firm"
- Reader: owner-operators doing domestic work.
- Intent: commercial-adjacent ("how to get more building work", "win construction clients").
- Angle: trust signals (checked trades memberships, references, clear written quotes, tidy variations handling), mapped to what Constructa helps evidence (professional proposals, case-study narratives — the case-library feature).
- Product tie: case-study/capability framing; honest, no invented results.
- Review: marketing voice + practitioner check that advice isn't generic fluff.

## 3. SEO guidance (draft rules for the pilot)

- One primary search intent per article; title and H1 aligned; no keyword stuffing.
- URL slugs short and literal (`/guides/how-to-price-a-building-job`).
- Internal links: each article links to the relevant product area and to one other guide where natural.
- Canonical: self-referencing canonical on each guide page; if content is ever syndicated, canonical must point back (this is guidance for the publishing action, not a code change here).
- No AI-content-spam patterns: every article has a named human reviewer; publish only reviewed versions.
- Search-demand claims (volumes, difficulty) are **not asserted** in this draft — verify with Rob's keyword tool before finalising titles.

## 4. Accessibility & quality guidance

- Plain English (aim: readable by a busy tradesperson on a phone).
- Semantic headings, descriptive alt text on images, tables avoided for layout; data tables marked up properly.
- No stats without a citable source (consistent with the A084 recommendation); date-stamp factual articles and review annually.
- Reading level and mobile rendering checked by a human before publication.

## 5. Metrics & review loop (read-only reporting, no new analytics)

With Rob's approval only, the pilot would measure, from existing/planned reporting:
1. Organic impressions/clicks per article (search console).
2. Guide-page visits → product-page visits → signup/preview-interest events (using the acquisition measurement only when Rob re-enables it — currently disabled per register).
3. Qualitative: replies/messages referencing articles.
Review loop: monthly one-page report to Rob for the pilot duration; decision point after article 4 — continue, change, or stop. **No ranking or traffic outcome is promised.**

## 6. Explicit human-review gates

| Gate | Owner | Blocks |
| --- | --- | --- |
| Brief approval (all 4) | Rob | Any writing |
| Practitioner/technical review per article | Named human (builder/estimator; accountant for Brief 3) | Publication of that article |
| Final read + product-mention approval | Rob | Publication of that article |
| Publishing mechanism + analytics | Separate reviewed action | Anything going live |

## 7. What this draft deliberately does NOT do

- No articles written to production/published state, no CMS or route changes.
- No keyword-volume assertions, no traffic/ranking guarantees.
- No overlap with A084 (copy/imagery review) or A102 (social drafts) in `kimi-marketing-drafts.md` — those are separate drafts.

## 8. Status

A103 remains **Not started** — this is the pilot design; no content created, published, or measured.
