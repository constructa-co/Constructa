import React from "react";

export default function Home() {
  return (
    <div className="bg-black text-white">
      {/* Header Section */}
      <header className="bg-black text-white p-4">
        <div className="flex justify-between">
          <h1 className="text-xl font-bold">Constructa</h1>
          <nav>
            <ul className="flex space-x-4">
              <li><a href="/product" className="hover:text-gray-400">Product</a></li>
              <li><a href="/features" className="hover:text-gray-400">Features</a></li>
              <li><a href="/pricing" className="hover:text-gray-400">Pricing</a></li>
              <li><a href="/contact" className="hover:text-gray-400">Contact</a></li>
            </ul>
          </nav>
        </div>
      </header>

      {/* Main Section */}
      <main className="my-16">
        {/* Hero Section */}
        <section className="text-center py-10">
          <h2 className="text-4xl font-bold mb-4">SaaS for the next generation of construction firms.</h2>
          <p className="text-lg mb-8">We help construction professionals plan, cost, and manage projects with ease.</p>
          <div className="w-[25%] mx-auto">
            <img
              src="https://via.placeholder.com/700x400"
              alt="Plan, cost, and manage projects"
              className="w-full"
            />
          </div>
          <p className="mt-4">We’ll be launching soon. Stay in the loop.</p>
        </section>

        {/* Email Capture Section */}
        <section className="text-center py-8">
          <div className="w-[50%] mx-auto">
            <input
              type="email"
              placeholder="Enter your email"
              className="w-full p-2 text-black rounded-md mb-4"
            />
            <button className="bg-orange-500 text-white px-6 py-2 rounded-md">
              Submit
            </button>
          </div>
        </section>

        {/* Features Section */}
        <section className="text-center py-16">
          <h3 className="text-3xl font-bold mb-6">Simplified estimating and planning</h3>
          <div className="flex justify-around">
            <div className="p-4">
              <h4 className="text-xl">Estimate</h4>
              <p>$10/month</p>
            </div>
            <div className="p-4">
              <h4 className="text-xl">Proposal</h4>
              <p>$20/month</p>
            </div>
            <div className="p-4">
              <h4 className="text-xl">Planning</h4>
              <p>$30/month</p>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section className="bg-black text-white text-center py-16">
          <h3 className="text-3xl font-bold mb-6">Pricing</h3>
          <p className="mb-8">We’ll be offering flexible plans with everything you need to quote, plan, and deliver jobs with confidence.</p>
          <p className="mb-4">Early users get priority access and special launch pricing.</p>
        </section>
      </main>

      {/* Footer Section */}
      <footer className="bg-black text-white text-center py-4">
        <p>Constructa © 2025</p>
      </footer>
    </div>
  );
}