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
            {/* Empty left column to match header grid */}
            <div className="col-span-2 pl-4">
              <div className="flex flex-col items-start max-w-[1000px]">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-left leading-[1.1]">
                  Constructa: proposal, planning, and project tools<br />
                  for construction professionals.
                </h1>
                <p className="text-lg md:text-xl text-gray-400 mt-6 text-left">
                  Quote faster, plan smarter, and keep control of every job.
                </p>
              </div>
            </div>
          </div>
          
          <div className="mt-16 flex justify-center">
            <div className="max-w-[1000px] w-full">
              <div className="relative rounded-xl overflow-hidden backdrop-blur-sm bg-black/20">
                <Image
                  src="/images/hero-image.png"
                  alt="Construction Planning Software"
                  width={1200}
                  height={600}
                  className="w-full h-auto shadow-2xl shadow-black/50"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem → Solution Section */}
      <section className="relative bg-black text-white p-20 text-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05)_0%,transparent_100%)]"></div>
        <div className="relative">
          <h2 className="text-3xl font-bold mb-8 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">No more spreadsheets. Just smart tools for your construction company.</h2>
          <div className="max-w-3xl mx-auto space-y-6 text-gray-400">
            <p className="text-lg">
              Running a small construction company means quoting fast, planning tight, and delivering on site&mdash;all while juggling paperwork, messages, and spreadsheets.
            </p>
            <p className="text-lg">
              Without the right tools, it&apos;s easy for details to slip through the cracks&mdash;quotes get rushed, programmes are missed, and jobs lose momentum.
            </p>
            <p className="text-lg">
              Constructa brings everything into one place. From proposals to planning and project delivery, it gives you the clarity, structure, and control you need&mdash;without the admin overload.
            </p>
          </div>
        </div>
      </section>

      {/* Feature Highlights Section */}
      <section className="relative bg-gradient-to-b from-black via-gray-900/50 to-black p-20 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05)_0%,transparent_100%)]"></div>
        <div className="relative">
          <h2 className="text-3xl font-bold text-center mb-16 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Feature Highlights</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-6xl mx-auto">
            <div className="group p-8 rounded-xl border border-gray-800/50 hover:border-gray-700/50 transition-all duration-500 hover:shadow-xl hover:shadow-gray-900/30 bg-black/50 backdrop-blur-sm relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gray-900/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative">
                <div className="relative w-full h-[300px] mb-6">
                  <Image
                    src="/images/Build your proposal White.png"
                    alt="Build professional proposals quickly"
                    fill
                    className="object-contain group-hover:scale-105 transition-transform duration-500"
                    priority
                  />
                </div>
                <h3 className="text-xl font-bold text-orange-500 mb-4">Fast, accurate proposals</h3>
                <p className="text-gray-400">Create professional quotes in minutes&mdash;not hours. Set clear pricing, scope, and terms so clients know exactly what they&apos;re getting.</p>
              </div>
            </div>
            <div className="group p-8 rounded-xl border border-gray-800/50 hover:border-gray-700/50 transition-all duration-500 hover:shadow-xl hover:shadow-gray-900/30 bg-black/50 backdrop-blur-sm relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gray-900/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative">
                <div className="relative w-full h-[300px] mb-6">
                  <Image
                    src="/images/project Timecard.png"
                    alt="Simple project planning interface"
                    fill
                    className="object-contain group-hover:scale-105 transition-transform duration-500"
                    priority
                  />
                </div>
                <h3 className="text-xl font-bold text-orange-500 mb-4">Simple project planning</h3>
                <p className="text-gray-400">Build job programmes without the complexity. Set dates, phases, and dependencies so your team stays aligned from day one.</p>
              </div>
            </div>
            <div className="group p-8 rounded-xl border border-gray-800/50 hover:border-gray-700/50 transition-all duration-500 hover:shadow-xl hover:shadow-gray-900/30 bg-black/50 backdrop-blur-sm relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gray-900/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative">
                <div className="relative w-full h-[300px] mb-6">
                  <Image
                    src="/images/One Tap Update White.png"
                    alt="Built-in cost control features"
                    fill
                    className="object-contain group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <h3 className="text-xl font-bold text-orange-500 mb-4">Built-in cost control</h3>
                <p className="text-gray-400">Track budgets and changes as you go. Stay on top of cash flow and keep every job profitable.</p>
              </div>
            </div>
            <div className="group p-8 rounded-xl border border-gray-800/50 hover:border-gray-700/50 transition-all duration-500 hover:shadow-xl hover:shadow-gray-900/30 bg-black/50 backdrop-blur-sm relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gray-900/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative">
                <div className="relative w-full h-[300px] mb-6">
                  <Image
                    src="/images/Client-Ready Quote White.png"
                    alt="Professional quote builder"
                    fill
                    className="object-contain group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <h3 className="text-xl font-bold text-orange-500 mb-4">Build proposals that win work</h3>
                <p className="text-gray-400">Build your proposal, showcase your capability, and lock in your terms&mdash;all in a clean, consistent format.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What Sets Us Apart Section */}
      <section className="relative bg-black text-white p-20 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05)_0%,transparent_100%)]"></div>
        <div className="relative">
          <h2 className="text-3xl font-bold text-center mb-12 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">What Sets Us Apart</h2>
          <div className="max-w-4xl mx-auto mb-16">
            <div className="relative w-full h-[400px] rounded-xl overflow-hidden backdrop-blur-sm bg-black/20">
              <Image
                src="/images/imple Project Overview White.png"
                alt="Simple project overview interface"
                fill
                className="object-contain hover:scale-105 transition-transform duration-500"
              />
            </div>
          </div>
          <p className="text-lg text-center mb-12 text-gray-400">
            Not just another piece of software&mdash;Constructa is built for how construction really works.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-12 text-center max-w-6xl mx-auto">
            <div className="group p-6 rounded-xl border border-gray-800/50 hover:border-gray-700/50 transition-all duration-500 hover:shadow-xl hover:shadow-gray-900/30 bg-black/50 backdrop-blur-sm relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gray-900/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative">
                <h3 className="text-xl font-bold mb-4 text-orange-500">Built for people who build</h3>
                <p className="text-gray-400">Whether you&apos;re pricing up a job, planning your programme, or getting stuck in on site&mdash;Constructa works the way you do.</p>
              </div>
            </div>
            <div className="group p-6 rounded-xl border border-gray-800/50 hover:border-gray-700/50 transition-all duration-500 hover:shadow-xl hover:shadow-gray-900/30 bg-black/50 backdrop-blur-sm relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gray-900/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative">
                <h3 className="text-xl font-bold mb-4 text-orange-500">Simple, practical, and made to fit</h3>
                <p className="text-gray-400">No steep learning curve&mdash;just practical tools that work out of the box.</p>
              </div>
            </div>
            <div className="group p-6 rounded-xl border border-gray-800/50 hover:border-gray-700/50 transition-all duration-500 hover:shadow-xl hover:shadow-gray-900/30 bg-black/50 backdrop-blur-sm relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gray-900/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative">
                <h3 className="text-xl font-bold mb-4 text-orange-500">Control from day one</h3>
                <p className="text-gray-400">Quote, plan, and manage your jobs with confidence&mdash;no missed steps, no mess.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="relative bg-gradient-to-b from-black via-gray-900/50 to-black p-20 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05)_0%,transparent_100%)]"></div>
        <div className="relative">
          <h2 className="text-3xl font-bold text-center mb-12 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Quote it. Plan it. Run it.</h2>
          
          <div className="max-w-5xl mx-auto mb-12">
            <div className="relative w-full h-[500px] rounded-xl overflow-hidden backdrop-blur-sm bg-black/20">
              <Image
                src="/images/Quote it Plant it deliver it Black.png"
                alt="Quote it, Plan it, Deliver it process overview"
                fill
                className="object-contain hover:scale-105 transition-transform duration-500"
                priority
              />
            </div>
          </div>

          <ol className="list-decimal list-inside text-lg space-y-6 max-w-3xl mx-auto text-gray-400">
            <li className="group relative p-4 rounded-lg hover:bg-gray-900/20 transition-colors duration-300">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-900/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative">
                <strong className="text-orange-500 group-hover:text-orange-400 transition-colors">Build your quote:</strong> Set your price, add your capability statement, and drop in your terms. Done in minutes, not hours.
              </div>
            </li>
            <li className="group relative p-4 rounded-lg hover:bg-gray-900/20 transition-colors duration-300">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-900/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative">
                <strong className="text-orange-500 group-hover:text-orange-400 transition-colors">Map out the job:</strong> Add key dates, phases, and milestones. Keep everyone&mdash;from client to crew&mdash;on the same page.
              </div>
            </li>
            <li className="group relative p-4 rounded-lg hover:bg-gray-900/20 transition-colors duration-300">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-900/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative">
                <strong className="text-orange-500 group-hover:text-orange-400 transition-colors">Stay in control:</strong> Track changes, stay on schedule, and keep the job moving without the spreadsheet stress.
              </div>
            </li>
            <li className="group relative p-4 rounded-lg hover:bg-gray-900/20 transition-colors duration-300">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-900/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative">
                <strong className="text-orange-500 group-hover:text-orange-400 transition-colors">Win the work:</strong> Show clients you&apos;re ready to deliver&mdash;professional, prepared, and in control from day one.
              </div>
            </li>
          </ol>
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
      <section id="about" className="relative bg-gradient-to-b from-black via-gray-900/50 to-black p-20 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05)_0%,transparent_100%)]"></div>
        <div className="relative max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">About</h2>
          
          <h3 className="text-2xl font-bold mb-8 text-orange-500">Built by people who know the job.</h3>
          
          <div className="space-y-8 text-gray-400">
            <p className="text-lg">
              We&apos;ve spent years in the construction industry—quoting jobs, planning programmes, and dealing with the same headaches you face every day.
            </p>
            
            <p className="text-lg">
              Constructa was born out of that experience. It&apos;s designed for small construction teams who need simple, reliable tools to quote, plan, and manage work—without the bloat, the cost, or the complexity.
            </p>
            
            <p className="text-lg">
              We&apos;re building Constructa to be practical, fast, and made for the way construction really works.
            </p>
            
            <div className="pt-4">
              <h4 className="text-xl font-bold mb-3">Our goal is simple:</h4>
              <p className="text-lg">
                To give small construction teams the tools they need to work smarter, win more jobs, and stay in control—without getting buried in admin.
              </p>
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