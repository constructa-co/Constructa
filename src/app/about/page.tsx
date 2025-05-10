import React from 'react';

function MetricIcon({ type }: { type: 'building' | 'stopwatch' | 'spreadsheet' }) {
  if (type === 'building') {
    return (
      <svg className="w-7 h-7 text-gray-400 mb-2" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="4" y="7" width="16" height="13" rx="2" className="stroke-gray-500"/><rect x="9" y="12" width="2" height="2" className="fill-gray-700"/><rect x="13" y="12" width="2" height="2" className="fill-gray-700"/><rect x="9" y="16" width="2" height="2" className="fill-gray-700"/><rect x="13" y="16" width="2" height="2" className="fill-gray-700"/></svg>
    );
  }
  if (type === 'stopwatch') {
    return (
      <svg className="w-7 h-7 text-gray-400 mb-2" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="12" cy="14" r="7" className="stroke-gray-500"/><path d="M12 14V10" className="stroke-gray-500"/><rect x="10" y="3" width="4" height="2" rx="1" className="fill-gray-700"/></svg>
    );
  }
  if (type === 'spreadsheet') {
    return (
      <svg className="w-7 h-7 text-gray-400 mb-2" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="2" className="stroke-gray-500"/><path d="M4 9h16M9 5v14M15 5v14" className="stroke-gray-500"/></svg>
    );
  }
  return null;
}

export default function About() {
  return (
    <main className="bg-black text-white">
      {/* Section 1 */}
      <section className="max-w-6xl mx-auto px-4 py-24 grid grid-cols-1 md:grid-cols-5 gap-8">
        <h1 className="col-span-1 text-lg font-medium">Built by people who know the job</h1>
        <div className="col-span-4 space-y-6 text-gray-300">
          <p>
            We've spent decades quoting jobs, planning programmes, and juggling the chaos of
            construction—clipboards, emails, spreadsheets, WhatsApp threads, last-minute changes.
          </p>
          <p>
            Constructa was born out of that reality. Not from a VC boardroom or software incubator—but
            from site visits, delivery delays, tight margins, and the stress of getting it right.
          </p>
          <p>We're not building another tool to add to the pile. We're building the one that ties everything together.</p>
        </div>
      </section>

      {/* Section 2 */}
      <section className="max-w-6xl mx-auto px-4 py-24 grid grid-cols-1 md:grid-cols-5 gap-8 border-t border-gray-800">
        <h2 className="col-span-1 text-lg font-medium">The problem we saw</h2>
        <div className="col-span-4 space-y-6 text-gray-300">
          <p>
            Running a small construction company means juggling everything—quoting fast, planning
            tight, and keeping things moving on site.
          </p>
          <ul className="list-disc list-inside pl-4 space-y-1">
            <li>Proposals get rushed</li>
            <li>Programmes get misaligned</li>
            <li>Project control slips</li>
            <li>And admin takes over</li>
          </ul>
          <p>
            Big software platforms are overkill. Manual systems are high risk. And most tools weren't built for builders.
          </p>
        </div>
      </section>

      {/* Section 3 */}
      <section className="max-w-6xl mx-auto px-4 py-24 grid grid-cols-1 md:grid-cols-5 gap-8 border-t border-gray-800">
        <h2 className="col-span-1 text-lg font-medium">The solution we're building</h2>
        <div className="col-span-4 space-y-6 text-gray-300">
          <p>
            Constructa brings quoting, planning, and delivery into one clean, easy-to-use platform.
          </p>
          <ul className="list-disc list-inside pl-4 space-y-1">
            <li>Create a client-ready proposal in minutes</li>
            <li>Build a job plan that keeps everyone aligned</li>
            <li>Track progress and changes without the spreadsheet stress</li>
            <li>Win more work by looking more professional from day one</li>
          </ul>
          <p>We're starting simple. And growing with our users—brick by brick.</p>
        </div>
      </section>

      {/* Section 4 */}
      <section className="max-w-6xl mx-auto px-4 py-24 grid grid-cols-1 md:grid-cols-5 gap-8 border-t border-gray-800">
        <h2 className="col-span-1 text-lg font-medium">A message from Rob</h2>
        <div className="col-span-4 space-y-6 text-gray-300 italic">
          <p>
            "After 25 years in construction, I knew there had to be a better way. I've seen first-hand how
            hard it is to manage projects and people while keeping proposals sharp, programmes aligned,
            and clients happy.
          </p>
          <p>
            Constructa isn't just software—it's a response to everything I wish I'd had earlier in my career.
            We're building it with care, with clarity, and with builders front and centre."
          </p>
        </div>
      </section>

      {/* Why now? Section with icons */}
      <section className="max-w-6xl mx-auto px-4 py-24 border-t border-gray-800">
        <div className="text-lg font-medium mb-8">Why now?</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-gray-300">
          <div className="space-y-2 flex flex-col items-start">
            <MetricIcon type="building" />
            <div className="text-2xl font-semibold">1M+ small construction firms</div>
            <p>Micro businesses dominate the sector—but have no tailored tools.</p>
          </div>
          <div className="space-y-2 flex flex-col items-start">
            <MetricIcon type="stopwatch" />
            <div className="text-2xl font-semibold">60% lose time to admin weekly</div>
            <p>Time spent chasing info kills productivity.</p>
          </div>
          <div className="space-y-2 flex flex-col items-start">
            <MetricIcon type="spreadsheet" />
            <div className="text-2xl font-semibold">80% still use spreadsheets</div>
            <p>Most platforms are too complex or too generic.</p>
          </div>
        </div>
      </section>

      {/* What's next section */}
      <section className="max-w-6xl mx-auto px-4 py-24 grid grid-cols-1 md:grid-cols-5 gap-8 border-t border-gray-800">
        <h2 className="col-span-1 text-lg font-medium">What's next</h2>
        <div className="col-span-4 space-y-6 text-gray-300">
          <p>
            Constructa's first release will focus on quoting and planning—helping builders win more work and stay on track.
          </p>
          <p>
            From there, we'll expand into contracts, resource tracking, client comms, and beyond.
          </p>
          <p>
            If you're a small construction team who's ready to simplify how you work—we'd love you to be part of the journey.
          </p>
          <p className="font-medium">👉 Join our waitlist →  &nbsp; 👉 Follow us on LinkedIn & Medium</p>
        </div>
      </section>

      {/* News section */}
      <section className="bg-black text-white py-16 border-t border-gray-800">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-lg font-medium mb-2 border-b border-gray-700 pb-1 underline underline-offset-4">News</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-y-4 gap-x-6 text-sm text-gray-300 mt-6">
            <div>How Constructa helps you win more work</div>
            <div>Early insights from beta testers</div>
            <div>medium.com</div>

            <div>Behind the build: Constructa's approach</div>
            <div>From spreadsheets to smart tools</div>
            <div>linkedin.com</div>

            <div>Why quoting shouldn't take all day</div>
            <div>The hidden cost of poor planning</div>
            <div>constructa.co</div>

            <div>Placeholder</div>
            <div>More updates coming soon</div>
            <div>—</div>
          </div>
        </div>
      </section>
    </main>
  );
} 