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
      const features = document.querySelectorAll('.feature-container');
      const scrollPosition = window.scrollY;

      features.forEach((feature, index) => {
        const featureTop = (feature as HTMLElement).offsetTop;
        const featureHeight = (feature as HTMLElement).offsetHeight;
        
        if (scrollPosition >= featureTop - window.innerHeight / 2 && 
            scrollPosition < featureTop + featureHeight - window.innerHeight / 2) {
          setActiveFeature(index);
        }
      });
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <section className="py-16 md:py-32 px-4 md:px-8">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center">How It Works</h2>
        
        {/* Sticky scroll container - only for this section */}
        <div className="relative">
          {/* Fixed left side with images - only visible on desktop */}
          <div className="fixed left-0 top-0 w-1/2 h-screen overflow-hidden hidden md:block">
            <div className="h-full flex flex-col">
              <div className="h-screen flex items-center justify-center">
                <Image
                  src="/images/Build your proposal White.png"
                  alt="Proposals"
                  width={800}
                  height={600}
                  className="object-contain"
                  priority
                />
              </div>
            </div>
          </div>

          {/* Scrollable right side with content */}
          <div className="md:ml-[50%]">
            <div className="feature-container h-screen flex items-center px-4 md:px-16">
              <div className="max-w-xl">
                <h3 className="text-2xl md:text-3xl font-semibold mb-4">Fast, accurate proposals</h3>
                <p className="text-lg text-gray-300">
                  Create professional quotes in minutes—not hours. Set clear pricing, scope, and terms so clients know exactly what they're getting.
                </p>
              </div>
            </div>

            <div className="feature-container h-screen flex items-center px-4 md:px-16">
              <div className="max-w-xl">
                <h3 className="text-2xl md:text-3xl font-semibold mb-4">Simple project planning</h3>
                <p className="text-lg text-gray-300">
                  Build job programmes without the complexity. Set dates, phases, and dependencies so your team stays aligned from day one.
                </p>
              </div>
            </div>

            <div className="feature-container h-screen flex items-center px-4 md:px-16">
              <div className="max-w-xl">
                <h3 className="text-2xl md:text-3xl font-semibold mb-4">One-tap updates</h3>
                <p className="text-lg text-gray-300">
                  Keep everyone in the loop with instant updates. Share progress, changes, and important information with your team and clients.
                </p>
              </div>
            </div>

            <div className="feature-container h-screen flex items-center px-4 md:px-16">
              <div className="max-w-xl">
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
      <FeatureSection />

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