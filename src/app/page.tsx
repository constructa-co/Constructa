import React from 'react';

const Page = () => {
  return (
    <div>
      {/* Hero Section */}
      <section className="bg-black text-white text-center p-28">
        <h2 className="text-5xl font-bold">SaaS for the next generation of construction firms.</h2>
        <p className="mt-6 text-xl">We help construction professionals plan, cost, and manage projects with ease.</p>
        <img src="/images/image1.png" alt="Description of image" />
        <div className="mt-8 flex justify-center">
          <input
            type="email"
            placeholder="Enter your email"
            className="p-3 w-2/5 max-w-xs text-lg"
          />
          <button className="p-3 bg-orange-600 text-white text-lg">Submit</button>
        </div>
      </section>

      {/* Image Section */}
      <div className="flex justify-center my-10">
        <img src="/images/image1.png" alt="Description of image" className="max-w-full h-auto" />
      </div>

      {/* Pricing Section */}
      <section className="bg-black text-white p-8 text-center">
        <h3 className="text-3xl mb-8 font-bold">Pricing</h3>
        <p className="mt-4 text-xl">We’ll be offering flexible plans with everything you need to quote, plan, and deliver jobs with confidence.</p>
        <p className="mt-2 text-xl">Early users get priority access and special launch pricing.</p>

        {/* Pricing Table */}
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="bg-white text-black p-6 border border-gray-300">
            <h4 className="text-2xl font-bold mb-4">Starter</h4>
            <p className="text-lg mb-4">£19/month</p>
            <ul className="list-disc pl-5 text-lg">
              <li>✓ Estimates & proposals</li>
              <li>✓ 1 user</li>
              <li>✓ Unlimited projects</li>
            </ul>
          </div>

          <div className="bg-white text-black p-6 border border-gray-300">
            <h4 className="text-2xl font-bold mb-4">Pro</h4>
            <p className="text-lg mb-4">£49/month</p>
            <ul className="list-disc pl-5 text-lg">
              <li>✓ Everything in Starter</li>
              <li>✓ Schedule planning</li>
              <li>✓ Contract tools</li>
              <li>✓ Cost tracking</li>
            </ul>
          </div>

          <div className="bg-white text-black p-6 border border-gray-300">
            <h4 className="text-2xl font-bold mb-4">Team</h4>
            <p className="text-lg mb-4">£99/month</p>
            <ul className="list-disc pl-5 text-lg">
              <li>✓ Everything in Pro</li>
              <li>✓ 5 users</li>
              <li>✓ Customer support</li>
              <li>✓ Future integrations</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Footer Section */}
      <footer className="bg-black text-white p-5 mt-10 text-center">
        <div>© 2025 Constructa. All rights reserved.</div>
      </footer>
    </div>
  );
};

export default Page;