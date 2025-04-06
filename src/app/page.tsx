// Main page component for Constructa - Latest version
import React from 'react';
import Image from 'next/image';

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Single Header Section */}
      <header className="w-full py-6 px-4 flex justify-between items-center border-b border-gray-800">
        <div className="text-2xl font-bold tracking-wider">CONSTRUCTA</div>
        <nav className="flex space-x-8 text-lg">
          <a href="#product" className="hover:text-orange-500 transition-colors">Product</a>
          <a href="#features" className="hover:text-orange-500 transition-colors">Features</a>
          <a href="#pricing" className="hover:text-orange-500 transition-colors">Pricing</a>
          <a href="#contact" className="hover:text-orange-500 transition-colors">Contact</a>
          <button className="border px-6 py-1 rounded-md hover:bg-white hover:text-black transition-colors">Sign up</button>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="text-center py-20 px-4">
        <h1 className="text-4xl md:text-6xl font-bold mb-6">
          Constructa: proposal, planning, and project tools for construction professionals.
        </h1>
        <p className="text-lg md:text-xl max-w-2xl mx-auto mb-12">
          Quote faster, plan smarter, and keep control of every job.
        </p>
        <div className="w-full max-w-2xl mx-auto">
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
      <section className="bg-black text-white p-10 text-center border-t border-gray-800">
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
      <section className="bg-black text-white p-10 border-t border-gray-800">
        <h2 className="text-3xl font-bold text-center mb-8">Feature Highlights</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          <div>
            <h3 className="text-xl font-bold mb-2">Fast, accurate proposals</h3>
            <p>Create professional quotes in minutes&mdash;not hours. Set clear pricing, scope, and terms so clients know exactly what they&apos;re getting.</p>
          </div>
          <div>
            <h3 className="text-xl font-bold mb-2">Simple project planning</h3>
            <p>Build job programmes without the complexity. Set dates, phases, and dependencies so your team stays aligned from day one.</p>
          </div>
          <div>
            <h3 className="text-xl font-bold mb-2">Built-in cost control</h3>
            <p>Track budgets and changes as you go. Stay on top of cash flow and keep every job profitable.</p>
          </div>
          <div>
            <h3 className="text-xl font-bold mb-2">Build proposals that win work</h3>
            <p>Build your proposal, showcase your capability, and lock in your terms&mdash;all in a clean, consistent format.</p>
          </div>
        </div>
      </section>

      {/* What Sets Us Apart Section */}
      <section className="bg-black text-white p-10 border-t border-gray-800">
        <h2 className="text-3xl font-bold text-center mb-8">What Sets Us Apart</h2>
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
      <section className="bg-black text-white p-10 border-t border-gray-800">
        <h2 className="text-3xl font-bold text-center mb-8">Quote it. Plan it. Run it.</h2>
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
      <section className="bg-black text-white p-10 text-center border-t border-gray-800">
        <h2 className="text-3xl font-bold mb-6">Professional tools&mdash;without the big software price tag.</h2>
        <p className="text-lg mb-4 max-w-3xl mx-auto">
          We&apos;ll be offering flexible plans with everything you need to quote, plan, and deliver jobs with confidence.
        </p>
        <p className="text-lg mb-6">Early users get priority access and special launch pricing.</p>
      </section>

      {/* Contact Section */}
      <section id="contact" className="bg-black text-white p-10 text-center border-t border-gray-800">
        <h2 className="text-3xl font-bold mb-6">Got a question? Want to stay in the loop?</h2>
        <p className="text-lg mb-6 max-w-3xl mx-auto">
          We&apos;re building Constructa to help construction professionals quote, plan, and win more work without the admin headache.
          If you&apos;ve got a question, suggestion, or want early access&mdash;we&apos;d love to hear from you.
        </p>
        <div className="flex flex-col items-center space-y-4">
          <p className="text-lg">Direct email: <a href="mailto:hello@constructa.co" className="text-orange-500 hover:text-orange-400">hello@constructa.co</a></p>
          <form className="w-full max-w-md">
            <input type="text" placeholder="Name" className="w-full p-3 mb-4 bg-gray-900 border border-gray-700 rounded text-white" />
            <input type="email" placeholder="Email" className="w-full p-3 mb-4 bg-gray-900 border border-gray-700 rounded text-white" />
            <textarea placeholder="Message" className="w-full p-3 mb-4 bg-gray-900 border border-gray-700 rounded text-white" rows={4}></textarea>
            <button type="submit" className="p-3 bg-orange-600 text-white w-full rounded hover:bg-orange-700 transition-colors">Send Message</button>
          </form>
          <a href="https://www.linkedin.com" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:text-orange-400">
            LinkedIn
          </a>
        </div>
      </section>

      {/* Footer Section */}
      <footer className="bg-black text-white p-10 border-t border-gray-800">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-center">
            <div className="text-center sm:text-left">
              <p>Constructa © 2025</p>
              <p>Made for construction professionals.</p>
            </div>
            <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4 mt-4 sm:mt-0">
              <a href="#product" className="hover:text-orange-500 transition-colors">Product</a>
              <a href="#features" className="hover:text-orange-500 transition-colors">Features</a>
              <a href="#pricing" className="hover:text-orange-500 transition-colors">Pricing</a>
              <a href="#contact" className="hover:text-orange-500 transition-colors">Contact</a>
            </div>
          </div>
          <div className="text-center mt-6">
            <p>Email: <a href="mailto:hello@constructa.co" className="text-orange-500 hover:text-orange-400">hello@constructa.co</a></p>
            <a href="https://www.linkedin.com" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:text-orange-400">
              LinkedIn
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}