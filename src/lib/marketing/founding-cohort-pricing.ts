/** D91: Rob's GBP prices; discount timing, billing and tier features remain review proposals. */
export const FOUNDING_COHORT_OPENS_LABEL = "Founding cohort opens 7 December 2026";
export const FOUNDING_MEMBER_DISCOUNT_LABEL = "Founding member discount: 25% off";
export const FOUNDING_COHORT_MONTHLY_PRICE = "Pro £50 / Business £80 per month (GBP)";
export const STANDARD_MONTHLY_PRICE_BEFORE_DISCOUNT = "Pro £50 / Business £80 per month (GBP)";
export const FOUNDING_COHORT_PRICING_HEADLINE = "Founding cohort pricing";
export const FOUNDING_COHORT_PRICING_LEDE = "Review draft only. Free basic utility and 1 quote, with paid tiers at £50 and £80 per month. This preview does not take a payment, sell a subscription or offer a free trial.";
export const PRICING_TIERS = [
  { name: "Free", price: "£0", features: "Basic utility and 1 quote. Quote reset period and utility limits: for Rob to confirm." },
  { name: "Pro", price: "£50", features: "Proposed: brief, estimate, programme and proposal for a single contractor. Quote allowance and exact feature limits: for Rob to confirm." },
  { name: "Business", price: "£80", features: "Proposed: the same core workflow for a higher quote workload. Quote allowance and extra inclusions: for Rob to confirm. No team or later-phase features promised." },
] as const;
export const PRICING_REVIEW_NOTES = [
  "Billing: monthly, quarterly or annual. For Rob to confirm: quarterly 10% off (£135 Pro / £216 Business per quarter); annual 20% off (£480 Pro / £768 Business per year), paid upfront.",
  "Annual arithmetic: 20% off is 2.4 months saved, not 2 months free. Two months free would be 16⅔% off. For Rob to confirm which offer to use.",
  "Founding discount: 25% off. For Rob to confirm: after the first full-price month, from month 2 onwards (£37.50 Pro / £60 Business monthly). No free trial is offered by this draft.",
  "For Rob to confirm: founding eligibility, discount duration, offer end date/time zone and whether the founding discount combines with quarterly or annual discounts. No combined discount is assumed.",
  "Excl. VAT — placeholder pending Rob confirmation of tax treatment. No company or VAT registration is claimed.",
] as const;
export const NO_TESTIMONIALS_POLICY = "Constructa does not publish customer testimonials on the marketing site until approved quotes and attributions are supplied.";
