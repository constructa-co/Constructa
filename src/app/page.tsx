// Main page component for Constructa - Latest version
import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Script from 'next/script';

export default function Home() {
  const [activeSection, setActiveSection] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const sections = document.querySelectorAll('.section-container');
      const scrollPosition = window.scrollY;

      sections.forEach((section, index) => {
        const sectionTop = (section as HTMLElement).offsetTop;
        const sectionHeight = (section as HTMLElement).offsetHeight;
        
        if (scrollPosition >= sectionTop - window.innerHeight / 2 && 
            scrollPosition < sectionTop + sectionHeight - window.innerHeight / 2) {
          setActiveSection(index);
        }
      });
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="relative">
      {/* Sticky left side */}
      <div className="fixed left-0 top-0 w-1/2 h-screen overflow-hidden">
        <div className="h-full flex flex-col">
          <div className="section-image h-screen flex items-center justify-center transition-opacity duration-500"
               style={{ opacity: activeSection === 0 ? 1 : 0 }}>
            <Image
              src="/images/hero-image.png"
              alt="Hero"
              width={800}
              height={600}
              className="object-contain"
              priority
            />
          </div>
          <div className="section-image h-screen flex items-center justify-center transition-opacity duration-500"
               style={{ opacity: activeSection === 1 ? 1 : 0 }}>
            <Image
              src="/images/Build your proposal White.png"
              alt="Proposals"
              width={800}
              height={600}
              className="object-contain"
            />
          </div>
          <div className="section-image h-screen flex items-center justify-center transition-opacity duration-500"
               style={{ opacity: activeSection === 2 ? 1 : 0 }}>
            <Image
              src="/images/project Timecard.png"
              alt="Planning"
              width={800}
              height={600}
              className="object-contain"
            />
          </div>
          <div className="section-image h-screen flex items-center justify-center transition-opacity duration-500"
               style={{ opacity: activeSection === 3 ? 1 : 0 }}>
            <Image
              src="/images/One Tap Update White.png"
              alt="Updates"
              width={800}
              height={600}
              className="object-contain"
            />
          </div>
        </div>
      </div>

      {/* Scrollable right side */}
      <div className="ml-[50%]">
        <div className="section-container h-screen flex items-center px-16">
          <div className="max-w-xl">
            <h1 className="text-5xl font-semibold mb-6">
              Constructa: proposal, planning and project tools for construction professionals.
            </h1>
            <p className="text-xl text-gray-400">
              Quote faster, plan smarter, and keep control of every job.
            </p>
          </div>
        </div>

        <div className="section-container h-screen flex items-center px-16">
          <div className="max-w-xl">
            <h2 className="text-4xl font-semibold mb-6">
              Fast, accurate proposals
            </h2>
            <p className="text-lg text-gray-400">
              Create professional quotes in minutes—not hours. Set clear pricing, scope, and terms so clients know exactly what they're getting.
            </p>
          </div>
        </div>

        <div className="section-container h-screen flex items-center px-16">
          <div className="max-w-xl">
            <h2 className="text-4xl font-semibold mb-6">
              Simple project planning
            </h2>
            <p className="text-lg text-gray-400">
              Build job programmes without the complexity. Set dates, phases, and dependencies so your team stays aligned from day one.
            </p>
          </div>
        </div>

        <div className="section-container h-screen flex items-center px-16">
          <div className="max-w-xl">
            <h2 className="text-4xl font-semibold mb-6">
              Built-in cost control
            </h2>
            <p className="text-lg text-gray-400">
              Track budgets and changes as you go. Stay on top of cash flow and keep every job profitable.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}