// Main page component for Constructa - Latest version
import React from 'react';
import Image from 'next/image';

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white">
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
      <section className="relative bg-black text-white py-32 overflow-hidden">
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
      <section className="relative bg-gradient-to-b from-black via-gray-900/50 to-black py-32 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05)_0%,transparent_100%)]"></div>
        <div className="relative max-w-[1400px] mx-auto px-8">
          <div className="max-w-[600px] mx-auto text-center mb-24">
            <h2 className="text-3xl font-bold mb-8 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Feature Highlights</h2>
            <p className="text-lg text-gray-400">
              Everything you need to quote, plan, and deliver jobs with confidence.
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-32">
            <div className="group">
              <div className="relative w-full h-[400px] mb-8">
                <Image
                  src="/images/Build your proposal White.png"
                  alt="Build professional proposals quickly"
                  fill
                  className="object-contain group-hover:scale-105 transition-transform duration-500"
                  priority
                />
              </div>
              <div className="max-w-[400px]">
                <h3 className="text-xl font-bold text-orange-500 mb-4">Fast, accurate proposals</h3>
                <p className="text-gray-400">Create professional quotes in minutes&mdash;not hours. Set clear pricing, scope, and terms so clients know exactly what they&apos;re getting.</p>
              </div>
            </div>

            <div className="group lg:mt-32">
              <div className="relative w-full h-[400px] mb-8">
                <Image
                  src="/images/project Timecard.png"
                  alt="Simple project planning interface"
                  fill
                  className="object-contain group-hover:scale-105 transition-transform duration-500"
                  priority
                />
              </div>
              <div className="max-w-[400px]">
                <h3 className="text-xl font-bold text-orange-500 mb-4">Simple project planning</h3>
                <p className="text-gray-400">Build job programmes without the complexity. Set dates, phases, and dependencies so your team stays aligned from day one.</p>
              </div>
            </div>

            <div className="group">
              <div className="relative w-full h-[400px] mb-8">
                <Image
                  src="/images/One Tap Update White.png"
                  alt="Built-in cost control features"
                  fill
                  className="object-contain group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="max-w-[400px]">
                <h3 className="text-xl font-bold text-orange-500 mb-4">Built-in cost control</h3>
                <p className="text-gray-400">Track budgets and changes as you go. Stay on top of cash flow and keep every job profitable.</p>
              </div>
            </div>

            <div className="group lg:mt-32">
              <div className="relative w-full h-[400px] mb-8">
                <Image
                  src="/images/Client-Ready Quote White.png"
                  alt="Professional quote builder"
                  fill
                  className="object-contain group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="max-w-[400px]">
                <h3 className="text-xl font-bold text-orange-500 mb-4">Build proposals that win work</h3>
                <p className="text-gray-400">Build your proposal, showcase your capability, and lock in your terms&mdash;all in a clean, consistent format.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What Sets Us Apart Section */}
      <section className="relative bg-black text-white py-32 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05)_0%,transparent_100%)]"></div>
        <div className="relative max-w-[1400px] mx-auto px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            <div className="relative w-full h-[500px] rounded-xl overflow-hidden backdrop-blur-sm bg-black/20">
              <Image
                src="/images/imple Project Overview Black.png"
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
      <section className="relative bg-gradient-to-b from-black via-gray-900/50 to-black py-32 overflow-hidden">
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
      <section className="relative bg-black text-white p-20 text-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05)_0%,transparent_100%)]"></div>
        <div className="relative">
          <h2 className="text-3xl font-bold mb-8 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Professional tools&mdash;without the big software price tag.</h2>
          <p className="text-lg mb-12 max-w-3xl mx-auto text-gray-400">
            We&apos;ll be offering flexible plans with everything you need to quote, plan, and deliver jobs with confidence.
          </p>
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="group p-8 rounded-xl border border-gray-800/50 hover:border-gray-700/50 transition-all duration-500 hover:shadow-xl hover:shadow-gray-900/30 bg-black/50 backdrop-blur-sm relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gray-900/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative">
                <h3 className="text-xl font-bold text-orange-500 mb-4">Built for people who build</h3>
                <p className="text-gray-400">Whether you&apos;re pricing up a job, planning your programme, or getting stuck in on site - Constructa works the way you do.</p>
              </div>
            </div>
            <div className="group p-8 rounded-xl border border-gray-800/50 hover:border-gray-700/50 transition-all duration-500 hover:shadow-xl hover:shadow-gray-900/30 bg-black/50 backdrop-blur-sm relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gray-900/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative">
                <h3 className="text-xl font-bold text-orange-500 mb-4">Simple, practical, and made to fit</h3>
                <p className="text-gray-400">No steep learning curve - just practical tools that work out of the box.</p>
              </div>
            </div>
            <div className="group p-8 rounded-xl border border-gray-800/50 hover:border-gray-700/50 transition-all duration-500 hover:shadow-xl hover:shadow-gray-900/30 bg-black/50 backdrop-blur-sm relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gray-900/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative">
                <h3 className="text-xl font-bold text-orange-500 mb-4">Control from day one</h3>
                <p className="text-gray-400">Quote, plan, and manage your jobs with confidence&mdash;no missed steps, no mess.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="relative bg-gradient-to-b from-black via-gray-900/50 to-black py-32 overflow-hidden">
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
                      <path d="M3 7V4a1 1 0 011-1h16a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1v-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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
                      <path d="M4.93 19.07l4.24-4.24m5.66-5.66l4.24-4.24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
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
                      <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
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