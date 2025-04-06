// Main page component for Constructa
import React from 'react';

const Page = () => {
  return (
    <div>
      {/* Hero Section */}
      <section className="bg-black text-white text-center p-28">
        <h2 className="text-5xl font-bold">Constructa: proposal, planning, and project tools for construction professionals.</h2>
        <p className="mt-6 text-xl">Quote faster, plan smarter, and keep control of every job.</p>
        <img src="/images/image1.png" alt="Description of image" />
        <div className="mt-8 flex justify-center">
          <input
            type="email"
            placeholder="Enter your email"
            className="p-3 w-2/5 max-w-xs text-lg"
          />
          <button className="p-3 bg-orange-600 text-white text-lg">Be first to try Constructa</button>
        </div>
      </section>
    
      {/* Image at 50% size */}
      <div className="flex justify-center my-10">
        <img src="./public/images/image1.png" alt="Hero Section Image" className="w-1/2" />
      </div>

      {/* Problem → Solution Section */}
      <section className="bg-gray-100 text-black p-10 text-center">
        <h3 className="text-3xl font-bold mb-6">No more spreadsheets. Just smart tools for your construction company.</h3>
        <p className="text-lg mb-4">
          Running a small construction company means quoting fast, planning tight, and delivering on site—all while juggling paperwork, messages, and spreadsheets.
        </p>
        <p className="text-lg mb-4">
          Without the right tools, it's easy for details to slip through the cracks—quotes get rushed, programmes are missed, and jobs lose momentum.
        </p>
        <p className="text-lg">
          Constructa brings everything into one place. From proposals to planning and project delivery, it gives you the clarity, structure, and control you need—without the admin overload.
        </p>
      </section>

      {/* Feature Highlights Section */}
      <section className="bg-white text-black p-10">
        <h3 className="text-3xl font-bold text-center mb-8">Feature Highlights</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-8">
          <div>
            <h4 className="text-xl font-bold mb-2">Fast, accurate proposals</h4>
            <p>Create professional quotes in minutes—not hours. Set clear pricing, scope, and terms so clients know exactly what they're getting.</p>
          </div>
          <div>
            <h4 className="text-xl font-bold mb-2">Simple project planning</h4>
            <p>Build job programmes without the complexity. Set dates, phases, and dependencies so your team stays aligned from day one.</p>
          </div>
          <div>
            <h4 className="text-xl font-bold mb-2">Built-in cost control</h4>
            <p>Track budgets and changes as you go. Stay on top of cash flow and keep every job profitable.</p>
          </div>
          <div>
            <h4 className="text-xl font-bold mb-2">Build proposals that win work</h4>
            <p>Build your proposal, showcase your capability, and lock in your terms—all in a clean, consistent format.</p>
          </div>
        </div>
      </section>

      {/* What Sets Us Apart Section */}
      <section className="bg-gray-100 text-black p-10">
        <h3 className="text-3xl font-bold text-center mb-8">What Sets Us Apart</h3>
        <p className="text-lg text-center mb-6">
          Not just another piece of software—Constructa is built for how construction really works.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
          <div>
            <h4 className="text-xl font-bold mb-2">Built for people who build</h4>
            <p>Whether you're pricing up a job, planning your programme, or getting stuck in on site—Constructa works the way you do.</p>
          </div>
          <div>
            <h4 className="text-xl font-bold mb-2">Simple, practical, and made to fit</h4>
            <p>No steep learning curve—just practical tools that work out of the box.</p>
          </div>
          <div>
            <h4 className="text-xl font-bold mb-2">Control from day one</h4>
            <p>Quote, plan, and manage your jobs with confidence—no missed steps, no mess.</p>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="bg-gray-100 text-black p-10">
        <h3 className="text-3xl font-bold text-center mb-8">Quote it. Plan it. Run it.</h3>
        <ol className="list-decimal list-inside text-lg space-y-4">
          <li>
            <strong>Build your quote:</strong> Set your price, add your capability statement, and drop in your terms. Done in minutes, not hours.
          </li>
          <li>
            <strong>Map out the job:</strong> Add key dates, phases, and milestones. Keep everyone—from client to crew—on the same page.
          </li>
          <li>
            <strong>Stay in control:</strong> Track changes, stay on schedule, and keep the job moving without the spreadsheet stress.
          </li>
          <li>
            <strong>Win the work:</strong> Show clients you're ready to deliver—professional, prepared, and in control from day one.
          </li>
        </ol>
      </section>

      {/* Pricing Section */}
      <section className="bg-black text-white p-10 text-center">
        <h3 className="text-3xl font-bold mb-6">Professional tools—without the big software price tag.</h3>
        <p className="text-lg mb-4">
          We'll be offering flexible plans with everything you need to quote, plan, and deliver jobs with confidence.
        </p>
        <p className="text-lg mb-6">Early users get priority access and special launch pricing.</p>
      </section>

      {/* Contact Section */}
      <section className="bg-gray-100 text-black p-10 text-center">
        <h3 className="text-3xl font-bold mb-6">Got a question? Want to stay in the loop?</h3>
        <p className="text-lg mb-6">
          We're building Constructa to help construction professionals quote, plan, and win more work without the admin headache.
          If you've got a question, suggestion, or want early access—we'd love to hear from you.
        </p>
        <div className="flex flex-col items-center space-y-4">
          <p className="text-lg">Direct email: <a href="mailto:hello@constructa.co" className="text-orange-600">hello@constructa.co</a></p>
          <form className="w-full max-w-md">
            <input type="text" placeholder="Name" className="w-full p-3 mb-4 border border-gray-300" />
            <input type="email" placeholder="Email" className="w-full p-3 mb-4 border border-gray-300" />
            <textarea placeholder="Message" className="w-full p-3 mb-4 border border-gray-300" rows="4"></textarea>
            <button type="submit" className="p-3 bg-orange-600 text-white w-full">Send Message</button>
          </form>
          {/* Optional LinkedIn Icon */}
          <a href="https://www.linkedin.com" target="_blank" rel="noopener noreferrer" className="text-orange-600">
            LinkedIn
          </a>
        </div>
      </section>

      {/* About Section */}
      <section className="bg-white text-black p-10 text-center">
        <h3 className="text-3xl font-bold mb-6">Built by people who know the job.</h3>
        <p className="text-lg mb-4">
          We've spent years in the construction industry—quoting jobs, planning programmes, and dealing with the same headaches you face every day.
        </p>
        <p className="text-lg mb-4">
          Constructa was born out of that experience. It's designed for small construction teams who need simple, reliable tools to quote, plan, and manage work—without the bloat, the cost, or the complexity.
        </p>
        <p className="text-lg mb-4">
          We're building Constructa to be practical, fast, and made for the way construction really works.
        </p>
        <p className="text-lg font-bold">
          Our goal is simple: To give small construction teams the tools they need to work smarter, win more jobs, and stay in control—without getting buried in admin.
        </p>
      </section>

      {/* Footer Section */}
      <footer className="bg-black text-white p-10">
        <div className="flex flex-col sm:flex-row justify-between items-center">
          <div className="text-center sm:text-left">
            <p>Constructa © 2025</p>
            <p>Made for construction professionals.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4 mt-4 sm:mt-0">
            <a href="#product" className="text-orange-600">Product</a>
            <a href="#features" className="text-orange-600">Features</a>
            <a href="#pricing" className="text-orange-600">Pricing</a>
            <a href="#contact" className="text-orange-600">Contact</a>
            <a href="#about" className="text-orange-600">About</a>
          </div>
        </div>
        <div className="text-center mt-6">
          <p>Email: <a href="mailto:hello@constructa.co" className="text-orange-600">hello@constructa.co</a></p>
          {/* Optional LinkedIn Icon */}
          <a href="https://www.linkedin.com" target="_blank" rel="noopener noreferrer" className="text-orange-600">
            LinkedIn
          </a>
        </div>
      </footer>
    </div>
  );
};

export default Page;