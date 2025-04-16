'use client';

// Trigger new deployment - restore working version
import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Script from 'next/script';
import FAQ from './components/FAQ';

// Add these price calculations at the top of the file, after imports
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

// Feature section component with sticky scroll
const FeatureSection = () => {
  const [activeFeature, setActiveFeature] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const section = document.getElementById('feature-section');
      if (!section) return;

      const rect = section.getBoundingClientRect();
      const headerHeight = 64; // Height of the header
      const viewportHeight = window.innerHeight - headerHeight;
      const scrollPosition = window.scrollY;
      const sectionTop = section.offsetTop;
      const sectionHeight = section.offsetHeight;

      // Calculate which feature should be active based on scroll position
      const progress = (scrollPosition - sectionTop + headerHeight) / (sectionHeight - viewportHeight);
      const featureIndex = Math.min(Math.max(Math.floor(progress * 4), 0), 3);
      
      setActiveFeature(featureIndex);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <section id="feature-section" className="relative h-[300vh]">
      {/* Sticky container for the entire feature section */}
      <div className="sticky top-16 h-[calc(100vh-4rem)] overflow-hidden">
        <div className="relative h-full max-w-[1400px] mx-auto px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center h-full">
            {/* Left side - Sticky images */}
            <div className="relative w-full h-[500px] hidden md:block">
              <div className="relative h-full">
                <div className={`absolute inset-0 transition-opacity duration-500 ${activeFeature === 0 ? 'opacity-100' : 'opacity-0'}`}>
                  <Image
                    src="/images/Proposal Builder 2.png"
                    alt="Proposals"
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
                <div className={`absolute inset-0 transition-opacity duration-500 ${activeFeature === 1 ? 'opacity-100' : 'opacity-0'}`}>
                  <Image
                    src="/images/Project TImeline.png"
                    alt="Planning"
                    fill
                    className="object-contain"
                  />
                </div>
                <div className={`absolute inset-0 transition-opacity duration-500 ${activeFeature === 2 ? 'opacity-100' : 'opacity-0'}`}>
                  <Image
                    src="/images/One Tap Update.png"
                    alt="Updates"
                    fill
                    className="object-contain"
                  />
                </div>
                <div className={`absolute inset-0 transition-opacity duration-500 ${activeFeature === 3 ? 'opacity-100' : 'opacity-0'}`}>
                  <Image
                    src="/images/Cost Control 2.png"
                    alt="Cost Control"
                    fill
                    className="object-contain"
                  />
                </div>
              </div>
            </div>

            {/* Right side - Animated text */}
            <div className="max-w-[500px] relative">
              <div className={`transition-opacity duration-500 absolute inset-0 ${activeFeature === 0 ? 'opacity-100 relative' : 'opacity-0 pointer-events-none'}`}>
                <h3 className="text-3xl md:text-4xl font-semibold mb-6 text-white leading-tight text-left">Fast, accurate proposals</h3>
                <p className="text-sm md:text-base text-gray-400 text-left">
                  Create professional quotes in minutes—not hours. Set clear pricing, scope, and terms so clients know exactly what they're getting.
                </p>
                <div className="pt-4 text-left">
                  <a 
                    href="#" 
                    id="try-constructa-proposals"
                    data-section="proposals"
                    className="inline-flex items-center px-6 py-1.5 rounded-lg bg-white text-black text-sm font-medium hover:bg-gray-100 transition-colors duration-200"
                  >
                    Try CONSTRUCTA
                    <svg className="ml-2 w-4 h-4" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M6.5 3.5L11 8L6.5 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </a>
                </div>
              </div>
              <div className={`transition-opacity duration-500 absolute inset-0 ${activeFeature === 1 ? 'opacity-100 relative' : 'opacity-0 pointer-events-none'}`}>
                <h3 className="text-3xl md:text-4xl font-semibold mb-6 text-white leading-tight text-left">Simple project planning</h3>
                <p className="text-sm md:text-base text-gray-400 text-left">
                  Build job programmes without the complexity. Set dates, phases, and dependencies so your team stays aligned from day one.
                </p>
                <div className="pt-4 text-left">
                  <a 
                    href="#" 
                    id="try-constructa-planning"
                    data-section="planning"
                    className="inline-flex items-center px-6 py-1.5 rounded-lg bg-white text-black text-sm font-medium hover:bg-gray-100 transition-colors duration-200"
                  >
                    Try CONSTRUCTA
                    <svg className="ml-2 w-4 h-4" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M6.5 3.5L11 8L6.5 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </a>
                </div>
              </div>
              <div className={`transition-opacity duration-500 absolute inset-0 ${activeFeature === 2 ? 'opacity-100 relative' : 'opacity-0 pointer-events-none'}`}>
                <h3 className="text-3xl md:text-4xl font-semibold mb-6 text-white leading-tight text-left">One-tap updates</h3>
                <p className="text-sm md:text-base text-gray-400 text-left">
                  Keep everyone in the loop with instant updates. Share progress, changes, and important information with your team and clients.
                </p>
                <div className="pt-4 text-left">
                  <a 
                    href="#" 
                    id="try-constructa-updates"
                    data-section="updates"
                    className="inline-flex items-center px-6 py-1.5 rounded-lg bg-white text-black text-sm font-medium hover:bg-gray-100 transition-colors duration-200"
                  >
                    Try CONSTRUCTA
                    <svg className="ml-2 w-4 h-4" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M6.5 3.5L11 8L6.5 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </a>
                </div>
              </div>
              <div className={`transition-opacity duration-500 absolute inset-0 ${activeFeature === 3 ? 'opacity-100 relative' : 'opacity-0 pointer-events-none'}`}>
                <h3 className="text-3xl md:text-4xl font-semibold mb-6 text-white leading-tight text-left">Built-in cost control</h3>
                <p className="text-sm md:text-base text-gray-400 text-left">
                  Track budgets and changes as you go. Stay on top of cash flow and keep every job profitable.
                </p>
                <div className="pt-4 text-left">
                  <a 
                    href="#" 
                    id="try-constructa-cost-control"
                    data-section="cost-control"
                    className="inline-flex items-center px-6 py-1.5 rounded-lg bg-white text-black text-sm font-medium hover:bg-gray-100 transition-colors duration-200"
                  >
                    Try CONSTRUCTA
                    <svg className="ml-2 w-4 h-4" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M6.5 3.5L11 8L6.5 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default function Home() {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'quarterly' | 'annual'>('monthly');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch('https://formspree.io/f/xnnprlod', {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        setIsSubmitted(true);
        form.reset();
      } else {
        console.error('Form submission failed');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
    }
  };

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
    <div className="min-h-screen bg-black text-white">
      <Script src="/feature-scroll.js" strategy="afterInteractive" />
      <Script id="plausible-contact" strategy="afterInteractive">
        {`
          document.addEventListener("DOMContentLoaded", function () {
            const form = document.querySelector('form[action*="formspree.io"]');
            if (form) {
              form.addEventListener("submit", function () {
                if (window.plausible) plausible("ContactFormSubmit");
              });
            }
          });
        `}
      </Script>
      <Script id="plausible-cta" strategy="afterInteractive">
        {`
          document.addEventListener("DOMContentLoaded", function () {
            // Track all Try CONSTRUCTA buttons
            document.querySelectorAll('a[id^="try-constructa-"]').forEach(function(button) {
              button.addEventListener("click", function () {
                if (window.plausible) plausible("TryConstructaClick", { 
                  props: { 
                    location: button.getAttribute('data-section') 
                  }
                });
              });
            });
          });
        `}
      </Script>
      
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center py-32 md:py-32 px-4 md:px-8">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-900/50 to-black"></div>
        <div className="relative max-w-7xl mx-auto px-4 md:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3">
            <div className="col-span-1 md:col-span-2 pl-0 md:pl-10">
              <div className="flex flex-col items-start">
                <h1 className="text-left leading-[1.2] w-full md:w-[1000px]">
                  <span className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight">Constructa: proposal, planning and project<br className="hidden md:block" />tools for construction professionals.</span>
                </h1>
                <p className="text-base sm:text-lg md:text-xl text-gray-400 mt-4 md:mt-6 text-left">
                  Quote faster, plan smarter, and keep control of every job.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem → Solution Section */}
      <section className="relative text-white py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-900/50 to-black"></div>
        <div className="relative max-w-[1400px] mx-auto px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            <div className="relative w-full h-[500px] rounded-xl overflow-hidden backdrop-blur-sm bg-black/20">
              <Image
                src="/images/hero-image.png"
                alt="Construction Planning Software"
                fill
                className="object-contain"
                priority
              />
            </div>
            <div className="max-w-[500px]">
              <h2 className="text-3xl md:text-4xl font-semibold mb-6 text-white leading-tight text-left">No more spreadsheets. Just smart tools for your construction company.</h2>
              <div className="space-y-4 text-left">
                <p className="text-sm md:text-base text-gray-400">
                  Running a small construction company means quoting fast, planning tight, and delivering on site&mdash;all while juggling paperwork, messages, and spreadsheets.
                </p>
                <p className="text-sm md:text-base text-gray-400">
                  Without the right tools, it&apos;s easy for details to slip through the cracks&mdash;quotes get rushed, programmes are missed, and jobs lose momentum.
                </p>
                <p className="text-sm md:text-base text-gray-400">
                  Constructa brings everything into one place. From proposals to planning and project delivery, it gives you the clarity, structure, and control you need&mdash;without the admin overload.
                </p>
                <div className="pt-4">
                  <a 
                    href="#" 
                    id="try-constructa-proposals"
                    data-section="proposals"
                    className="inline-flex items-center px-6 py-1.5 rounded-lg bg-white text-black text-sm font-medium hover:bg-gray-100 transition-colors duration-200"
                  >
                    Try CONSTRUCTA
                    <svg className="ml-2 w-4 h-4" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M6.5 3.5L11 8L6.5 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Highlights Section */}
      <FeatureSection />

      {/* What Sets Us Apart Section */}
      <section className="relative py-32 md:py-40 px-4 md:px-8">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-900/50 to-black"></div>
        <div className="relative max-w-[1400px] mx-auto px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="relative w-full h-[500px] rounded-xl overflow-hidden backdrop-blur-sm bg-black/20">
              <Image
                src="/images/simple Project Overview Black Cropped.png"
                alt="What sets Constructa apart"
                fill
                className="object-contain"
                priority
              />
            </div>
            <div className="max-w-[500px]">
              <h2 className="text-3xl md:text-4xl font-semibold mb-6 text-white leading-tight text-left">What Sets Us Apart</h2>
              <div className="space-y-4 text-left">
                <p className="text-sm md:text-base text-gray-400">
                  Not just another piece of software&mdash;Constructa is built for how construction really works.
                </p>
                <p className="text-sm md:text-base text-gray-400">
                  Whether you&apos;re pricing up a job, planning your programme, or getting stuck in on site&mdash;Constructa works the way you do.
                </p>
                <p className="text-sm md:text-base text-gray-400">
                  No steep learning curve&mdash;just practical tools that work out of the box. Quote, plan, and manage your jobs with confidence&mdash;no missed steps, no mess.
                </p>
                <div className="pt-4">
                  <a 
                    href="#" 
                    id="try-constructa-what-sets-us-apart"
                    data-section="what-sets-us-apart"
                    className="inline-flex items-center px-6 py-1.5 rounded-lg bg-white text-black text-sm font-medium hover:bg-gray-100 transition-colors duration-200"
                  >
                    Try CONSTRUCTA
                    <svg className="ml-2 w-4 h-4" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M6.5 3.5L11 8L6.5 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="relative py-32 md:py-40 px-4 md:px-8">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-900/50 to-black"></div>
        <div className="relative max-w-[1400px] mx-auto px-8">
          <div className="max-w-[600px] mx-auto text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">How It Works</h2>
            <p className="text-gray-400 text-lg">
              Get started with Constructa in three simple steps
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            <div className="max-w-[500px] justify-self-end">
              <h2 className="text-3xl md:text-4xl font-semibold mb-6 text-white leading-tight text-left">Quote it. Plan it. Run it.</h2>
              <div className="space-y-4 text-left">
                <div className="space-y-6">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-6 h-6">
                      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-white">
                        <path d="M3 7h18M3 7v13a1 1 0 001 1h16a1 1 0 001-1V7M3 7V4a1 1 0 011-1h16a1 1 0 011 1v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M12 11v6m-3-3h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm md:text-base font-medium text-white mb-1">Build your quote</h3>
                      <p className="text-sm md:text-base text-gray-400">
                        Set your price, add your capability statement, and drop in your terms. Done in minutes, not hours.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-6 h-6">
                      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-white">
                        <path d="M8 7V3m8 4V3M7 11h10M7 15h10M7 19h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm md:text-base font-medium text-white mb-1">Map out the job</h3>
                      <p className="text-sm md:text-base text-gray-400">
                        Add key dates, phases, and milestones. Keep everyone&mdash;from client to crew&mdash;on the same page.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-6 h-6">
                      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-white">
                        <path d="M12 8v4l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M3.34985 16.65C2.48459 15.1164 2 13.3634 2 11.5C2 5.97715 6.47715 1.5 12 1.5C17.5228 1.5 22 5.97715 22 11.5C22 17.0228 17.5228 21.5 12 21.5C10.1366 21.5 8.38356 21.0154 6.84998 20.1502" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M3 14l.34985 2.65L6 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm md:text-base font-medium text-white mb-1">Stay in control</h3>
                      <p className="text-sm md:text-base text-gray-400">
                        Track changes, stay on schedule, and keep the job moving without the spreadsheet stress.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-6 h-6">
                      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-white">
                        <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm md:text-base font-medium text-white mb-1">Win the work</h3>
                      <p className="text-sm md:text-base text-gray-400">
                        Show clients you&apos;re ready to deliver&mdash;professional, prepared, and in control from day one.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="pt-4">
                  <a 
                    href="#" 
                    id="try-constructa-how-it-works"
                    data-section="how-it-works"
                    className="inline-flex items-center px-6 py-1.5 rounded-lg bg-white text-black text-sm font-medium hover:bg-gray-100 transition-colors duration-200"
                  >
                    Try CONSTRUCTA
                    <svg className="ml-2 w-4 h-4" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M6.5 3.5L11 8L6.5 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </a>
                </div>
              </div>
            </div>
            <div className="relative w-full h-[500px] rounded-xl overflow-hidden backdrop-blur-sm bg-black/20">
              <Image
                src="/images/Quote it Plant it deliver it Black.png"
                alt="Quote it, Plan it, Deliver it process overview"
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="relative bg-black text-white py-16 text-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05)_0%,transparent_100%)]"></div>
        <div className="relative max-w-7xl mx-auto px-8">
          <div className="text-center mb-12">
            <span className="text-sm font-medium tracking-wider uppercase text-gray-400">OUR PRICING</span>
            <h2 className="text-4xl font-bold mt-4 mb-8">Get Started with Constructa</h2>
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

          <p className="text-sm text-gray-500 mb-8">
            We&apos;re offering flexible plans with everything you need to quote, plan, and deliver jobs with confidence.
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
        </div>
      </section>

      {/* About Section */}
      <section className="relative py-32 md:py-40 px-4 md:px-8">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-900/50 to-black"></div>
        <div className="relative max-w-[1400px] mx-auto px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            <div className="relative w-full h-[500px] rounded-xl overflow-hidden backdrop-blur-sm bg-black/20">
              <Image
                src="/images/Built with experience.png"
                alt="Built with experience - Constructa team expertise"
                fill
                className="object-contain"
                priority
              />
            </div>
            <div className="max-w-[500px]">
              <h2 className="text-3xl md:text-4xl font-semibold mb-6 text-white leading-tight text-left">About</h2>
              <div className="space-y-6 text-left">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-6 h-6">
                    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-white">
                      <path d="M12 11.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M12 14.5c3.314 0 6-1.343 6-3s-2.686-3-6-3-6 1.343-6 3 2.686 3 6 3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M3 7V4a1 1 0 011-1h16a1 1 0 011 1v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm md:text-base font-medium text-white mb-1">Built by people who know the job</h3>
                    <p className="text-sm md:text-base text-gray-400">
                      We&apos;ve spent years in the construction industry—quoting jobs, planning programmes, and dealing with the same headaches you face every day.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-6 h-6">
                    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-white">
                      <path d="M12 2v6m0 14v-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      <path d="M4.93 4.93l4.24 4.24m5.66 5.66l4.24 4.24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      <path d="M2 12h6m14 0h-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      <path d="M4.93 19.07l4.24-4.24m5.66-5.66l4.24-4.24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm md:text-base font-medium text-white mb-1">Born from experience</h3>
                    <p className="text-sm md:text-base text-gray-400">
                      Constructa was born out of that experience. It&apos;s designed for small construction teams who need simple, reliable tools to quote, plan, and manage work—without the bloat, the cost, or the complexity.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-6 h-6">
                    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-white">
                      <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h-4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm md:text-base font-medium text-white mb-1">Practical and fast</h3>
                    <p className="text-sm md:text-base text-gray-400">
                      We&apos;re building Constructa to be practical, fast, and made for the way construction really works.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-6 h-6">
                    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-white">
                      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm md:text-base font-medium text-white mb-1">Our goal is simple</h3>
                    <p className="text-sm md:text-base text-gray-400">
                      To give small construction teams the tools they need to work smarter, win more jobs, and stay in control—without getting buried in admin.
                    </p>
                  </div>
                </div>

                <div className="pt-4">
                  <a 
                    href="#" 
                    id="try-constructa-about"
                    data-section="about"
                    className="inline-flex items-center px-6 py-1.5 rounded-lg bg-white text-black text-sm font-medium hover:bg-gray-100 transition-colors duration-200"
                  >
                    Try CONSTRUCTA
                    <svg className="ml-2 w-4 h-4" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M6.5 3.5L11 8L6.5 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <FAQ />

      {/* Contact Us Section */}
      <section className="relative py-32 md:py-40 px-4 md:px-8">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-900/50 to-black"></div>
        <div className="relative max-w-[1400px] mx-auto px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            {/* Left side content */}
            <div className="max-w-[600px]">
              <h2 className="text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 text-left">Contact Us</h2>
              <p className="text-lg text-gray-400 mb-8 text-left">
                Have questions about Constructa? We're here to help. Reach out to our team and we'll get back to you as soon as possible.
              </p>
              <div className="space-y-6">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-full bg-gray-800/50 flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-xl font-semibold text-white">Email Us:</h3>
                    <p className="text-gray-400">support@constructa.com</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-full bg-gray-800/50 flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                    </svg>
                  </div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-xl font-semibold text-white">Live Chat:</h3>
                    <p className="text-gray-400">Available during business hours</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right side form */}
            <div className="bg-gray-900/50 p-8 rounded-2xl backdrop-blur-sm">
              {isSubmitted ? (
                <div className="text-center py-8">
                  <h3 className="text-2xl font-bold text-white mb-4">Thank You!</h3>
                  <p className="text-gray-400 mb-6">Your message has been sent successfully. We'll get back to you soon.</p>
                  <button
                    onClick={() => setIsSubmitted(false)}
                    className="px-6 py-3 bg-gradient-to-r from-white to-gray-400 text-black font-medium rounded-lg hover:from-gray-200 hover:to-gray-300 transition-all duration-200"
                  >
                    Send Another Message
                  </button>
                </div>
              ) : (
                <form 
                  onSubmit={handleSubmit}
                  className="space-y-6"
                >
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">Name</label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all duration-200 text-white placeholder-gray-400"
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      required
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all duration-200 text-white placeholder-gray-400"
                      placeholder="your@email.com"
                    />
                  </div>
                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-gray-300 mb-2">Message</label>
                    <textarea
                      id="message"
                      name="message"
                      rows={4}
                      required
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all duration-200 text-white placeholder-gray-400"
                      placeholder="How can we help you?"
                    ></textarea>
                  </div>
                  <button
                    type="submit"
                    className="w-full px-6 py-3 bg-gradient-to-r from-white to-gray-400 text-black font-medium rounded-lg hover:from-gray-200 hover:to-gray-300 transition-all duration-200"
                  >
                    Send Message
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}