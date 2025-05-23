'use client';

import React, { useState } from 'react';
import { Check, ChevronDown, CheckCircle, Zap, Clock } from 'lucide-react';
import Image from 'next/image';

type BillingPeriod = 'monthly' | 'quarterly' | 'annual';

const PLANS = {
  basic: {
    monthly: 20,
    name: 'Basic',
    description: 'Essential tools for individual contractors starting their journey.',
    features: [
      'Up to 2 projects/quarter',
      'Basic proposal templates',
      '1 team members',
      'Standard support'
    ]
  },
  standard: {
    monthly: 40,
    name: 'Standard',
    description: 'Enhanced features for growing construction businesses.',
    features: [
      'Up to 10 projects/quarter',
      'Advanced proposal templates',
      '2 team members',
      'Priority support'
    ]
  },
  professional: {
    monthly: 80,
    name: 'Professional',
    description: 'Advanced tools and privacy for professional contractors.',
    features: [
      'Unlimited projects',
      'Custom proposal templates',
      '5 team members',
      '24/7 priority support'
    ]
  }
};

const calculatePrice = (basePrice: number, billingPeriod: BillingPeriod): number => {
  switch (billingPeriod) {
    case 'quarterly':
      return Math.round(basePrice * 3 * 0.85);
    case 'annual':
      return Math.round(basePrice * 12 * 0.7);
    default:
      return basePrice;
  }
};

const faqs = [
  {
    question: 'How do I pay?',
    answer: 'All plans are billed via Paddle using your preferred payment method. VAT added where applicable.',
  },
  {
    question: 'Can I switch plans later?',
    answer: 'Yes. You can upgrade, downgrade, or cancel your plan at any time.',
  },
  {
    question: 'Is there a free trial?',
    answer: 'We\'ll be offering a 14-day free trial when we launch—join the waitlist to get early access.',
  },
  {
    question: 'How do I cancel?',
    answer: 'You can cancel anytime from your billing dashboard. No penalty, no hassle.',
  },
  {
    question: 'Will you add more features?',
    answer: 'Yes. We\'re actively developing new tools. All plans get regular updates.',
  },
  {
    question: 'Do I need to install anything?',
    answer: 'No. Constructa is fully cloud-based and runs on any modern browser.',
  },
];

export default function PricingPage() {
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');

  const getBillingText = (price: number): string => {
    switch (billingPeriod) {
      case 'quarterly':
        return `£${Math.round(price / 3)}/month`;
      case 'annual':
        return `£${Math.round(price / 12)}/month`;
      default:
        return `£${price}/month`;
    }
  };

  const getBillingSubtext = (): string => {
    switch (billingPeriod) {
      case 'quarterly':
        return 'Billed quarterly';
      case 'annual':
        return 'Billed annually';
      default:
        return 'Billed monthly';
    }
  };

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        {/* Section 1 – Header + Billing Toggle */}
        <section className="text-center mb-12 pt-32">
          <h1 className="text-4xl font-semibold mb-4">Get Started with Constructa</h1>
          <div className="flex justify-center gap-2 mb-4">
            <button onClick={() => setBillingPeriod('monthly')} className={`px-4 py-1 rounded ${billingPeriod === 'monthly' ? 'bg-white text-black' : 'bg-zinc-800 text-green-400'}`}>Monthly</button>
            <button onClick={() => setBillingPeriod('quarterly')} className={`px-4 py-1 rounded ${billingPeriod === 'quarterly' ? 'bg-white text-black' : 'bg-zinc-800 text-green-400'}`}>Quarterly <span className="text-sm">15% OFF</span></button>
            <button onClick={() => setBillingPeriod('annual')} className={`px-4 py-1 rounded ${billingPeriod === 'annual' ? 'bg-white text-black' : 'bg-zinc-800 text-green-400'}`}>Yearly <span className="text-sm">30% OFF</span></button>
          </div>
          <p className="text-gray-400 max-w-xl mx-auto">
            We're offering flexible plans with everything you need to quote, plan, and deliver jobs with confidence.
          </p>
        </section>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-24">
          {/* Basic Plan */}
          <div className="relative p-8 rounded-2xl border border-gray-800/50 bg-black/50 backdrop-blur-sm hover:border-gray-700/50 transition-all duration-300">
            <div className="text-left">
              <h3 className="text-xl font-bold mb-2">{PLANS.basic.name}</h3>
              <p className="text-sm text-gray-400 mb-6">{PLANS.basic.description}</p>
              <div className="mb-6">
                <span className="text-3xl font-bold">{getBillingText(calculatePrice(PLANS.basic.monthly, billingPeriod))}</span>
                <div className="text-xs text-gray-400 mt-1">{getBillingSubtext()}</div>
              </div>
              <button className="w-full py-3 px-4 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors mb-8">
                Get Started
              </button>
              <div className="space-y-4">
                <div className="text-sm text-gray-400 font-medium">What&apos;s included</div>
                {PLANS.basic.features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="none">
                      <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M10 18a8 8 0 100-16 8 8 0 000 16z" stroke="currentColor" strokeWidth="1.5"/>
                    </svg>
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Standard Plan */}
          <div className="relative p-8 rounded-2xl border border-gray-800/50 bg-black/50 backdrop-blur-sm hover:border-gray-700/50 transition-all duration-300">
            <div className="text-left">
              <h3 className="text-xl font-bold mb-2">{PLANS.standard.name}</h3>
              <p className="text-sm text-gray-400 mb-6">{PLANS.standard.description}</p>
              <div className="mb-6">
                <span className="text-3xl font-bold">{getBillingText(calculatePrice(PLANS.standard.monthly, billingPeriod))}</span>
                <div className="text-xs text-gray-400 mt-1">{getBillingSubtext()}</div>
              </div>
              <button className="w-full py-3 px-4 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors mb-8">
                Get Started
              </button>
              <div className="space-y-4">
                <div className="text-sm text-gray-400 font-medium">What&apos;s included</div>
                {PLANS.standard.features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="none">
                      <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M10 18a8 8 0 100-16 8 8 0 000 16z" stroke="currentColor" strokeWidth="1.5"/>
                    </svg>
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Professional Plan */}
          <div className="relative p-8 rounded-2xl border-2 border-white bg-white text-black transition-all duration-300">
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 px-3 py-1 bg-black text-white text-xs font-medium rounded-full">
              Best Value
            </div>
            <div className="text-left">
              <h3 className="text-xl font-bold mb-2">{PLANS.professional.name}</h3>
              <p className="text-sm text-gray-600 mb-6">{PLANS.professional.description}</p>
              <div className="mb-6">
                <span className="text-3xl font-bold">{getBillingText(calculatePrice(PLANS.professional.monthly, billingPeriod))}</span>
                <div className="text-xs text-gray-600 mt-1">{getBillingSubtext()}</div>
              </div>
              <button className="w-full py-3 px-4 rounded-xl bg-black text-white text-sm font-medium hover:bg-gray-900 transition-colors mb-8">
                Get Started
              </button>
              <div className="space-y-4">
                <div className="text-sm text-gray-600 font-medium">What&apos;s included</div>
                {PLANS.professional.features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <svg className="w-5 h-5 text-black" viewBox="0 0 20 20" fill="none">
                      <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M10 18a8 8 0 100-16 8 8 0 000 16z" stroke="currentColor" strokeWidth="1.5"/>
                    </svg>
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Enterprise Plan */}
          <div className="relative p-8 rounded-2xl border border-gray-800/50 bg-black/50 backdrop-blur-sm hover:border-gray-700/50 transition-all duration-300">
            <div className="text-left">
              <h3 className="text-xl font-bold mb-2">Enterprise</h3>
              <p className="text-sm text-gray-400 mb-6">Custom solutions for large construction companies.</p>
              <div className="mb-6">
                <span className="text-3xl font-bold">Custom</span>
                <div className="text-xs text-gray-400 mt-1">Contact for pricing</div>
              </div>
              <button className="w-full py-3 px-4 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors mb-8">
                Contact Sales
              </button>
              <div className="space-y-4">
                <div className="text-sm text-gray-400 font-medium">What&apos;s included</div>
                <div className="flex items-center gap-2 text-sm">
                  <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="none">
                    <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16z" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                  <span>Unlimited everything</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="none">
                    <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16z" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                  <span>Custom integrations</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="none">
                    <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16z" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                  <span>Unlimited team members</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="none">
                    <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16z" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                  <span>Dedicated support team</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Comparison */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mb-24">
          <h2 className="text-2xl font-semibold text-center mb-10">Compare Features</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left text-white border-t border-zinc-700">
              <thead>
                <tr className="text-gray-400">
                  <th className="py-3 pr-4">Feature</th>
                  <th className="py-3 px-4">Basic</th>
                  <th className="py-3 px-4">Standard</th>
                  <th className="py-3 px-4">Professional</th>
                  <th className="py-3 pl-4">Enterprise</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-zinc-800">
                <tr>
                  <td className="py-3 pr-4 font-medium text-white">Projects per quarter</td>
                  <td className="py-3 px-4">2</td>
                  <td className="py-3 px-4">10</td>
                  <td className="py-3 px-4">Unlimited</td>
                  <td className="py-3 pl-4">Unlimited</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-white">Team members</td>
                  <td className="py-3 px-4">1</td>
                  <td className="py-3 px-4">2</td>
                  <td className="py-3 px-4">5</td>
                  <td className="py-3 pl-4">Unlimited</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-white">Branded PDF proposals</td>
                  <td className="py-3 px-4">✓</td>
                  <td className="py-3 px-4">✓</td>
                  <td className="py-3 px-4">✓</td>
                  <td className="py-3 pl-4">✓</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-white">Capability statements</td>
                  <td className="py-3 px-4">✓</td>
                  <td className="py-3 px-4">✓</td>
                  <td className="py-3 px-4">✓</td>
                  <td className="py-3 pl-4">✓</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-white">Customisable T&Cs</td>
                  <td className="py-3 px-4">✓</td>
                  <td className="py-3 px-4">✓</td>
                  <td className="py-3 px-4">✓</td>
                  <td className="py-3 pl-4">✓</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-white">Estimating tool</td>
                  <td className="py-3 px-4">✓</td>
                  <td className="py-3 px-4">✓</td>
                  <td className="py-3 px-4">✓</td>
                  <td className="py-3 pl-4">✓</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-white">Planning tool</td>
                  <td className="py-3 px-4">✓</td>
                  <td className="py-3 px-4">✓</td>
                  <td className="py-3 px-4">✓</td>
                  <td className="py-3 pl-4">✓</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-white">Client dashboard</td>
                  <td className="py-3 px-4">✓</td>
                  <td className="py-3 px-4">✓</td>
                  <td className="py-3 px-4">✓</td>
                  <td className="py-3 pl-4">✓</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-white">Proposal viewer notifications</td>
                  <td className="py-3 px-4">–</td>
                  <td className="py-3 px-4">✓</td>
                  <td className="py-3 px-4">✓</td>
                  <td className="py-3 pl-4">✓</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-white">Export as PDF</td>
                  <td className="py-3 px-4">✓</td>
                  <td className="py-3 px-4">✓</td>
                  <td className="py-3 px-4">✓</td>
                  <td className="py-3 pl-4">✓</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-white">Support level</td>
                  <td className="py-3 px-4">Standard</td>
                  <td className="py-3 px-4">Priority</td>
                  <td className="py-3 px-4">24/7 Priority</td>
                  <td className="py-3 pl-4">Dedicated</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section – Why Choose Constructa */}
        <section className="relative py-32 md:py-40 px-4 md:px-8">
          <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-900/50 to-black"></div>
          <div className="relative max-w-[1400px] mx-auto px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              {/* Left image block */}
              <div className="relative w-full h-[500px] rounded-xl overflow-hidden backdrop-blur-sm bg-black/20">
                <Image
                  src="/images/whyconstructa.png"
                  alt="Built with experience"
                  fill
                  className="object-contain"
                  priority
                />
              </div>

              {/* Right content block */}
              <div className="max-w-[500px]">
                <h2 className="text-3xl md:text-4xl font-semibold text-white leading-tight text-left mb-8">Why Choose Constructa</h2>
                <div className="space-y-8 text-left">
                  <div className="flex gap-4">
                    <CheckCircle className="w-6 h-6 text-white flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="text-sm md:text-base font-medium text-white mb-1">No lock-in contracts</h3>
                      <p className="text-sm md:text-base text-gray-400">
                        Cancel anytime. No hidden fees. Just tools that work.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <Zap className="w-6 h-6 text-white flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="text-sm md:text-base font-medium text-white mb-1">Built for small teams</h3>
                      <p className="text-sm md:text-base text-gray-400">
                        We know every minute and pound matters. That&apos;s why Constructa is priced for practicality—not just power.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <Clock className="w-6 h-6 text-white flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="text-sm md:text-base font-medium text-white mb-1">Simple setup, no training needed</h3>
                      <p className="text-sm md:text-base text-gray-400">
                        Get up and running in minutes. No onboarding calls. Just straightforward tools made for construction.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4 – FAQ */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-zinc-800 pt-24">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 items-start">
            <div>
              <h2 className="text-3xl font-bold text-white">Have questions?</h2>
            </div>
            <div className="md:col-span-2 divide-y divide-zinc-800">
              {faqs.map((faq, idx) => (
                <details
                  key={idx}
                  className="py-4 group"
                >
                  <summary
                    className="flex justify-between items-center cursor-pointer font-medium text-white list-none text-left"
                  >
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