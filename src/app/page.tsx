// Main page component for Constructa - Latest version
import React from 'react';
import Image from 'next/image';
import Script from 'next/script';

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Script src="/feature-scroll.js" strategy="afterInteractive" />
      
      {/* Hero Section */}
      <section className="relative py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-900/50 to-black">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1)_0%,transparent_100%)]"></div>
        </div>
        <div className="relative max-w-7xl mx-auto px-8">
          <div className="grid grid-cols-3">
            <div className="col-span-2 pl-10">
              <div className="flex flex-col items-start">
                <h1 className="text-left leading-[1.2] w-[1000px]">
                  <span className="text-4xl md:text-5xl font-semibold tracking-tight">Constructa: proposal, planning and project<br />tools for construction professionals.</span>
                </h1>
                <p className="text-lg md:text-xl text-gray-400 mt-6 text-left">
                  Quote faster, plan smarter, and keep control of every job.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem → Solution Section */}
      <section className="relative bg-black text-white py-16 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05)_0%,transparent_100%)]"></div>
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
      <section className="relative bg-gradient-to-b from-black via-gray-900/50 to-black py-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05)_0%,transparent_100%)]"></div>
        <div className="relative max-w-[1400px] mx-auto px-8">
          <div className="max-w-[600px] mx-auto text-left mb-16">
            <h2 className="text-3xl font-bold mb-8 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Feature Highlights</h2>
            <p className="text-lg text-gray-400">
              Everything you need to quote, plan, and deliver jobs with confidence.
            </p>
          </div>
          
          <div className="space-y-[15vh] pb-[10vh]">
            <div className="feature-content min-h-screen h-[50vh] sticky top-0 bg-black">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 h-full items-center max-w-[1400px] mx-auto px-8">
                <div className="relative w-full h-[500px]">
                  <Image
                    src="/images/Build your proposal White.png"
                    alt="Fast, accurate proposals"
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
                <div className="transform transition-all duration-200">
                  <h3 className="text-3xl md:text-4xl font-semibold mb-6 text-white leading-tight">Fast, accurate proposals</h3>
                  <p className="text-sm md:text-base text-gray-400">
                    Create professional quotes in minutes—not hours. Set clear pricing, scope, and terms so clients know exactly what they're getting.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="feature-content min-h-screen h-[50vh] sticky top-0 bg-black">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 h-full items-center max-w-[1400px] mx-auto px-8">
                <div className="relative w-full h-[500px]">
                  <Image
                    src="/images/project Timecard.png"
                    alt="Simple project planning"
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
                <div className="transform transition-all duration-200">
                  <h3 className="text-3xl md:text-4xl font-semibold mb-6 text-white leading-tight">Simple project planning</h3>
                  <p className="text-sm md:text-base text-gray-400">
                    Build job programmes without the complexity. Set dates, phases, and dependencies so your team stays aligned from day one.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="feature-content min-h-screen h-[50vh] sticky top-0 bg-black">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 h-full items-center max-w-[1400px] mx-auto px-8">
                <div className="relative w-full h-[500px]">
                  <Image
                    src="/images/One Tap Update White.png"
                    alt="Built-in cost control"
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
                <div className="transform transition-all duration-200">
                  <h3 className="text-3xl md:text-4xl font-semibold mb-6 text-white leading-tight">Built-in cost control</h3>
                  <p className="text-sm md:text-base text-gray-400">
                    Track budgets and changes as you go. Stay on top of cash flow and keep every job profitable.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="feature-content min-h-screen h-[50vh] sticky top-0 bg-black">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 h-full items-center max-w-[1400px] mx-auto px-8">
                <div className="relative w-full h-[500px]">
                  <Image
                    src="/images/Client-Ready Quote White.png"
                    alt="Build proposals that win work"
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
                <div className="transform transition-all duration-200">
                  <h3 className="text-3xl md:text-4xl font-semibold mb-6 text-white leading-tight">Build proposals that win work</h3>
                  <p className="text-sm md:text-base text-gray-400">
                    Build your proposal, showcase your capability, and lock in your terms—all in a clean, consistent format.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What Sets Us Apart Section */}
      <section className="relative bg-black text-white py-16 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05)_0%,transparent_100%)]"></div>
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
      <section className="relative bg-gradient-to-b from-black via-gray-900/50 to-black py-16 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05)_0%,transparent_100%)]"></div>
        <div className="relative max-w-[1400px] mx-auto px-8">
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
            <button className="px-4 py-2 rounded-full text-sm font-medium text-gray-400 hover:text-white transition-colors">
              Monthly
            </button>
            <button className="px-4 py-2 rounded-full text-sm font-medium bg-white/10 text-white">
              Quarterly
              <span className="ml-2 text-xs px-2 py-0.5 bg-white text-black rounded-full">15% OFF</span>
            </button>
            <button className="px-4 py-2 rounded-full text-sm font-medium text-gray-400 hover:text-white transition-colors">
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
                <h3 className="text-xl font-bold mb-2">Basic</h3>
                <p className="text-sm text-gray-400 mb-6">Essential tools for individual contractors starting their journey.</p>
                <div className="mb-6">
                  <span className="text-3xl font-bold">£20</span>
                  <span className="text-sm text-gray-400 ml-2">/month</span>
                  <div className="text-xs text-gray-400 mt-1">Billed quarterly</div>
                </div>
                <button className="w-full py-3 px-4 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors mb-8">
                  Get Started
                </button>
                <div className="space-y-4">
                  <div className="text-sm text-gray-400 font-medium">What's included</div>
                  <div className="flex items-center gap-2 text-sm">
                    <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="none">
                      <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M10 18a8 8 0 100-16 8 8 0 000 16z" stroke="currentColor" strokeWidth="1.5"/>
                    </svg>
                    <span>Up to 15 projects/quarter</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="none">
                      <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M10 18a8 8 0 100-16 8 8 0 000 16z" stroke="currentColor" strokeWidth="1.5"/>
                    </svg>
                    <span>Basic proposal templates</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="none">
                      <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M10 18a8 8 0 100-16 8 8 0 000 16z" stroke="currentColor" strokeWidth="1.5"/>
                    </svg>
                    <span>4 team members</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="none">
                      <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M10 18a8 8 0 100-16 8 8 0 000 16z" stroke="currentColor" strokeWidth="1.5"/>
                    </svg>
                    <span>Standard support</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Standard Plan */}
            <div className="relative p-8 rounded-2xl border border-gray-800/50 bg-black/50 backdrop-blur-sm hover:border-gray-700/50 transition-all duration-300">
              <div className="text-left">
                <h3 className="text-xl font-bold mb-2">Standard</h3>
                <p className="text-sm text-gray-400 mb-6">Enhanced features for growing construction businesses.</p>
                <div className="mb-6">
                  <span className="text-3xl font-bold">£40</span>
                  <span className="text-sm text-gray-400 ml-2">/month</span>
                  <div className="text-xs text-gray-400 mt-1">Billed quarterly</div>
                </div>
                <button className="w-full py-3 px-4 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors mb-8">
                  Get Started
                </button>
                <div className="space-y-4">
                  <div className="text-sm text-gray-400 font-medium">What's included</div>
                  <div className="flex items-center gap-2 text-sm">
                    <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="none">
                      <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M10 18a8 8 0 100-16 8 8 0 000 16z" stroke="currentColor" strokeWidth="1.5"/>
                    </svg>
                    <span>Up to 50 projects/quarter</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="none">
                      <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M10 18a8 8 0 100-16 8 8 0 000 16z" stroke="currentColor" strokeWidth="1.5"/>
                    </svg>
                    <span>Advanced proposal templates</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="none">
                      <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M10 18a8 8 0 100-16 8 8 0 000 16z" stroke="currentColor" strokeWidth="1.5"/>
                    </svg>
                    <span>8 team members</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="none">
                      <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M10 18a8 8 0 100-16 8 8 0 000 16z" stroke="currentColor" strokeWidth="1.5"/>
                    </svg>
                    <span>Priority support</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Professional Plan */}
            <div className="relative p-8 rounded-2xl border-2 border-white bg-white text-black transition-all duration-300">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 px-3 py-1 bg-black text-white text-xs font-medium rounded-full">
                Best Value
              </div>
              <div className="text-left">
                <h3 className="text-xl font-bold mb-2">Professional</h3>
                <p className="text-sm text-gray-600 mb-6">Advanced tools and privacy for professional contractors.</p>
                <div className="mb-6">
                  <span className="text-3xl font-bold">£80</span>
                  <span className="text-sm text-gray-600 ml-2">/month</span>
                  <div className="text-xs text-gray-600 mt-1">Billed quarterly</div>
                </div>
                <button className="w-full py-3 px-4 rounded-xl bg-black text-white text-sm font-medium hover:bg-gray-900 transition-colors mb-8">
                  Get Started
                </button>
                <div className="space-y-4">
                  <div className="text-sm text-gray-600 font-medium">What's included</div>
                  <div className="flex items-center gap-2 text-sm">
                    <svg className="w-5 h-5 text-black" viewBox="0 0 20 20" fill="none">
                      <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M10 18a8 8 0 100-16 8 8 0 000 16z" stroke="currentColor" strokeWidth="1.5"/>
                    </svg>
                    <span>Unlimited projects</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <svg className="w-5 h-5 text-black" viewBox="0 0 20 20" fill="none">
                      <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M10 18a8 8 0 100-16 8 8 0 000 16z" stroke="currentColor" strokeWidth="1.5"/>
                    </svg>
                    <span>Custom proposal templates</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <svg className="w-5 h-5 text-black" viewBox="0 0 20 20" fill="none">
                      <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M10 18a8 8 0 100-16 8 8 0 000 16z" stroke="currentColor" strokeWidth="1.5"/>
                    </svg>
                    <span>12 team members</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <svg className="w-5 h-5 text-black" viewBox="0 0 20 20" fill="none">
                      <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M10 18a8 8 0 100-16 8 8 0 000 16z" stroke="currentColor" strokeWidth="1.5"/>
                    </svg>
                    <span>24/7 priority support</span>
                  </div>
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
      <section id="about" className="relative bg-gradient-to-b from-black via-gray-900/50 to-black py-16 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05)_0%,transparent_100%)]"></div>
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

      {/* Contact Section */}
      <section id="contact" className="relative bg-black text-white p-20 text-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05)_0%,transparent_100%)]"></div>
        <div className="relative">
          <h2 className="text-3xl font-bold mb-8 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Got a question? Want to stay in the loop?</h2>
          <p className="text-lg mb-12 max-w-3xl mx-auto text-gray-400">
            We&apos;re building Constructa to help construction professionals quote, plan, and win more work without the admin headache.
            If you&apos;ve got a question, suggestion, or want early access&mdash;we&apos;d love to hear from you.
          </p>
          <div className="flex flex-col items-center space-y-8">
            <p className="text-lg text-gray-400">Direct email: <a href="mailto:hello@constructa.co" className="text-orange-500 hover:text-orange-400 transition-colors">hello@constructa.co</a></p>
            <form className="w-full max-w-md space-y-6">
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Name" 
                  className="w-full p-4 bg-black/50 border border-gray-800/50 rounded-xl text-white placeholder-gray-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all duration-300 backdrop-blur-sm" 
                />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-900/10 to-transparent opacity-0 focus-within:opacity-100 transition-opacity duration-500 rounded-xl"></div>
              </div>
              <div className="relative">
                <input 
                  type="email" 
                  placeholder="Email" 
                  className="w-full p-4 bg-black/50 border border-gray-800/50 rounded-xl text-white placeholder-gray-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all duration-300 backdrop-blur-sm" 
                />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-900/10 to-transparent opacity-0 focus-within:opacity-100 transition-opacity duration-500 rounded-xl"></div>
              </div>
              <textarea 
                placeholder="Message" 
                className="w-full p-4 bg-black/50 border border-gray-800/50 rounded-xl text-white placeholder-gray-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all duration-300 backdrop-blur-sm" 
                rows={4}
              ></textarea>
              <button 
                type="submit" 
                className="relative p-4 bg-orange-600 text-white w-full rounded-xl hover:bg-orange-500 active:bg-orange-700 transition-colors duration-300 font-medium overflow-hidden group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <span className="relative">Send Message</span>
              </button>
            </form>
            <a 
              href="https://www.linkedin.com" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-orange-500 hover:text-orange-400 transition-colors inline-flex items-center space-x-2"
            >
              <span>LinkedIn</span>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}