"use client";

import { ChevronDown } from "lucide-react";
import { FoundingCohortPricingPanel } from "./founding-cohort-pricing-panel";

const faqs = [
  {
    question: "Can I pay on this page?",
    answer:
      "No. This preview does not take a payment or sell a subscription. Apply to the founding cohort if you want to register interest.",
  },
  {
    question: "What is the founding member discount?",
    answer:
      "Founding member discount is 25% off monthly list. Month 1 is full price (£50 Pro / £80 Business); from month 2, £37.50 Pro / £60 Business (GBP, ex VAT). Eligibility, duration and offer end date remain for owner review before publication. Quarterly and annual discounts do not combine with the founding discount.",
  },
  {
    question: "How do I get access now?",
    answer:
      "Existing review accounts can sign in. New signup and application collection remain off. The planned inbox is hello@constructa.co, but it is not set up yet.",
  },
  {
    question: "Do I need to install anything?",
    answer: "No. Constructa runs in a modern web browser.",
  },
];

export default function FullPricingPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 pt-32">
        <FoundingCohortPricingPanel variant="standalone" />

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-zinc-800 pt-24 mt-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 items-start">
            <div>
              <h2 className="text-3xl font-bold text-white">Have questions?</h2>
            </div>
            <div className="md:col-span-2 divide-y divide-zinc-800">
              {faqs.map((faq) => (
                <details key={faq.question} className="py-4 group">
                  <summary className="flex justify-between items-center cursor-pointer font-medium text-white list-none text-left">
                    <span className="text-base">{faq.question}</span>
                    <ChevronDown className="h-4 w-4 text-gray-400 group-open:rotate-180 transition-transform duration-300" />
                  </summary>
                  <p className="text-sm text-gray-400 mt-2 pr-6">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}