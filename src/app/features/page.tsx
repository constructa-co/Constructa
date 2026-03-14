'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function FeaturesPage() {
  const router = useRouter();

  useEffect(() => {
    if (window.location.hash) {
      const id = window.location.hash.replace('#', '');
      setTimeout(() => {
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  }, [router]);

  return (
    <main className="bg-black text-white selection:bg-blue-500/30">
      {/* Premium Hero Section */}
      <section className="relative pt-32 pb-24 md:pt-48 md:pb-40 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-600/5 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-8 animate-fade-in">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Platform Features</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight text-white mb-8 max-w-4xl mx-auto leading-[1] uppercase">
            Designed for builders. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600">Built for momentum.</span>
          </h1>
          <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto font-medium leading-relaxed">
            Constructa brings together quoting, planning, and delivery tools so small construction teams can work smarter—not harder.
          </p>
        </div>
      </section>

      {/* Feature Block: Quote it (Proposal Tools) */}
      <section id="proposal-tools" className="relative py-24 md:py-32 border-t border-white/5 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-12 text-center items-center mb-16">
            <div className="mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-2 block font-sans">Part 01 — Quoting</span>
              <h2 className="text-4xl md:text-6xl font-black tracking-normal text-white uppercase">Quote &nbsp;it</h2>
            </div>
            <p className="text-gray-300 text-lg md:text-xl max-w-3xl leading-relaxed font-medium">
              Build professional proposals in minutes with your pricing, branding, and terms—pre-loaded and ready to reuse.
            </p>
          </div>
          
          <div className="grid lg:grid-cols-2 gap-16 md:gap-24 items-center">
            <div className="order-2 lg:order-1 relative group">
              <div className="relative aspect-[4/3] w-full max-w-[600px] mx-auto">
                <Image 
                  src="/proposal.png" 
                  alt="Quote builder interface in Constructa" 
                  fill
                  className="object-contain mix-blend-screen brightness-95 [mask-image:radial-gradient(ellipse_at_center,black_70%,transparent_100%)] transition-transform duration-700 group-hover:scale-[1.02]"
                />
              </div>
              <div className="absolute -inset-4 bg-blue-500/10 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
            </div>
            
            <div className="order-1 lg:order-2">
              <ul className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4">
                {[
                  { title: "Quick Quote Builder", desc: "Create detailed, itemized proposals fast" },
                  { title: "Custom Terms & Conditions", desc: "Reuse your legal templates across jobs" },
                  { title: "Capability Statement", desc: "Showcase your experience and credibility" },
                  { title: "One-Click Branded PDFs", desc: "Send professional documents instantly" },
                  { title: "Engagement Tracking", desc: "Get notified when clients open proposals" }
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-4 p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/[0.08] transition-colors group/item shadow-sm">
                    <div className="mt-1 w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30 group-hover/item:bg-blue-500/40 transition-colors">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm uppercase tracking-tight mb-0.5">{item.title}</div>
                      <div className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">{item.desc}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Block: Plan it (Planning Tools) */}
      <section id="planning-tools" className="relative py-24 md:py-32 border-t border-white/5 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-12 text-center items-center mb-16">
            <div className="mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-2 block font-sans">Part 02 — Planning</span>
              <h2 className="text-4xl md:text-6xl font-black tracking-normal text-white uppercase">Plan &nbsp;it</h2>
            </div>
            <p className="text-gray-300 text-lg md:text-xl max-w-3xl leading-relaxed font-medium">
              Map out your jobs with clarity—from key dates and milestones to a full programme overview. No spreadsheets needed.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-16 md:gap-24 items-center">
            <div className="order-1">
              <ul className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4">
                {[
                  { title: "Visual Programme Editor", desc: "Create clear project timelines without spreadsheets" },
                  { title: "Phase & Milestone Mapping", desc: "Break jobs into manageable chunks and key dates" },
                  { title: "Job Overview Dashboard", desc: "See all active and upcoming jobs at a glance" },
                  { title: "Shared Schedules", desc: "Keep teams and clients aligned with clear timelines" },
                  { title: "Real-time Updates", desc: "Adjust plans instantly to keep projects on track" }
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-4 p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/[0.08] transition-colors group/item shadow-sm">
                    <div className="mt-1 w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 group-hover/item:bg-emerald-500/40 transition-colors">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm uppercase tracking-tight mb-0.5">{item.title}</div>
                      <div className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">{item.desc}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="order-2 relative group">
              <div className="relative aspect-[4/3] w-full max-w-[600px] mx-auto">
                <Image 
                  src="/Build Proposal.png" 
                  alt="Job planner timeline view in Constructa" 
                  fill
                  className="object-contain mix-blend-screen brightness-95 [mask-image:radial-gradient(ellipse_at_center,black_70%,transparent_100%)] transition-transform duration-700 group-hover:scale-[1.02]"
                />
              </div>
              <div className="absolute -inset-4 bg-emerald-500/10 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
            </div>
          </div>
        </div>
      </section>

      {/* Feature Block: Track it (Cost Control) */}
      <section id="cost-control" className="relative py-24 md:py-32 border-t border-white/5 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-12 text-center items-center mb-16">
            <div className="mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-purple-500 mb-2 block font-sans">Part 03 — Tracking</span>
              <h2 className="text-4xl md:text-6xl font-black tracking-normal text-white uppercase">Track &nbsp;it</h2>
            </div>
            <p className="text-gray-300 text-lg md:text-xl max-w-3xl leading-relaxed font-medium">
              Stay in control of your costs, changes, and margins as jobs progress. Know where you stand—before issues arise.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-16 md:gap-24 items-center">
            <div className="order-2 lg:order-1 relative group">
              <div className="relative aspect-[4/3] w-full max-w-[600px] mx-auto">
                <Image 
                  src="/images/track-it.png" 
                  alt="Progress tracker dashboard in Constructa" 
                  fill
                  className="object-contain mix-blend-screen brightness-95 [mask-image:radial-gradient(ellipse_at_center,black_70%,transparent_100%)] transition-transform duration-700 group-hover:scale-[1.02]"
                />
              </div>
              <div className="absolute -inset-4 bg-purple-500/10 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
            </div>
            
            <div className="order-1 lg:order-2">
              <ul className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4">
                {[
                  { title: "Budget Tracker", desc: "Monitor spend, changes, and updates in real-time" },
                  { title: "Change Log / Variations", desc: "Record client changes and protect your margin" },
                  { title: "Margin Protection", desc: "Gain clear insight into financial performance" },
                  { title: "Phase-by-Phase Insight", desc: "See where you are making or losing money" },
                  { title: "Real-time Cost Updates", desc: "Avoid spreadsheet chaos with centralized tracking" }
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-4 p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/[0.08] transition-colors group/item shadow-sm">
                    <div className="mt-1 w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center border border-purple-500/30 group-hover/item:bg-purple-500/40 transition-colors">
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm uppercase tracking-tight mb-0.5">{item.title}</div>
                      <div className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">{item.desc}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Block: Deliver it (Communication & Delivery) */}
      <section id="communication-&-delivery" className="relative py-24 md:py-32 border-t border-white/5 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-12 text-center items-center mb-16">
            <div className="mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-2 block font-sans">Part 04 — Delivery</span>
              <h2 className="text-4xl md:text-6xl font-black tracking-normal text-white uppercase">Deliver &nbsp;it</h2>
            </div>
            <p className="text-gray-300 text-lg md:text-xl max-w-3xl leading-relaxed font-medium">
              From updates to handovers, keep clients informed and your team in sync—all from one place.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-16 md:gap-24 items-center">
            <div className="order-1">
              <ul className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4">
                {[
                  { title: "One-Tap Updates", desc: "Update job status or key info in seconds from anywhere" },
                  { title: "Client-Ready Documentation", desc: "Provide instant access to professional docs" },
                  { title: "Mobile-First Workflow", desc: "Built to work wherever you are—on-site or on the move" },
                  { title: "Shared Comms", desc: "Keep your site and office teams perfectly aligned" },
                  { title: "Real-time Progress", desc: "Build trust by showing clients progress as it happens" }
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-4 p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/[0.08] transition-colors group/item shadow-sm">
                    <div className="mt-1 w-5 h-5 rounded-full bg-blue-400/20 flex items-center justify-center border border-blue-400/30 group-hover/item:bg-blue-400/40 transition-colors">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm uppercase tracking-tight mb-0.5">{item.title}</div>
                      <div className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">{item.desc}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="order-2 relative group">
              <div className="relative aspect-[4/3] w-full max-w-[600px] mx-auto">
                <Image 
                  src="/Quote Plan Deliver 1.png" 
                  alt="Client delivery screen in Constructa" 
                  fill
                  className="object-contain mix-blend-screen brightness-95 [mask-image:radial-gradient(ellipse_at_center,black_70%,transparent_100%)] transition-transform duration-700 group-hover:scale-[1.02]"
                />
              </div>
              <div className="absolute -inset-4 bg-blue-400/10 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
            </div>
          </div>
        </div>
      </section>

      {/* Premium Highlight Bar */}
      <section className="relative py-32 md:py-48 border-t border-white/5 overflow-hidden text-center bg-white/[0.02]">
        <div className="max-w-4xl mx-auto px-4 relative z-10">
          <h2 className="text-4xl md:text-6xl font-black tracking-tight text-white mb-8 uppercase leading-[1]">
            Save hours. <span className="text-blue-500">Win more work.</span> <br />Stay in control.
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto font-medium leading-relaxed">
            Constructa isn't just software—it's the structure that helps you price better, plan tighter, and deliver with confidence.
          </p>
          <div className="mt-12">
            <a href="/login" className="inline-flex h-12 items-center justify-center px-8 bg-white text-black text-sm font-black uppercase tracking-widest rounded-xl hover:bg-gray-100 transition-colors shadow-lg shadow-white/10">
              Get Started for free
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}