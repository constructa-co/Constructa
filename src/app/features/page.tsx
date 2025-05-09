'use client';

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
    <main className="min-h-screen pt-16 bg-black">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <section className="text-center mb-16">
          <h1 className="text-4xl font-bold text-white mb-6">All the tools you need—built for how construction really works</h1>
          <p className="text-lg text-gray-400 max-w-3xl mx-auto">
            From quoting to planning and delivery, Constructa is designed to give small builders clarity, speed, and control—without the admin bloat.
          </p>
        </section>

        {/* In-page anchor nav */}
        <nav className="flex flex-wrap justify-center gap-6 text-sm font-medium mb-16">
          <a href="#proposal-tools" className="text-gray-400 hover:text-white transition-colors duration-200">Proposal Tools</a>
          <a href="#planning-tools" className="text-gray-400 hover:text-white transition-colors duration-200">Planning Tools</a>
          <a href="#cost-control" className="text-gray-400 hover:text-white transition-colors duration-200">Cost Control</a>
          <a href="#communication" className="text-gray-400 hover:text-white transition-colors duration-200">Communication & Delivery</a>
        </nav>

        <div className="space-y-24">
          {/* Proposal Tools */}
          <section id="proposal-tools" className="scroll-mt-24">
            <h2 className="text-2xl font-semibold text-white mb-8">📝 Proposal Tools</h2>
            <div className="space-y-8">
              <div>
                <h3 className="text-xl font-bold text-white mb-4">Quick Quote Builder</h3>
                <p className="text-gray-400">
                  Create job proposals in minutes with pre-defined line items, quantities, and unit costs. Include labour, materials, and subcontractor details in one clean view—automatically totalled and client-ready.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-4">Custom Terms & Conditions</h3>
                <p className="text-gray-400">
                  Reuse your preferred payment terms, exclusions, and legal clauses across all projects. Set them once and apply consistently for reduced risk.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-4">Capability Statement Builder</h3>
                <p className="text-gray-400">
                  Showcase your business credentials, past work, and qualifications. Auto-generate a capability section for every proposal to present a professional, polished image without repetitive effort.
                </p>
              </div>
            </div>
          </section>

          {/* Planning Tools */}
          <section id="planning-tools" className="scroll-mt-24">
            <h2 className="text-2xl font-semibold text-white mb-8">📅 Planning Tools</h2>
            <div className="space-y-8">
              <div>
                <h3 className="text-xl font-bold text-white mb-4">Visual Programme Editor</h3>
                <p className="text-gray-400">
                  Plan jobs visually using a drag-and-drop timeline. Add phases, set durations, and shift timelines on the fly—no spreadsheet needed.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-4">Phase & Milestone Mapping</h3>
                <p className="text-gray-400">
                  Break jobs into clear stages—groundworks, shell, fit-out—and assign key milestones to track client delivery expectations.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-4">Job Overview Dashboard</h3>
                <p className="text-gray-400">
                  Get a high-level view of all your active jobs, with key dates, phase status, and alerts for delays or changes. See what needs attention—instantly.
                </p>
              </div>
            </div>
          </section>

          {/* Cost Control */}
          <section id="cost-control" className="scroll-mt-24">
            <h2 className="text-2xl font-semibold text-white mb-8">💰 Cost Control</h2>
            <div className="space-y-8">
              <div>
                <h3 className="text-xl font-bold text-white mb-4">Budget Tracker</h3>
                <p className="text-gray-400">
                  Track actual costs against your quoted values as the job progresses. Monitor committed costs, invoices, and get alerts when spend exceeds thresholds.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-4">Change Log / Variations</h3>
                <p className="text-gray-400">
                  Keep a clean record of every client change or variation. Each update adjusts your programme, cost summary, and client communication—no surprises.
                </p>
              </div>
            </div>
          </section>

          {/* Communication & Delivery */}
          <section id="communication" className="scroll-mt-24">
            <h2 className="text-2xl font-semibold text-white mb-8">📡 Communication & Delivery</h2>
            <div className="space-y-8">
              <div>
                <h3 className="text-xl font-bold text-white mb-4">Client-Ready PDFs</h3>
                <p className="text-gray-400">
                  Generate polished, branded proposals, schedules, and variation summaries—ready to share in seconds.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-4">One-Tap Updates</h3>
                <p className="text-gray-400">
                  Quickly log key job updates—progress reports, material delays, or task completions—with a single tap. Automatically syncs across your team and dashboard.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-4">Mobile-First Workflow</h3>
                <p className="text-gray-400">
                  Designed for site-first use. Whether you're on the scaffold or in the van, update jobs and check timelines on the go—no laptop required.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
} 