'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';

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
    <main className="bg-black text-white">
      <section className="max-w-6xl mx-auto px-4 py-32 text-center">
        <h1 className="text-4xl md:text-5xl font-semibold mb-6">Designed for builders. Built for momentum.</h1>
        <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto">
          Constructa brings together quoting, planning, and delivery tools so small construction teams can work smarter—not harder.
        </p>
      </section>

      {/* Feature Block: Quote it (Proposal Tools) */}
      <section id="proposal-tools" className="max-w-6xl mx-auto px-4 py-24 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <h2 className="text-2xl md:text-3xl font-semibold mb-4">Quote it</h2>
          <p className="text-gray-300 text-lg mb-4">
            Build professional proposals in minutes with your pricing, branding, and terms—pre-loaded and ready to reuse.
          </p>
          <ul className="list-disc list-inside text-gray-400 text-sm space-y-2">
            <li>Use the Quick Quote Builder to create detailed, itemized proposals fast</li>
            <li>Set your own Custom Terms & Conditions and reuse them across jobs</li>
            <li>Add a Capability Statement to show clients your experience and credibility</li>
            <li>Send branded, client-ready PDFs with one click</li>
            <li>Get notified when clients open your proposal</li>
          </ul>
        </div>
        <div>
          <img src="/images/quote-builder.png" alt="Quote builder interface in Constructa" className="w-full h-auto rounded-xl shadow-md" />
        </div>
      </section>

      {/* Feature Block: Plan it (Planning Tools) */}
      <section id="planning-tools" className="max-w-6xl mx-auto px-4 py-24 grid md:grid-cols-2 gap-12 items-center">
        <div className="order-2 md:order-1">
          <img src="/images/job-planner-timeline.png" alt="Job planner timeline view in Constructa" className="w-full h-auto rounded-xl shadow-md" />
        </div>
        <div className="order-1 md:order-2">
          <h2 className="text-2xl md:text-3xl font-semibold mb-4">Plan it</h2>
          <p className="text-gray-300 text-lg mb-4">
            Map out your jobs with clarity—from key dates and milestones to a full programme overview. No spreadsheets needed.
          </p>
          <ul className="list-disc list-inside text-gray-400 text-sm space-y-2">
            <li>Visual Programme Editor makes timelines easy to build and read</li>
            <li>Break jobs into phases and milestones for better control</li>
            <li>Use the Job Dashboard to see all your jobs at a glance</li>
            <li>Keep teams and clients aligned with shared schedules</li>
            <li>Make real-time updates to keep projects on track</li>
          </ul>
        </div>
      </section>

      {/* Feature Block: Track it (Cost Control) */}
      <section id="cost-control" className="max-w-6xl mx-auto px-4 py-24 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <h2 className="text-2xl md:text-3xl font-semibold mb-4">Track it</h2>
          <p className="text-gray-300 text-lg mb-4">
            Stay in control of your costs, changes, and margins as jobs progress. Know where you stand—before issues arise.
          </p>
          <ul className="list-disc list-inside text-gray-400 text-sm space-y-2">
            <li>Track job budgets in real-time with the Budget Tracker</li>
            <li>Monitor client changes with a built-in Change Log</li>
            <li>Protect your margin by recording variations clearly</li>
            <li>See updates and financial impacts across every job</li>
            <li>Gain insight into cost performance phase-by-phase</li>
          </ul>
        </div>
        <div>
          <img src="/images/progress-tracker.png" alt="Progress tracker dashboard in Constructa" className="w-full h-auto rounded-xl shadow-md" />
        </div>
      </section>

      {/* Feature Block: Deliver it (Communication & Delivery) */}
      <section id="communication-&-delivery" className="max-w-6xl mx-auto px-4 py-24 grid md:grid-cols-2 gap-12 items-center">
        <div className="order-2 md:order-1">
          <img src="/images/client-delivery-interface.png" alt="Client delivery screen in Constructa" className="w-full h-auto rounded-xl shadow-md" />
        </div>
        <div className="order-1 md:order-2">
          <h2 className="text-2xl md:text-3xl font-semibold mb-4">Deliver it</h2>
          <p className="text-gray-300 text-lg mb-4">
            From updates to handovers, keep clients informed and your team in sync—all from one place.
          </p>
          <ul className="list-disc list-inside text-gray-400 text-sm space-y-2">
            <li>Share live status updates with One-Tap Updates</li>
            <li>Provide clients with Client-Ready Documentation instantly</li>
            <li>Work from anywhere with a Mobile-First Workflow</li>
            <li>Keep your site and office aligned with shared comms</li>
            <li>Build trust by showing clients progress in real time</li>
          </ul>
        </div>
      </section>

      {/* Highlight Bar */}
      <section className="max-w-6xl mx-auto px-4 py-32 text-center border-t border-gray-800">
        <h2 className="text-3xl md:text-4xl font-semibold mb-6">Save hours. Win more work. Stay in control.</h2>
        <p className="text-lg text-gray-400 max-w-2xl mx-auto">
          Constructa isn't just software—it's the structure that helps you price better, plan tighter, and deliver with confidence.
        </p>
      </section>
    </main>
  );
}