# CON-051 — Home social proof and pricing (drafts)

**Status: PRIVATE REVIEW DRAFT · NOT APPROVED · NOT PUBLISHED**
Tracker: CON-051 (P1, Rob-gated — "Review captures shipped in #191. Testimonials and pricing need approved owner inputs.")
Finding: "No real product screenshots, social proof or pricing on Home."

What shipped in #191: the `HomeReviewCaptures` section (`src/components/marketing/home-review-captures.tsx`) — labelled synthetic fixture captures. That satisfies "real product screens as honestly labelled captures" for now. What remains is (a) genuine social proof and (b) any pricing reference. Both are blocked on owner inputs; the drafts below are structured so the sections can be dropped in once inputs arrive.

---

## Draft A — Home social-proof section ("What reviewers say")

Rules before this ever ships: every quote is a real quote from a real named reviewer who has given written permission; no paraphrased or composite quotes; the section is removed entirely rather than run with placeholder or invented quotes.

> **What reviewers say**
>
> "[Exact approved words from reviewer 1.]" — [Full name or approved attribution], [role, e.g. "Director, [company type] contracting"], [context, e.g. "reviewed the phase-one proposal flow"]
>
> "[Exact approved words from reviewer 2.]" — [Attribution 2]
>
> "[Exact approved words from reviewer 3.]" — [Attribution 3]
>
> Reviewers used an existing review account during the phase-one preview. Their words describe their review experience; they are not a promise of results for your business.

Placement note: after the journey/steps section on `full-home.tsx`, before the contact section. Tone matches the existing plain, non-hype voice (cf. "Good work. Clearly priced. Better presented." on `phase-one.tsx` — do not imitate that phrase inside quotes).

Alternative if only one or two reviewers approve: a single-quote layout with the same attribution rules, not a padded carousel.

## Draft B — Home pricing teaser ("Pricing, without the runaround")

Blocked on confirmed pricing (missing input #2). Every number below is a placeholder token, not a value.

> **Pricing, without the runaround**
>
> One plan at a time, priced plainly. The phase-one preview does not take a payment.
>
> - [OWNER INPUT: plan name] — [OWNER INPUT: price and billing period] — [OWNER INPUT: one-line scope]
> - [OWNER INPUT: plan name] — [OWNER INPUT: price and billing period] — [OWNER INPUT: one-line scope]
> - [OWNER INPUT: plan name] — [OWNER INPUT: price and billing period] — [OWNER INPUT: one-line scope]
>
> Founding cohort terms: [OWNER INPUT: cohort pricing terms, or state "available on application"]. Full details: https://www.constructa.co/pricing

Hard rules:

- Do not reference the £20/£40/£80 figures currently in `full-pricing.tsx` anywhere until Rob confirms they are real approved pricing. The tracker note for #191 explicitly says pricing needs approved owner inputs.
- Do not carry support-level claims ("24/7 priority support") into Home copy without confirmation; the phrase currently in `full-pricing.tsx` PLANS is unverified.
- Keep the approved sentence nearby in spirit: the preview does not sell a subscription, promise a free trial or take payment. Do not let the pricing teaser read as a sale.

## If neither input arrives

Ship neither section. Home keeps the review-captures section plus approved phase-one copy; CON-051 stays Rob-gated with this folder as the evidence that copy is ready the moment inputs land.
