import Link from "next/link";
import {
  FOUNDING_COHORT_MONTHLY_PRICE,
  FOUNDING_COHORT_OPENS_LABEL,
  FOUNDING_COHORT_PRICING_HEADLINE,
  FOUNDING_COHORT_PRICING_LEDE,
  FOUNDING_MEMBER_DISCOUNT_LABEL,
  STANDARD_MONTHLY_PRICE_BEFORE_DISCOUNT,
} from "@/lib/marketing/founding-cohort-pricing";

type Variant = "standalone" | "embedded";

export function FoundingCohortPricingPanel({ variant = "standalone" }: { variant?: Variant }) {
  const sectionClass =
    variant === "embedded"
      ? "relative bg-black text-white py-16 text-center overflow-hidden"
      : "relative max-w-3xl mx-auto text-center";

  return (
    <section
      className={sectionClass}
      data-founding-cohort-pricing
      aria-labelledby="founding-cohort-pricing-title"
    >
      {variant === "embedded" ? (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05)_0%,transparent_100%)]" />
      ) : null}
      <div className={variant === "embedded" ? "relative max-w-3xl mx-auto px-8" : undefined}>
        <p className="text-sm font-medium tracking-wider uppercase text-white/40 mb-4">
          Draft pricing · not a checkout
        </p>
        <h2
          id="founding-cohort-pricing-title"
          className="text-3xl md:text-4xl font-semibold text-white mb-4"
        >
          {FOUNDING_COHORT_PRICING_HEADLINE}
        </h2>
        <p className="text-gray-400 mb-8 max-w-2xl mx-auto">{FOUNDING_COHORT_PRICING_LEDE}</p>

        <div className="mx-auto max-w-xl rounded-2xl border border-white/15 bg-white/5 p-8 text-left">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300/90 mb-2">
            {FOUNDING_MEMBER_DISCOUNT_LABEL}
          </p>
          <p className="text-2xl font-bold text-white mb-1" data-founding-price-token>
            {FOUNDING_COHORT_MONTHLY_PRICE}
          </p>
          <p className="text-sm text-gray-400 mb-4">
            Standard price before discount: {STANDARD_MONTHLY_PRICE_BEFORE_DISCOUNT}
          </p>
          <p className="text-sm text-gray-400 mb-6">{FOUNDING_COHORT_OPENS_LABEL}</p>
          <Link
            href="/apply"
            className="inline-flex w-full items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-medium text-black hover:bg-gray-100 transition-colors"
          >
            Apply to the founding cohort
          </Link>
          <p className="mt-4 text-xs text-gray-500">
            Apply is separate from sign-in. Billing amounts are confirmed with cohort members before
            any payment is taken.
          </p>
        </div>
      </div>
    </section>
  );
}