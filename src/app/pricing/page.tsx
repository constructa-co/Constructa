'use client';

import React, { useState } from 'react';

const PLANS = {
  basic: {
    monthly: 20,
    name: 'Basic',
    description: 'Essential tools for individual contractors starting their journey.',
    features: [
      'Up to 15 projects/quarter',
      'Basic proposal templates',
      '4 team members',
      'Standard support'
    ]
  },
  standard: {
    monthly: 40,
    name: 'Standard',
    description: 'Enhanced features for growing construction businesses.',
    features: [
      'Up to 50 projects/quarter',
      'Advanced proposal templates',
      '8 team members',
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
      '12 team members',
      '24/7 priority support'
    ]
  }
};

const calculatePrice = (basePrice: number, billingPeriod: 'monthly' | 'quarterly' | 'annual') => {
  switch (billingPeriod) {
    case 'quarterly':
      return Math.round(basePrice * 3 * 0.85); // 15% discount
    case 'annual':
      return Math.round(basePrice * 12 * 0.7); // 30% discount
    default:
      return basePrice;
  }
};

export default function PricingPage() {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'quarterly' | 'annual'>('monthly');

  const getBillingText = (price: number) => {
    switch (billingPeriod) {
      case 'quarterly':
        return `£${Math.round(price / 3)}/month`;
      case 'annual':
        return `£${Math.round(price / 12)}/month`;
      default:
        return `£${price}/month`;
    }
  };

  const getBillingSubtext = () => {
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
    <main className="min-h-screen pt-16 bg-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Introduction Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-white mb-6">Simple, transparent pricing</h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Choose the plan that works for your construction business. All plans include our core features for quoting, planning, and project management.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <button 
            onClick={() => setBillingPeriod('monthly')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              billingPeriod === 'monthly' 
                ? 'bg-white/10 text-white' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Monthly
          </button>
          <button 
            onClick={() => setBillingPeriod('quarterly')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              billingPeriod === 'quarterly' 
                ? 'bg-white/10 text-white' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Quarterly
            <span className="ml-2 text-xs px-2 py-0.5 bg-white text-black rounded-full">15% OFF</span>
          </button>
          <button 
            onClick={() => setBillingPeriod('annual')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              billingPeriod === 'annual' 
                ? 'bg-white/10 text-white' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Yearly
            <span className="ml-2 text-xs px-2 py-0.5 bg-white text-black rounded-full">30% OFF</span>
          </button>
        </div>

        <p className="text-sm text-gray-500 text-center mb-12">
          We're offering flexible plans with everything you need to quote, plan, and deliver jobs with confidence.
        </p>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
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
                <div className="text-sm text-gray-400 font-medium">What's included</div>
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
                <div className="text-sm text-gray-400 font-medium">What's included</div>
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
                <div className="text-sm text-gray-600 font-medium">What's included</div>
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
                <div className="text-sm text-gray-400 font-medium">What's included</div>
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
} 