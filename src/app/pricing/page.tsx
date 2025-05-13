'use client';

import React from 'react';
import { Check, ChevronDown } from 'lucide-react';
import Image from 'next/image';

const tiers = [
  {
    name: 'Basic',
    price: '£20/month',
    description: 'Essential tools for solo contractors starting out.',
    billing: 'Billed monthly',
    buttonText: 'Get Started',
    features: [
      '2 projects/quarter',
      '1 team member',
      'Branded PDF proposals',
      'Capability statements',
      'Customisable terms and conditions',
      'Export as PDF',
      'Standard support',
    ],
  },
  {
    name: 'Standard',
    price: '£40/month',
    description: 'Enhanced features for growing construction businesses.',
    billing: 'Billed monthly',
    buttonText: 'Get Started',
    features: [
      '10 projects/quarter',
      '2 team members',
      'All Basic features',
      'Estimating tool',
      'Planning tool',
      'Proposal viewer notifications',
      'Export as PDF',
      'Priority support',
    ],
  },
  {
    name: 'Professional',
    price: '£80/month',
    description: 'Advanced tools and collaboration for pros.',
    billing: 'Billed monthly',
    buttonText: 'Get Started',
    bestValue: true,
    features: [
      'Unlimited projects',
      '5 team members',
      'All Standard features',
      'Client dashboard',
      'Proposal viewer notifications',
      'Export as PDF',
      '24/7 priority support',
    ],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description: 'Custom solutions for larger contractors.',
    billing: 'Contact for pricing',
    buttonText: 'Contact Sales',
    features: [
      'Unlimited',
      'Unlimited',
      'All Professional features',
      'Custom integrations',
      'Dedicated support',
    ],
  },
];

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
    answer: 'Yes. We're actively developing new tools. All plans get regular updates.',
  },
  {
    question: 'Do I need to install anything?',
    answer: 'No. Constructa is fully cloud-based and runs on any modern browser.',
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        {/* Image First */}
        <section className="flex justify-center mb-12">
          <img 
            src="/images/pricing-visual-placeholder.png" 
            alt="Constructa pricing visual" 
            className="w-full max-w-4xl rounded-xl shadow-lg" 
          />
        </section>

        {/* Section 1 – Header + Pricing Options */}
        <section className="text-center mb-12">
          <h1 className="text-4xl font-semibold mb-4">Get Started with Constructa</h1>
          <div className="flex justify-center gap-2 mb-4">
            <button className="bg-white text-black px-4 py-1 rounded">Monthly</button>
            <button className="bg-zinc-800 text-green-400 px-4 py-1 rounded">Quarterly <span className="text-sm">15% OFF</span></button>
            <button className="bg-zinc-800 text-green-400 px-4 py-1 rounded">Yearly <span className="text-sm">30% OFF</span></button>
          </div>
          <p className="text-gray-400 max-w-xl mx-auto">
            We're offering flexible plans with everything you need to quote, plan, and deliver jobs with confidence.
          </p>
        </section>

        {/* Pricing Cards */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-24">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`border rounded-xl p-6 flex flex-col justify-between transition-all duration-200 hover:scale-105 ${
                tier.bestValue ? 'bg-white text-black shadow-lg border-white' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <div>
                <h2 className="text-xl font-semibold mb-1">{tier.name}</h2>
                <p className="text-sm text-gray-400 mb-4">{tier.description}</p>
                <p className="text-2xl font-bold mb-1">{tier.price}</p>
                <p className="text-xs text-gray-500 mb-4">{tier.billing}</p>
              </div>
              <ul className="text-sm text-gray-300 space-y-2 mb-6">
                {tier.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center">
                    <Check className="mr-2 h-4 w-4 text-green-500 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <button className={`w-full py-2 rounded-md font-semibold transition-colors duration-200 ${tier.bestValue ? 'bg-black text-white hover:bg-zinc-800' : 'bg-white text-black hover:bg-gray-100'}`}>
                {tier.buttonText}
              </button>
            </div>
          ))}
        </section>

        {/* Feature Comparison */}
        <section className="mb-24">
          <h2 className="text-2xl font-semibold text-center mb-10">Compare Features</h2>
          <div className="grid grid-cols-4 gap-6">
            {['Projects per quarter', 'Team members', 'Branded PDF proposals', 'Capability statements', 'Customisable T&Cs', 'Estimating tool', 'Planning tool', 'Client dashboard', 'Proposal viewer notifications', 'Export as PDF', 'Support level'].map((feature, index) => (
              <div key={index} className="text-sm text-gray-300 border-t border-zinc-700 pt-4">
                <p className="font-semibold mb-2">{feature}</p>
                {tiers.map((tier, idx) => (
                  <div key={idx} className="mb-1">
                    {tier.features.some(f => f.toLowerCase().includes(feature.toLowerCase()))
                      ? <span className="text-green-400">✓</span>
                      : <span className="text-gray-500">–</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>

        {/* Section 3 – Value Callouts */}
        <section className="text-center mb-24">
          <h2 className="text-2xl font-semibold mb-4">Why Choose Constructa?</h2>
          <div className="space-y-4 max-w-xl mx-auto text-gray-300">
            <p><strong>No lock-in contracts</strong><br />Cancel anytime. No hidden fees. Just tools that work.</p>
            <p><strong>Built for small teams</strong><br />We know every minute and pound matters. That\'s why Constructa is priced for practicality—not just power.</p>
            <p><strong>Simple setup, no training needed</strong><br />Get up and running in minutes. No onboarding calls. Just straightforward tools made for construction.</p>
          </div>
        </section>

        {/* Section 4 – FAQ */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-zinc-800 pt-16">
          <div>
            <h4 className="text-2xl font-semibold mb-6">Have questions?</h4>
          </div>
          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <details key={idx} className="bg-zinc-900 rounded-lg p-4">
                <summary className="flex items-center justify-between cursor-pointer font-semibold">
                  {faq.question}
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </summary>
                <p className="text-sm text-gray-400 mt-2">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
} 