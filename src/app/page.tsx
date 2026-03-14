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
        <div className="relative h-full max-w-[1400px] mx-auto px-8 py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center h-full">
            {/* Left side - Sticky images */}
            <div className="relative w-full h-[500px] hidden md:block group">
              <div className="relative h-full transition-transform duration-500 group-hover:scale-[1.02]">
                <div className={`absolute inset-0 transition-opacity duration-700 ${activeFeature === 0 ? 'opacity-100' : 'opacity-0'}`}>
                  <Image
                    src="/proposal.png"
                    alt="Proposals"
                    fill
                    className="object-contain mix-blend-screen [mask-image:radial-gradient(ellipse_at_center,black_85%,transparent_100%)]"
                    priority
                  />
                </div>
                <div className={`absolute inset-0 transition-opacity duration-700 ${activeFeature === 1 ? 'opacity-100' : 'opacity-0'}`}>
                  <Image
                    src="/Planning.png"
                    alt="Planning"
                    fill
                    className="object-contain mix-blend-screen [mask-image:radial-gradient(ellipse_at_center,black_85%,transparent_100%)]"
                  />
                </div>
                <div className={`absolute inset-0 transition-opacity duration-700 ${activeFeature === 2 ? 'opacity-100' : 'opacity-0'}`}>
                  <Image
                    src="/One Tap Update.png"
                    alt="Updates"
                    fill
                    className="object-contain mix-blend-screen [mask-image:radial-gradient(ellipse_at_center,black_85%,transparent_100%)]"
                  />
                </div>
                <div className={`absolute inset-0 transition-opacity duration-700 ${activeFeature === 3 ? 'opacity-100' : 'opacity-0'}`}>
                  <Image
                    src="/Cost Control.png"
                    alt="Cost Control"
                    fill
                    className="object-contain mix-blend-screen [mask-image:radial-gradient(ellipse_at_center,black_85%,transparent_100%)]"
                  />
                </div>
              </div>
            </div>

            {/* Right side - Animated text */}
            <div className="max-w-[500px] relative">
              {[
                { title: "Fast, accurate proposals", desc: "Create professional quotes in minutes—not hours. Set clear pricing, scope, and terms so clients know exactly what they're getting.", id: "proposals" },
                { title: "Simple project planning", desc: "Build job programmes without the complexity. Set dates, phases, and dependencies so your team stays aligned from day one.", id: "planning" },
                { title: "One-tap updates", desc: "Keep everyone in the loop with instant updates. Share progress, changes, and important information with your team and clients.", id: "updates" },
                { title: "Built-in cost control", desc: "Track budgets and changes as you go. Stay on top of cash flow and keep every job profitable.", id: "cost-control" }
              ].map((feat, idx) => (
                <div key={idx} className={`transition-all duration-500 absolute inset-0 ${activeFeature === idx ? 'opacity-100 translate-y-0 relative' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                  <h3 className="text-3xl md:text-5xl font-bold mb-6 text-white leading-tight tracking-tighter text-left uppercase">{feat.title}</h3>
                  <p className="text-base md:text-lg text-gray-400 text-left mb-8 leading-relaxed">
                    {feat.desc}
                  </p>
                  <div className="text-left">
                    <a
                      href="#"
                      id={`try-constructa-${feat.id}`}
                      data-section={feat.id}
                      className="inline-flex items-center px-8 py-3 rounded-full bg-white text-black text-sm font-black uppercase tracking-widest hover:bg-gray-100 transition-all duration-300 hover:scale-105 active:scale-95 shadow-xl hover:shadow-white/10"
                    >
                      Try CONSTRUCTA
                      <svg className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M6.5 3.5L11 8L6.5 12.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </a>
                  </div>
                </div>
              ))}
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
      <section className="relative min-h-[90vh] flex items-center justify-center py-40 px-4 md:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-900/40 to-black"></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_0%,transparent_70%)]"></div>
        <div className="relative max-w-7xl mx-auto px-4 md:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="col-span-1 md:col-span-2 pl-0 md:pl-10">
              <div className="flex flex-col items-start">
                <h1 className="text-left leading-[1.1] w-full md:w-[1000px] animate-in fade-in slide-in-from-bottom-4 duration-1000">
                  <span className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tighter uppercase">
                    Constructa: proposal, <br />
                    planning and project <br />
                    <span className="text-white/40">tools for professionals.</span>
                  </span>
                </h1>
                <p className="text-lg sm:text-xl md:text-2xl text-gray-400 mt-8 text-left max-w-2xl font-medium leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
                  Quote faster, plan smarter, and keep control of every job with simple, powerful construction tools.
                </p>
                <div className="mt-10 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300">
                  <a
                    href="#contact-form"
                    className="inline-flex items-center px-10 py-4 rounded-full bg-white text-black text-sm font-black uppercase tracking-widest hover:bg-gray-100 transition-all duration-300 hover:scale-105 active:scale-95 shadow-2xl hover:shadow-white/20"
                  >
                    Get Started Free
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem → Solution Section */}
      <section className="relative text-white py-40 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-900/50 to-black"></div>
        <div className="relative max-w-[1400px] mx-auto px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
            <div className="relative w-full h-[500px] flex items-center justify-center">
              <Image
                src="/Plan Cost & Manage.png"
                alt="Plan, cost and manage projects with ease"
                fill
                className="object-contain mix-blend-screen brightness-95 [mask-image:radial-gradient(ellipse_at_center,black_0%,black_30%,transparent_75%)] transition-transform duration-700 group-hover:scale-[1.02]"
                priority
              />
            </div>
            <div className="max-w-[500px]">
              <h2 className="text-4xl md:text-5xl font-black mb-8 text-white leading-tight tracking-tighter text-left uppercase">No more spreadsheets. <br /><span className="text-white/40">Just smart tools.</span></h2>
              <div className="space-y-6 text-left">
                <p className="text-lg text-gray-400 leading-relaxed">
                  Running a small construction company means quoting fast, planning tight, and delivering on site&mdash;all while juggling paperwork, messages, and spreadsheets.
                </p>
                <p className="text-lg text-gray-400 leading-relaxed">
                  Constructa brings everything into one place. From proposals to planning and project delivery, it gives you the clarity, structure, and control you need&mdash;without the admin overload.
                </p>
                <div className="pt-8">
                  <a
                    href="#"
                    id="try-constructa-solution"
                    data-section="solution"
                    className="inline-flex items-center px-8 py-3 rounded-full bg-white text-black text-sm font-black uppercase tracking-widest hover:bg-gray-100 transition-all duration-300 hover:scale-105 active:scale-95"
                  >
                    Try CONSTRUCTA
                    <svg className="ml-2 w-4 h-4" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M6.5 3.5L11 8L6.5 12.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
      <section className="relative py-40 px-4 md:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-900/50 to-black"></div>
        <div className="relative max-w-[1400px] mx-auto px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
            <div className="relative w-full h-[500px] flex items-center justify-center order-last lg:order-first">
              <Image
                src="/Setting us apart.png"
                alt="What sets Constructa apart"
                fill
                className="object-contain mix-blend-screen brightness-95 [mask-image:radial-gradient(ellipse_at_center,black_0%,black_30%,transparent_75%)] transition-transform duration-700 group-hover:scale-[1.05]"
                priority
              />
            </div>
            <div className="max-w-[500px]">
              <h2 className="text-4xl md:text-5xl font-black mb-8 text-white leading-tight tracking-tighter text-left uppercase">What Sets <br /><span className="text-white/40">Us Apart.</span></h2>
              <div className="space-y-6 text-left">
                <p className="text-lg text-gray-400 leading-relaxed">
                  Not just another piece of software&mdash;Constructa is built for how construction really works.
                </p>
                <p className="text-lg text-gray-400 leading-relaxed">
                  Whether you&apos;re pricing up a job, planning your programme, or getting stuck in on site&mdash;Constructa works the way you do. No steep learning curve&mdash;just practical tools that work out of the box.
                </p>
                <div className="pt-8 text-left">
                  <a
                    href="#"
                    id="try-constructa-apart"
                    data-section="apart"
                    className="inline-flex items-center px-10 py-4 rounded-full bg-white text-black text-sm font-black uppercase tracking-widest hover:bg-gray-100 transition-all duration-300 hover:scale-105 active:scale-95 shadow-xl"
                  >
                    Try CONSTRUCTA
                    <svg className="ml-2 w-4 h-4" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M6.5 3.5L11 8L6.5 12.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
                        <path d="M3 7h18M3 7v13a1 1 0 001 1h16a1 1 0 001-1V7M3 7V4a1 1 0 011-1h16a1 1 0 011 1v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M12 11v6m-3-3h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
                        <path d="M8 7V3m8 4V3M7 11h10M7 15h10M7 19h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
                        <path d="M12 8v4l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M3.34985 16.65C2.48459 15.1164 2 13.3634 2 11.5C2 5.97715 6.47715 1.5 12 1.5C17.5228 1.5 22 5.97715 22 11.5C22 17.0228 17.5228 21.5 12 21.5C10.1366 21.5 8.38356 21.0154 6.84998 20.1502" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M3 14l.34985 2.65L6 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
                        <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
                      <path d="M6.5 3.5L11 8L6.5 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
            <div className="relative w-full h-[500px] flex items-center justify-center">
              <Image
                src="/Quote Plan Deliver 1.png"
                alt="How it works"
                fill
                className="object-contain mix-blend-screen brightness-95 [mask-image:radial-gradient(ellipse_at_center,black_0%,black_30%,transparent_75%)] transition-transform duration-700 group-hover:scale-[1.05]"
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
            <span className="text-sm font-medium tracking-wider uppercase text-white/40">OUR PRICING</span>
            <h2 className="text-4xl font-bold mt-4 mb-4">Get Started with Constructa</h2>
            <p className="text-gray-400 mb-8 max-w-2xl mx-auto">
              We&apos;re offering flexible plans with everything you need to quote, plan, and deliver jobs with confidence.
            </p>
          </div>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mb-12">
            <button 
              onClick={() => setBillingPeriod('monthly')}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                billingPeriod === 'monthly' 
                  ? 'bg-white text-black' 
                  : 'text-gray-400 hover:text-white bg-white/5'
              }`}
            >
              Monthly
            </button>
            <button 
              onClick={() => setBillingPeriod('quarterly')}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                billingPeriod === 'quarterly' 
                  ? 'bg-white text-black' 
                  : 'text-gray-400 hover:text-white bg-white/5'
              }`}
            >
              Quarterly
              <span className={`ml-2 text-[10px] px-2 py-0.5 rounded-full ${billingPeriod === 'quarterly' ? 'bg-black text-white' : 'bg-white/10 text-white'}`}>15% OFF</span>
            </button>
            <button 
              onClick={() => setBillingPeriod('annual')}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                billingPeriod === 'annual' 
                  ? 'bg-white text-black' 
                  : 'text-gray-400 hover:text-white bg-white/5'
              }`}
            >
              Yearly
              <span className={`ml-2 text-[10px] px-2 py-0.5 rounded-full ${billingPeriod === 'annual' ? 'bg-black text-white' : 'bg-white/10 text-white'}`}>30% OFF</span>
            </button>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16 px-4 md:px-0">
            {[PLANS.basic, PLANS.standard, PLANS.professional].map((plan, idx) => {
              const isPro = plan.name === 'Professional';
              const price = calculatePrice(plan.monthly, billingPeriod);
              return (
                <div key={idx} className={`relative p-8 rounded-2xl border transition-all duration-300 flex flex-col ${
                  isPro 
                    ? 'border-white bg-white text-black shadow-2xl z-10' 
                    : 'border-white/10 bg-white/5 text-white hover:border-white/30'
                }`}>
                  {isPro && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 px-3 py-1 bg-black text-white text-[10px] font-bold uppercase rounded-full">
                      Best Value
                    </div>
                  )}
                  <div className="text-left flex-1">
                    <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                    <p className={`text-sm mb-6 ${isPro ? 'text-black/60' : 'text-white/40'}`}>{plan.description}</p>
                    <div className="mb-6">
                      <span className="text-3xl font-bold">{getBillingText(price)}</span>
                      <div className={`text-[10px] mt-1 ${isPro ? 'text-black/40' : 'text-white/20'}`}>{getBillingSubtext()}</div>
                    </div>
                    <button className={`w-full py-3 px-4 rounded-xl text-sm font-medium transition-colors mb-8 ${
                      isPro ? 'bg-black text-white hover:bg-black/90' : 'bg-white/10 text-white hover:bg-white/20'
                    }`}>
                      Get Started
                    </button>
                    <div className="space-y-4">
                      <div className={`text-xs font-bold uppercase tracking-wider mb-2 ${isPro ? 'text-black/40' : 'text-white/20'}`}>What&apos;s included</div>
                      {plan.features.map((feature, fIdx) => (
                        <div key={fIdx} className="flex items-center gap-2 text-sm">
                          <svg className={`w-5 h-5 ${isPro ? 'text-black' : 'text-white'}`} viewBox="0 0 20 20" fill="none">
                            <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M10 18a8 8 0 100-16 8 8 0 000 16z" stroke="currentColor" strokeWidth="1.5" />
                          </svg>
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Enterprise Card */}
            <div className="relative p-8 rounded-2xl border border-white/10 bg-white/5 text-white hover:border-white/30 transition-all duration-300 flex flex-col">
              <div className="text-left flex-1">
                <h3 className="text-xl font-bold mb-2">Enterprise</h3>
                <p className="text-sm text-white/40 mb-6">Custom solutions for large construction companies.</p>
                <div className="mb-6">
                  <span className="text-3xl font-bold">Custom</span>
                  <div className="text-[10px] text-white/20 mt-1">Contact for pricing</div>
                </div>
                <button className="w-full py-3 px-4 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors mb-8">
                  Contact Sales
                </button>
                <div className="space-y-4">
                  <div className="text-xs font-bold uppercase tracking-wider mb-2 text-white/20">What&apos;s included</div>
                  {[
                    "Unlimited projects",
                    "Custom integrations",
                    "Unlimited team members",
                    "Dedicated support"
                  ].map((feature, fIdx) => (
                    <div key={fIdx} className="flex items-center gap-2 text-sm">
                      <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="none">
                        <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M10 18a8 8 0 100-16 8 8 0 000 16z" stroke="currentColor" strokeWidth="1.5" />
                      </svg>
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="relative py-40 px-4 md:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-900/50 to-black"></div>
        <div className="relative max-w-[1400px] mx-auto px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
            <div className="relative w-full h-[500px] flex items-center justify-center group">
              <Image
                src="/Build Proposal.png"
                alt="Born from Experience"
                fill
                className="object-contain mix-blend-screen brightness-95 [mask-image:radial-gradient(ellipse_at_center,black_0%,black_30%,transparent_75%)] transition-transform duration-700 group-hover:scale-[1.05]"
                priority
              />
            </div>
            <div className="max-w-[500px]">
              <h2 className="text-4xl md:text-5xl font-black mb-10 text-white leading-tight tracking-tighter text-left uppercase">Born from <br /><span className="text-white/40">Experience.</span></h2>
              <div className="space-y-10 text-left">
                {[
                  {
                    title: "Built by people who know the job",
                    desc: "We've spent years in the construction industry—quoting jobs, planning programmes, and dealing with the same headaches you face every day.",
                    icon: (
                      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-white">
                        <path d="M12 11.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M12 14.5c3.314 0 6-1.343 6-3s-2.686-3-6-3-6 1.343-6 3 2.686 3 6 3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M3 7V4a1 1 0 011-1h16a1 1 0 011 1v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )
                  },
                  {
                    title: "Practical and fast",
                    desc: "Constructa is built to be practical and fast—made for the way construction really works, without the bloat or complexity.",
                    icon: (
                      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-white">
                        <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h-4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    )
                  }
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start space-x-6 group">
                    <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white group-hover:text-black transition-all duration-300">
                      {item.icon}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white mb-2 uppercase tracking-tight">{item.title}</h3>
                      <p className="text-base text-gray-400 leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}

                <div className="pt-8">
                  <a
                    href="#"
                    id="try-constructa-about"
                    data-section="about"
                    className="inline-flex items-center px-10 py-4 rounded-full bg-white text-black text-sm font-black uppercase tracking-widest hover:bg-gray-100 transition-all duration-300 hover:scale-105 active:scale-95 shadow-xl"
                  >
                    Try CONSTRUCTA
                    <svg className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M6.5 3.5L11 8L6.5 12.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
      <section id="contact-form" className="relative py-40 px-4 md:px-8">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-900/50 to-black"></div>
        <div className="relative max-w-7xl mx-auto px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-start">
            <div className="max-w-[500px]">
              <h2 className="text-4xl md:text-5xl font-black mb-10 text-white leading-tight tracking-tighter text-left uppercase">Get in <br /><span className="text-white/40">Touch.</span></h2>
              <p className="text-lg text-gray-400 mb-12 leading-relaxed">
                Have questions about Constructa? We&apos;re here to help you get started.
              </p>

              <div className="space-y-10">
                <div className="flex items-center space-x-6 group">
                  <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white group-hover:text-black transition-all duration-300">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-1">Email Us</h3>
                    <p className="text-lg font-bold text-white tracking-tight">support@constructa.com</p>
                  </div>
                </div>

                <div className="flex items-center space-x-6 group">
                  <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white group-hover:text-black transition-all duration-300">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-1">Live Chat</h3>
                    <p className="text-lg font-bold text-white tracking-tight">Available 9am - 5pm GMT</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right side form */}
            <div className="bg-white/5 p-10 rounded-[2rem] border border-white/10 backdrop-blur-xl shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-blue-500/5 mix-blend-overlay group-hover:bg-transparent transition-colors duration-500"></div>
              {isSubmitted ? (
                <div className="text-center py-12 animate-in zoom-in duration-500">
                  <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-8 shadow-inner">
                    <svg className="w-10 h-10 text-white" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <h3 className="text-3xl font-black text-white mb-4 uppercase tracking-tighter">Thank You!</h3>
                  <p className="text-gray-400 mb-10 leading-relaxed font-medium">Your message has been received. <br />Our team will get back to you shortly.</p>
                  <button
                    onClick={() => setIsSubmitted(false)}
                    className="px-10 py-4 bg-white text-black text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-gray-100 transition-all duration-300 hover:scale-105 active:scale-95 shadow-xl"
                  >
                    Send Another Message
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={handleSubmit}
                  className="space-y-8"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <label htmlFor="name" className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-3 ml-1">Your Name</label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        className="w-full px-6 py-4 bg-black/40 border border-white/10 rounded-2xl focus:ring-4 focus:ring-white/5 focus:border-white/20 transition-all duration-300 text-white placeholder-white/20 font-medium"
                        placeholder="John Doe"
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-3 ml-1">Email Address</label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        required
                        className="w-full px-6 py-4 bg-black/40 border border-white/10 rounded-2xl focus:ring-4 focus:ring-white/5 focus:border-white/20 transition-all duration-300 text-white placeholder-white/20 font-medium"
                        placeholder="john@example.com"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="message" className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-3 ml-1">Message</label>
                    <textarea
                      id="message"
                      name="message"
                      rows={4}
                      required
                      className="w-full px-6 py-4 bg-black/40 border border-white/10 rounded-2xl focus:ring-4 focus:ring-white/5 focus:border-white/20 transition-all duration-300 text-white placeholder-white/20 font-medium resize-none"
                      placeholder="How can we help your construction business?"
                    ></textarea>
                  </div>
                  <button
                    type="submit"
                    className="w-full px-10 py-5 bg-white text-black text-[10px] font-black uppercase tracking-[0.2em] rounded-[1.2rem] hover:bg-gray-100 transition-all duration-300 hover:scale-[1.02] active:scale-98 shadow-2xl flex items-center justify-center group/btn"
                  >
                    Send Message
                    <svg className="ml-3 w-4 h-4 transition-transform group-hover/btn:translate-x-1" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M6.5 3.5L11 8L6.5 12.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
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