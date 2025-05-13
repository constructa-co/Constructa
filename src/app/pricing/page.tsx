'use client';

import React from 'react';
import { Check } from 'lucide-react';

export default function PricingPage() {
  const tiers = [
    {
      name: 'Basic',
      price: '£20/month',
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
      price: '£40/month',
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
      price: '£80/month',
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
      price: 'Custom',
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
        {/* Section 1: Pricing plans */}
        <section className="text-center mb-16">
          <h1 className="text-4xl font-semibold mb-4">Professional tools—without the big software price tag</h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            We offer flexible plans with everything you need to quote, plan, and deliver jobs with confidence.
          </p>
        </section>

        {/* Placeholder Visual */}
        <section className="flex justify-center mb-16">
          <img 
            src="/images/pricing-visual-placeholder.png" 
            alt="Constructa pricing visual" 
            className="w-full max-w-4xl rounded-xl shadow-lg" 
          />
        </section>

        {/* Section 2: Feature table */}
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
                <p className="text-2xl font-bold mb-1">{tier.price}</p>
                <p className="text-xs text-gray-500 mb-4">Billed monthly</p>
              </div>
              <ul className="text-sm text-gray-300 space-y-2 mb-6">
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

        {/* Section 3: Commitment statement */}
        <section className="text-center mb-24 max-w-2xl mx-auto">
          <h3 className="text-xl font-semibold mb-4">Risk-free, cancel anytime, no long-term lock-in.</h3>
          <p className="text-gray-400">
            Cancel any time—no long-term contracts to lock you in. Simple, straightforward, and fair.
          </p>
        </section>

        {/* Section 4: Pricing FAQs */}
        <section className="max-w-3xl mx-auto border-t border-zinc-800 pt-16">
          <h4 className="text-2xl font-semibold mb-6 text-center">Pricing FAQs</h4>
          <div className="space-y-6">
            <div>
              <h5 className="font-semibold mb-1">How do I pay?</h5>
              <p className="text-gray-400 text-sm">All plans are billed via Paddle using your preferred payment method. VAT added where applicable.</p>
            </div>
            <div>
              <h5 className="font-semibold mb-1">Can I switch plans later?</h5>
              <p className="text-gray-400 text-sm">Yes, you can upgrade, downgrade, or cancel your plan at any time.</p>
            </div>
            <div>
              <h5 className="font-semibold mb-1">Is there a free trial?</h5>
              <p className="text-gray-400 text-sm">We'll be offering a 14-day free trial when we launch—join the waitlist to get early access.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
} 