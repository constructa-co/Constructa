'use client';

// Main page component for Constructa - Latest version
import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Script from 'next/script';

// Feature section component with sticky scroll
const FeatureSection = () => {
  const [activeFeature, setActiveFeature] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const section = document.getElementById('feature-section');
      if (!section) return;

      const rect = section.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const scrollPosition = window.scrollY;
      const sectionTop = section.offsetTop;
      const sectionHeight = section.offsetHeight;

      // Calculate which feature should be active based on scroll position
      const progress = (scrollPosition - sectionTop) / (sectionHeight - windowHeight);
      const featureIndex = Math.min(Math.max(Math.floor(progress * 4), 0), 3);
      
      setActiveFeature(featureIndex);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <section id="feature-section" className="relative h-[400vh]">
      {/* Sticky container for the entire feature section */}
      <div className="sticky top-0 h-screen overflow-hidden">
        <div className="relative h-full">
          {/* Left side - Sticky images */}
          <div className="absolute left-0 top-0 w-1/2 h-full hidden md:block">
            <div className="relative h-full">
              <div className={`absolute inset-0 transition-opacity duration-500 ${activeFeature === 0 ? 'opacity-100' : 'opacity-0'}`}>
                <Image
                  src="/images/Build your proposal White.png"
                  alt="Proposals"
                  width={800}
                  height={600}
                  className="object-contain w-full h-full"
                  priority
                />
              </div>
              <div className={`absolute inset-0 transition-opacity duration-500 ${activeFeature === 1 ? 'opacity-100' : 'opacity-0'}`}>
                <Image
                  src="/images/project Timecard.png"
                  alt="Planning"
                  width={800}
                  height={600}
                  className="object-contain w-full h-full"
                />
              </div>
              <div className={`absolute inset-0 transition-opacity duration-500 ${activeFeature === 2 ? 'opacity-100' : 'opacity-0'}`}>
                <Image
                  src="/images/One Tap Update White.png"
                  alt="Updates"
                  width={800}
                  height={600}
                  className="object-contain w-full h-full"
                />
              </div>
              <div className={`absolute inset-0 transition-opacity duration-500 ${activeFeature === 3 ? 'opacity-100' : 'opacity-0'}`}>
                <Image
                  src="/images/Client-Ready Quote White.png"
                  alt="Cost Control"
                  width={800}
                  height={600}
                  className="object-contain w-full h-full"
                />
              </div>
            </div>
          </div>

          {/* Right side - Animated text */}
          <div className="md:ml-[50%] h-full flex items-center px-4 md:px-16">
            <div className="max-w-xl">
              <div className={`transition-opacity duration-500 ${activeFeature === 0 ? 'opacity-100' : 'opacity-0'}`}>
                <h3 className="text-2xl md:text-3xl font-semibold mb-4">Fast, accurate proposals</h3>
                <p className="text-lg text-gray-300">
                  Create professional quotes in minutes—not hours. Set clear pricing, scope, and terms so clients know exactly what they're getting.
                </p>
              </div>
              <div className={`transition-opacity duration-500 ${activeFeature === 1 ? 'opacity-100' : 'opacity-0'}`}>
                <h3 className="text-2xl md:text-3xl font-semibold mb-4">Simple project planning</h3>
                <p className="text-lg text-gray-300">
                  Build job programmes without the complexity. Set dates, phases, and dependencies so your team stays aligned from day one.
                </p>
              </div>
              <div className={`transition-opacity duration-500 ${activeFeature === 2 ? 'opacity-100' : 'opacity-0'}`}>
                <h3 className="text-2xl md:text-3xl font-semibold mb-4">One-tap updates</h3>
                <p className="text-lg text-gray-300">
                  Keep everyone in the loop with instant updates. Share progress, changes, and important information with your team and clients.
                </p>
              </div>
              <div className={`transition-opacity duration-500 ${activeFeature === 3 ? 'opacity-100' : 'opacity-0'}`}>
                <h3 className="text-2xl md:text-3xl font-semibold mb-4">Built-in cost control</h3>
                <p className="text-lg text-gray-300">
                  Track budgets and changes as you go. Stay on top of cash flow and keep every job profitable.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// Main page component
export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-black to-gray-900 text-white">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center py-16 md:py-32 px-4 md:px-8">
        <div className="absolute inset-0 bg-gradient-to-b from-black to-gray-900 z-0"></div>
        <div className="relative z-10 max-w-7xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Constructa
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto">
            Proposal, planning and project tools for construction professionals
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="col-span-1 md:col-span-3 text-center">
              <p className="text-lg md:text-xl text-gray-400">
                Quote faster, plan smarter, and keep control of every job.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Problem-Solution Section */}
      <section className="py-16 md:py-32 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">The Problem</h2>
              <p className="text-lg text-gray-300 mb-4">
                Construction professionals are drowning in paperwork and spreadsheets. Quotes take hours to prepare, project timelines are hard to track, and cost control is a constant headache.
              </p>
              <p className="text-lg text-gray-300">
                Without the right tools, you're spending more time on admin than on the work that matters.
              </p>
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">The Solution</h2>
              <p className="text-lg text-gray-300 mb-4">
                Constructa brings all your construction tools into one place. Create professional quotes in minutes, build clear project timelines, and keep track of costs as you go.
              </p>
              <p className="text-lg text-gray-300">
                Spend less time on paperwork and more time on the job.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Highlights Section with Sticky Scroll */}
      <section className="py-16 md:py-32 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center">How It Works</h2>
          <FeatureSection />
        </div>
      </section>

      {/* About Us Section */}
      <section className="py-16 md:py-32 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center">About Us</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-lg text-gray-300 mb-6">
                We're a team of construction professionals and software developers who understand the challenges of running a construction business. We built Constructa because we couldn't find tools that were both powerful enough and easy enough to use.
              </p>
              <p className="text-lg text-gray-300">
                Our mission is to help construction professionals spend less time on paperwork and more time on the work that matters.
              </p>
            </div>
            <div className="relative h-[400px]">
              <Image
                src="/images/about-us.jpg"
                alt="About Constructa"
                fill
                className="object-cover rounded-lg"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-16 md:py-32 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center">Simple, Transparent Pricing</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-gray-800 p-8 rounded-lg">
              <h3 className="text-2xl font-semibold mb-4">Starter</h3>
              <p className="text-4xl font-bold mb-6">£29<span className="text-lg">/mo</span></p>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Up to 5 projects
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Basic proposal tools
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Project timeline
                </li>
              </ul>
              <button className="w-full bg-orange-500 text-white py-3 rounded-lg hover:bg-orange-600 transition-colors">
                Get Started
              </button>
            </div>
            <div className="bg-gray-800 p-8 rounded-lg">
              <h3 className="text-2xl font-semibold mb-4">Professional</h3>
              <p className="text-4xl font-bold mb-6">£79<span className="text-lg">/mo</span></p>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Up to 20 projects
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Advanced proposal tools
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Project timeline
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Cost tracking
                </li>
              </ul>
              <button className="w-full bg-orange-500 text-white py-3 rounded-lg hover:bg-orange-600 transition-colors">
                Get Started
              </button>
            </div>
            <div className="bg-gray-800 p-8 rounded-lg">
              <h3 className="text-2xl font-semibold mb-4">Enterprise</h3>
              <p className="text-4xl font-bold mb-6">Custom</p>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Unlimited projects
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  All features
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Custom integrations
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Priority support
                </li>
              </ul>
              <button className="w-full bg-orange-500 text-white py-3 rounded-lg hover:bg-orange-600 transition-colors">
                Contact Us
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* What Sets Us Apart Section */}
      <section className="py-16 md:py-32 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center">What Sets Us Apart</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-gray-800 p-6 rounded-lg">
              <h3 className="text-xl font-semibold mb-4">Built for Construction</h3>
              <p className="text-gray-300">
                Designed specifically for construction professionals, with features that match how you actually work.
              </p>
            </div>
            <div className="bg-gray-800 p-6 rounded-lg">
              <h3 className="text-xl font-semibold mb-4">Simple Yet Powerful</h3>
              <p className="text-gray-300">
                Easy to use but packed with the features you need to run your business efficiently.
              </p>
            </div>
            <div className="bg-gray-800 p-6 rounded-lg">
              <h3 className="text-xl font-semibold mb-4">All-in-One Solution</h3>
              <p className="text-gray-300">
                Everything you need in one place—no more juggling multiple tools and systems.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Us Section */}
      <section className="py-16 md:py-32 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center">Contact Us</h2>
          <div className="max-w-xl mx-auto text-center">
            <p className="text-lg text-gray-300 mb-8">
              Ready to transform how you manage your construction projects? Get in touch to learn more about Constructa.
            </p>
            <div className="flex flex-col items-center space-y-4">
              <div className="flex items-center space-x-2">
                <h3 className="text-xl font-semibold">LinkedIn:</h3>
                <a href="https://www.linkedin.com/company/constructa-co" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
                  Constructa
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}