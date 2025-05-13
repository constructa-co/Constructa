'use client';

import React, { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState('monthly');

  const getPrice = (basePrice: number) => {
    switch (billingCycle) {
      case 'quarterly':
        return `£${Math.round(basePrice * 3 * 0.85)}/quarter`;
      case 'yearly':
        return `£${Math.round(basePrice * 12 * 0.7)}/year`;
      default:
        return `£${basePrice}/month`;
    }
  };

  const tiers = [
    {
      name: 'Basic',
      basePrice: 20,
      description: 'Essential tools for solo contractors starting out.',
      projects: '2 projects/quarter',
      members: '1 team member',
      features: [
        'Branded PDF proposals',
        'Capability statements',
        'Customisable terms and conditions',
      ],
    },
    {
      name: 'Standard',
      basePrice: 40,
      description: 'Enhanced features for growing construction businesses.',
      projects: '10 projects/quarter',
      members: '2 team members',
      features: [
        'All Basic features',
        'Estimating tool',
        'Planning tool',
      ],
    },
    {
      name: 'Professional',
      basePrice: 80,
      description: 'Advanced tools and collaboration for pros.',
      projects: 'Unlimited projects',
      members: '5 team members',
      features: [
        'All Standard features',
        'Client dashboard',
        'Priority support',
      ],
      bestValue: true,
    },
    {
      name: 'Enterprise',
      basePrice: null,
      description: 'Custom solutions for larger contractors.',
      projects: 'Unlimited',
      members: 'Unlimited',
      features: [
        'All Professional features',
        'Custom integrations',
        'Dedicated support',
      ],
    },
  ];

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        {/* Section 1: Pricing cards with toggle */}
        <section className="text-center mb-12">
          <h1 className="text-4xl font-semibold mb-4">Get Started with Constructa</h1>
          <div className="mb-4 flex justify-center gap-4">
            <button 
              onClick={() => setBillingCycle('monthly')}
              className={`px-3 py-1 rounded transition-colors ${
                billingCycle === 'monthly' 
                  ? 'bg-white text-black' 
                  : 'bg-zinc-800 hover:bg-zinc-700'
              }`}
            >
              Monthly
            </button>
            <button 
              onClick={() => setBillingCycle('quarterly')}
              className={`px-3 py-1 rounded transition-colors ${
                billingCycle === 'quarterly' 
                  ? 'bg-white text-black' 
                  : 'bg-zinc-800 hover:bg-zinc-700'
              }`}
            >
              Quarterly <span className="text-green-400">15% OFF</span>
            </button>
            <button 
              onClick={() => setBillingCycle('yearly')}
              className={`px-3 py-1 rounded transition-colors ${
                billingCycle === 'yearly' 
                  ? 'bg-white text-black' 
                  : 'bg-zinc-800 hover:bg-zinc-700'
              }`}
            >
              Yearly <span className="text-green-400">30% OFF</span>
            </button>
          </div>
          <p className="text-gray-400 max-w-2xl mx-auto">
            We're offering flexible plans with everything you need to quote, plan, and deliver jobs with confidence.
          </p>
        </section>

        {/* Section 2: Visual Placeholder */}
        <section className="flex justify-center mb-16">
          <img 
            src="/images/pricing-visual-placeholder.png" 
            alt="Constructa pricing visual" 
            className="w-full max-w-4xl rounded-xl shadow-lg" 
          />
        </section>

        {/* Section 3: Pricing cards */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-24">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`border rounded-xl p-6 flex flex-col justify-between transition-all duration-200 hover:scale-105 ${
                tier.bestValue 
                  ? 'bg-white text-black shadow-lg border-white' 
                  : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <div>
                <h2 className="text-xl font-semibold mb-1">{tier.name}</h2>
                <p className="text-sm text-gray-400 mb-6">{tier.description}</p>
                <p className="text-2xl font-bold mb-1">
                  {tier.basePrice ? getPrice(tier.basePrice) : 'Custom'}
                </p>
                <p className="text-xs text-gray-500 mb-4">
                  {tier.basePrice ? `Billed ${billingCycle}` : 'Contact for pricing'}
                </p>
              </div>
              <button 
                className={`w-full py-2 rounded-md font-semibold transition-colors duration-200 ${
                  tier.bestValue 
                    ? 'bg-black text-white hover:bg-zinc-800' 
                    : 'bg-white text-black hover:bg-gray-100'
                }`}
              >
                {tier.name === 'Enterprise' ? 'Contact Sales' : 'Get Started'}
              </button>
            </div>
          ))}
        </section>

        {/* Section 4: Feature comparison table */}
        <section className="mb-24">
          <h3 className="text-2xl font-semibold mb-8 text-center">Compare Features</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className={`border rounded-xl p-6 ${
                  tier.bestValue 
                    ? 'bg-white text-black border-white' 
                    : 'bg-zinc-900 border-zinc-800'
                }`}
              >
                <h4 className="font-semibold mb-4">{tier.name}</h4>
                <ul className="space-y-3">
                  <li className="flex items-center">
                    <Check className="mr-2 h-4 w-4 text-green-500 flex-shrink-0" />
                    <span>{tier.projects}</span>
                  </li>
                  <li className="flex items-center">
                    <Check className="mr-2 h-4 w-4 text-green-500 flex-shrink-0" />
                    <span>{tier.members}</span>
                  </li>
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center">
                      <Check className="mr-2 h-4 w-4 text-green-500 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Section 5: Commitment message */}
        <section className="text-center mb-24 max-w-2xl mx-auto">
          <h3 className="text-xl font-semibold mb-4">Risk-free, cancel anytime, no long-term lock-in.</h3>
          <p className="text-gray-400">
            Cancel any time—no long-term contracts to lock you in. Simple, straightforward, and fair.
          </p>
        </section>

        {/* Section 6: Accordion-style FAQ */}
        <section className="max-w-4xl mx-auto border-t border-zinc-800 pt-16">
          <h4 className="text-2xl font-semibold mb-6 text-center">Pricing FAQs</h4>
          <div className="space-y-4">
            {[
              {
                q: 'How do I pay?',
                a: 'All plans are billed via Paddle using your preferred payment method. VAT added where applicable.',
              },
              {
                q: 'Can I switch plans later?',
                a: 'Yes, you can upgrade, downgrade, or cancel your plan at any time.',
              },
              {
                q: 'Is there a free trial?',
                a: 'We\'ll be offering a 14-day free trial when we launch—join the waitlist to get early access.',
              },
            ].map(({ q, a }, idx) => (
              <details 
                key={idx} 
                className="group bg-zinc-900 rounded-lg overflow-hidden"
              >
                <summary className="flex items-center justify-between p-4 cursor-pointer">
                  <span className="font-semibold">{q}</span>
                  <ChevronDown className="h-5 w-5 transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-4 pb-4">
                  <p className="text-gray-400 text-sm">{a}</p>
                </div>
              </details>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
} 