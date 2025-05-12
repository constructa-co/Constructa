'use client';

import React from 'react';
import { useEffect } from 'react';

export default function FeaturesPage() {
  // Optional: scroll to anchor on load (if not already handled)
  useEffect(() => {
    if (window.location.hash) {
      const id = window.location.hash.replace('#', '');
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, []);

  return (
    <main className="bg-black text-white">
      <section className="max-w-6xl mx-auto px-4 py-32 text-center">
        <h1 className="text-4xl md:text-5xl font-semibold mb-6">Designed for builders. Built for momentum.</h1>
        <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto">
          Constructa brings together quoting, planning, and delivery tools so small construction teams can work smarter—not harder.
        </p>
      </section>

      {/* Feature Block: Quote it */}
      <section className="max-w-6xl mx-auto px-4 py-24 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <h2 className="text-2xl md:text-3xl font-semibold mb-4">Quote it</h2>
          <p className="text-gray-300 text-lg mb-4">
            Build professional proposals in minutes with pre-set terms, line items, and branding.
          </p>
          <ul className="list-disc list-inside text-gray-400 text-sm space-y-2">
            <li>Insert your pricing, branding, and terms once</li>
            <li>Send a ready-to-sign PDF or share a link</li>
            <li>Get notified when clients view your proposal</li>
          </ul>
        </div>
        <div>
          <img src="/Quote Builder 1.png" alt="Constructa quote builder" className="w-full h-auto rounded-xl shadow-md" />
        </div>
      </section>

      {/* Feature Block: Plan it */}
      <section className="max-w-6xl mx-auto px-4 py-24 grid md:grid-cols-2 gap-12 items-center">
        <div className="order-2 md:order-1">
          <img src="/Job Planner Timeline 1.png" alt="Job planning view in Constructa" className="w-full h-auto rounded-xl shadow-md" />
        </div>
        <div className="order-1 md:order-2">
          <h2 className="text-2xl md:text-3xl font-semibold mb-4">Plan it</h2>
          <p className="text-gray-300 text-lg mb-4">
            Lay out job phases, milestones, and delivery dates—without drowning in spreadsheets.
          </p>
          <ul className="list-disc list-inside text-gray-400 text-sm space-y-2">
            <li>Timeline view with key phases and flags</li>
            <li>Keep teams and clients aligned</li>
            <li>Adjust schedules on the fly</li>
          </ul>
        </div>
      </section>

      {/* Feature Block: Track it */}
      <section className="max-w-6xl mx-auto px-4 py-24 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <h2 className="text-2xl md:text-3xl font-semibold mb-4">Track it</h2>
          <p className="text-gray-300 text-lg mb-4">
            From updates to hold-ups, track job progress and see what's blocking delivery.
          </p>
          <ul className="list-disc list-inside text-gray-400 text-sm space-y-2">
            <li>Phase-by-phase progress tracking</li>
            <li>Team updates and issue logging</li>
            <li>Status at-a-glance dashboard</li>
          </ul>
        </div>
        <div>
          <img src="/Progress Tracker-1.png" alt="Progress tracker in Constructa" className="w-full h-auto rounded-xl shadow-md" />
        </div>
      </section>

      {/* Feature Block: Deliver it */}
      <section className="max-w-6xl mx-auto px-4 py-24 grid md:grid-cols-2 gap-12 items-center">
        <div className="order-2 md:order-1">
          <img src="/Client Delivery Interface 1.png" alt="Client delivery interface" className="w-full h-auto rounded-xl shadow-md" />
        </div>
        <div className="order-1 md:order-2">
          <h2 className="text-2xl md:text-3xl font-semibold mb-4">Deliver it</h2>
          <p className="text-gray-300 text-lg mb-4">
            Show up prepared, stay on track, and make handovers clean—from kickoff to sign-off.
          </p>
          <ul className="list-disc list-inside text-gray-400 text-sm space-y-2">
            <li>Client-ready documentation</li>
            <li>Live updates on job status</li>
            <li>Instant access to latest changes</li>
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