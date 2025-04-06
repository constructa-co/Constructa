// Main page component for Constructa - Latest version
import React from 'react';
import Image from 'next/image';

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section */}
      <section className="text-center py-20 px-4 bg-gradient-to-b from-black via-gray-900 to-black">
        <h1 className="text-4xl md:text-6xl font-bold mb-8 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-300">
          Constructa: proposal, planning, and project tools for construction professionals.
        </h1>
        <p className="text-lg md:text-xl max-w-2xl mx-auto mb-16 text-gray-300">
          Quote faster, plan smarter, and keep control of every job.
        </p>
        <div className="w-full max-w-2xl mx-auto transform hover:scale-[1.02] transition-transform duration-300">
          <Image
            src="/images/hero-image.png"
            alt="Construction Planning Software"
            width={1200}
            height={600}
            className="w-full h-auto rounded-lg shadow-2xl"
            priority
          />
        </div>
      </section>

      {/* Problem → Solution Section */}
      <section className="bg-black text-white p-10 text-center">
        <h2 className="text-3xl font-bold mb-6">No more spreadsheets. Just smart tools for your construction company.</h2>
        <p className="text-lg mb-4">
          Running a small construction company means quoting fast, planning tight, and delivering on site&mdash;all while juggling paperwork, messages, and spreadsheets.
        </p>
        <p className="text-lg mb-4">
          Without the right tools, it&apos;s easy for details to slip through the cracks&mdash;quotes get rushed, programmes are missed, and jobs lose momentum.
        </p>
        <p className="text-lg">
          Constructa brings everything into one place. From proposals to planning and project delivery, it gives you the clarity, structure, and control you need&mdash;without the admin overload.
        </p>
      </section>

      {/* Feature Highlights Section */}
      <section className="bg-gradient-to-b from-black via-gray-900 to-black p-10">
        <h2 className="text-3xl font-bold text-center mb-12 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-300">Feature Highlights</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-6xl mx-auto">
          <div className="space-y-4 p-6 rounded-lg border border-gray-800 hover:border-gray-700 transition-all duration-300 hover:shadow-xl hover:shadow-gray-900/30 bg-black/50">
            <div className="relative w-full h-[300px]">
              <Image
                src="/images/Build your proposal White.png"
                alt="Build professional proposals quickly"
                fill
                className="object-contain hover:scale-105 transition-transform duration-300"
                priority
              />
            </div>
            <h3 className="text-xl font-bold text-orange-500">Fast, accurate proposals</h3>
            <p className="text-gray-300">Create professional quotes in minutes&mdash;not hours. Set clear pricing, scope, and terms so clients know exactly what they&apos;re getting.</p>
          </div>
          <div className="space-y-4 p-6 rounded-lg border border-gray-800 hover:border-gray-700 transition-all duration-300 hover:shadow-xl hover:shadow-gray-900/30 bg-black/50">
            <div className="relative w-full h-[300px]">
              <Image
                src="/images/project Timecard.png"
                alt="Simple project planning interface"
                fill
                className="object-contain hover:scale-105 transition-transform duration-300"
                priority
              />
            </div>
            <h3 className="text-xl font-bold text-orange-500">Simple project planning</h3>
            <p className="text-gray-300">Build job programmes without the complexity. Set dates, phases, and dependencies so your team stays aligned from day one.</p>
          </div>
          <div className="space-y-4 p-6 rounded-lg border border-gray-800 hover:border-gray-700 transition-all duration-300 hover:shadow-xl hover:shadow-gray-900/30 bg-black/50">
            <div className="relative w-full h-[300px]">
              <Image
                src="/images/One Tap Update White.png"
                alt="Built-in cost control features"
                fill
                className="object-contain hover:scale-105 transition-transform duration-300"
              />
            </div>
            <h3 className="text-xl font-bold text-orange-500">Built-in cost control</h3>
            <p className="text-gray-300">Track budgets and changes as you go. Stay on top of cash flow and keep every job profitable.</p>
          </div>
          <div className="space-y-4 p-6 rounded-lg border border-gray-800 hover:border-gray-700 transition-all duration-300 hover:shadow-xl hover:shadow-gray-900/30 bg-black/50">
            <div className="relative w-full h-[300px]">
              <Image
                src="/images/Client-Ready Quote White.png"
                alt="Professional quote builder"
                fill
                className="object-contain hover:scale-105 transition-transform duration-300"
              />
            </div>
            <h3 className="text-xl font-bold text-orange-500">Build proposals that win work</h3>
            <p className="text-gray-300">Build your proposal, showcase your capability, and lock in your terms&mdash;all in a clean, consistent format.</p>
          </div>
        </div>
      </section>

      {/* What Sets Us Apart Section */}
      <section className="bg-black text-white p-10">
        <h2 className="text-3xl font-bold text-center mb-8">What Sets Us Apart</h2>
        <div className="max-w-4xl mx-auto mb-12">
          <div className="relative w-full h-[400px]">
            <Image
              src="/images/imple Project Overview White.png"
              alt="Simple project overview interface"
              fill
              className="object-contain"
            />
          </div>
        </div>
        <p className="text-lg text-center mb-6">
          Not just another piece of software&mdash;Constructa is built for how construction really works.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center max-w-6xl mx-auto">
          <div>
            <h3 className="text-xl font-bold mb-2">Built for people who build</h3>
            <p>Whether you&apos;re pricing up a job, planning your programme, or getting stuck in on site&mdash;Constructa works the way you do.</p>
          </div>
          <div>
            <h3 className="text-xl font-bold mb-2">Simple, practical, and made to fit</h3>
            <p>No steep learning curve&mdash;just practical tools that work out of the box.</p>
          </div>
          <div>
            <h3 className="text-xl font-bold mb-2">Control from day one</h3>
            <p>Quote, plan, and manage your jobs with confidence&mdash;no missed steps, no mess.</p>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="bg-black text-white p-10">
        <h2 className="text-3xl font-bold text-center mb-8">Quote it. Plan it. Run it.</h2>
        
        <div className="max-w-5xl mx-auto mb-6">
          <div className="relative w-full h-[500px]">
            <Image
              src="/images/Quote it Plant it deliver it Black.png"
              alt="Quote it, Plan it, Deliver it process overview"
              fill
              className="object-contain"
              priority
            />
          </div>
        </div>

        <ol className="list-decimal list-inside text-lg space-y-4 max-w-3xl mx-auto">
          <li>
            <strong>Build your quote:</strong> Set your price, add your capability statement, and drop in your terms. Done in minutes, not hours.
          </li>
          <li>
            <strong>Map out the job:</strong> Add key dates, phases, and milestones. Keep everyone&mdash;from client to crew&mdash;on the same page.
          </li>
          <li>
            <strong>Stay in control:</strong> Track changes, stay on schedule, and keep the job moving without the spreadsheet stress.
          </li>
          <li>
            <strong>Win the work:</strong> Show clients you&apos;re ready to deliver&mdash;professional, prepared, and in control from day one.
          </li>
        </ol>
      </section>

      {/* Pricing Section */}
      <section className="bg-black text-white p-10 text-center">
        <h2 className="text-3xl font-bold mb-6">Professional tools&mdash;without the big software price tag.</h2>
        <p className="text-lg mb-4 max-w-3xl mx-auto">
          We&apos;ll be offering flexible plans with everything you need to quote, plan, and deliver jobs with confidence.
        </p>
        <p className="text-lg mb-6">Early users get priority access and special launch pricing.</p>
      </section>

      {/* Contact Section */}
      <section id="contact" className="bg-gradient-to-b from-black via-gray-900 to-black p-10 text-center">
        <h2 className="text-3xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-300">Got a question? Want to stay in the loop?</h2>
        <p className="text-lg mb-8 max-w-3xl mx-auto text-gray-300">
          We&apos;re building Constructa to help construction professionals quote, plan, and win more work without the admin headache.
          If you&apos;ve got a question, suggestion, or want early access&mdash;we&apos;d love to hear from you.
        </p>
        <div className="flex flex-col items-center space-y-6">
          <p className="text-lg text-gray-300">Direct email: <a href="mailto:hello@constructa.co" className="text-orange-500 hover:text-orange-400 transition-colors">hello@constructa.co</a></p>
          <form className="w-full max-w-md space-y-4">
            <input 
              type="text" 
              placeholder="Name" 
              className="w-full p-4 bg-black/50 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all duration-300" 
            />
            <input 
              type="email" 
              placeholder="Email" 
              className="w-full p-4 bg-black/50 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all duration-300" 
            />
            <textarea 
              placeholder="Message" 
              className="w-full p-4 bg-black/50 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all duration-300" 
              rows={4}
            ></textarea>
            <button 
              type="submit" 
              className="p-4 bg-orange-600 text-white w-full rounded-lg hover:bg-orange-500 active:bg-orange-700 transition-colors duration-300 font-medium"
            >
              Send Message
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
      </section>
    </div>
  );
}