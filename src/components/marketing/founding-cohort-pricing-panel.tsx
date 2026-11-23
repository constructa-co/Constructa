import Link from "next/link";
import {
  FOUNDING_COHORT_MONTHLY_PRICE,
  FOUNDING_COHORT_OPENS_LABEL,
  FOUNDING_COHORT_PRICING_HEADLINE,
  FOUNDING_COHORT_PRICING_LEDE,
  FOUNDING_MEMBER_DISCOUNT_LABEL,
  PRICING_OWNER_REVIEW_NOTES,
  PRICING_SETTLED_NOTES,
  PRICING_TIERS,
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

        <div className="grid gap-4 text-left md:grid-cols-3" aria-label="Draft GBP pricing tiers">
          {PRICING_TIERS.map((tier) => (
            <article key={tier.name} className="rounded-2xl border border-white/15 bg-white/5 p-6">
              <h3 className="text-xl font-semibold">{tier.name}</h3>
              <p className="my-3 text-2xl font-bold">{tier.price}<span className="text-sm font-normal"> / month GBP</span></p>
              <p className="text-sm text-gray-300">{tier.features}</p>
            </article>
          ))}
        </div>
        <div className="mt-6 rounded-2xl border border-white/15 p-6 text-left">
          <p className="font-semibold text-emerald-300">{FOUNDING_MEMBER_DISCOUNT_LABEL}</p>
          <p data-founding-price-token className="mt-2">{FOUNDING_COHORT_MONTHLY_PRICE}</p>
          <ul className="mt-4 list-disc space-y-3 pl-5 text-sm text-gray-300" aria-label="Settled pricing and billing (D99)">
            {PRICING_SETTLED_NOTES.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
          <p className="mt-4 text-sm font-medium text-gray-300">Still for owner review before publication:</p>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-gray-400" aria-label="Outstanding owner review">
            {PRICING_OWNER_REVIEW_NOTES.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-gray-400">{FOUNDING_COHORT_OPENS_LABEL}</p>
          <p className="mt-3 text-sm">Signup and payment remain off. Applications are not collected yet.</p>
          <Link href="/apply" className="mt-4 inline-block underline">View founding cohort information</Link>
        </div>
      </div>
    </section>
  );
}