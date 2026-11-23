/** D102/D99: Rob-settled GBP prices and billing rules; unresolved publication items stay in PRICING_OWNER_REVIEW_NOTES. */
export const CONSTRUCTA_TRADING_NAME = "Constructa";

export const FOUNDING_COHORT_OPENS_LABEL = "Founding cohort opens 7 December 2026";
export const FOUNDING_MEMBER_DISCOUNT_LABEL = "Founding member discount: 25% off";
export const FOUNDING_COHORT_MONTHLY_PRICE =
  "Standard monthly prices (GBP, ex VAT): Pro £50 / Business £80 before founding discount";
export const STANDARD_MONTHLY_PRICE_BEFORE_DISCOUNT = "Pro £50 / Business £80 per month (GBP)";
export const FOUNDING_COHORT_PRICING_HEADLINE = "Founding cohort pricing";
export const FOUNDING_COHORT_PRICING_LEDE =
  "Review draft only — trading name Constructa. Free: basic utility and 1 quote. Pro £50 and Business £80 per month (GBP). This preview does not take payment, sell a subscription or offer a free trial.";

export const PRICING_TIERS = [
  {
    name: "Free",
    price: "£0",
    features:
      "Basic utility and 1 quote. Quote reset period and utility limits: owner review before publication.",
  },
  {
    name: "Pro",
    price: "£50",
    features:
      "Brief, estimate, programme and proposal workflow for a single contractor (draft copy). Quote allowance and exact feature limits: owner review before publication.",
  },
  {
    name: "Business",
    price: "£80",
    features:
      "Same core workflow for a higher quote workload (draft copy). Quote allowance and extra inclusions: owner review before publication. No team or later-phase features promised.",
  },
] as const;

/** D99 settled facts for Rob publication review (not re-opened as open questions). */
export const PRICING_SETTLED_NOTES = [
  "Quarterly billing: 10% discount paid upfront before VAT — £135 Pro / £216 Business per quarter.",
  "Annual billing: 20% discount paid upfront before VAT — £480 Pro / £768 Business per year.",
  "Founding member discount does not combine with quarterly or annual discounts.",
  "Annual 20% is 2.4 months saved versus monthly list at £50/£80; this is not a “two months free” offer.",
  "Founding member discount: 25% off monthly list after the first full-price month — month 1 at £50 Pro / £80 Business, then from month 2 at £37.50 Pro / £60 Business per month (GBP, ex VAT). No free trial.",
  `Trading name: ${CONSTRUCTA_TRADING_NAME} only on this draft. No registered company identity is stated.`,
] as const;

/** Honest owner review still required before publication (no invented legal/eligibility facts). */
export const PRICING_OWNER_REVIEW_NOTES = [
  "Pro/Business feature split, quote allowances, and free-tier reset or utility limits.",
  "Founding eligibility, discount duration, and offer end date / time zone.",
  "Excl. VAT — tax treatment placeholder; no VAT registration is claimed.",
] as const;

export const PRICING_REVIEW_NOTES = [...PRICING_SETTLED_NOTES, ...PRICING_OWNER_REVIEW_NOTES] as const;

export const NO_TESTIMONIALS_POLICY =
  "Constructa does not publish customer testimonials on the marketing site until approved quotes and attributions are supplied.";