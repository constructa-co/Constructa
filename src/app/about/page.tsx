import React from 'react';
import Head from 'next/head';

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
    <>
      <Head>
        <meta name="description" content="Learn how Constructa was built for builders. Discover our mission to simplify quoting, planning, and project delivery for small construction teams." />
        <link rel="canonical" href="https://constructa.co/about" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: `{
  "@context": "https://schema.org",
  "@type": "AboutPage",
  "name": "About Constructa",
  "url": "https://constructa.co/about",
  "description": "Constructa was created to help small construction teams quote faster, plan better, and deliver jobs with confidence. Built by people who know the industry.",
  "publisher": {
    "@type": "Organization",
    "name": "Constructa",
    "url": "https://constructa.co"
  }
}` }} />
      </Head>
      <main className="bg-black text-white">
        {/* Section 1 */}
        <section className="max-w-6xl mx-auto px-4 pt-56 pb-24 grid grid-cols-1 md:grid-cols-[1fr_2.5fr] gap-16">
          <h1 className="col-span-1 text-2xl md:text-3xl font-semibold text-left">Built by people who know the job</h1>
          <div className="col-span-1 space-y-6 text-gray-300 text-left">
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
        <section className="max-w-6xl mx-auto px-4 py-24 grid grid-cols-1 md:grid-cols-[1fr_2.5fr] gap-16">
          <h2 className="col-span-1 text-2xl md:text-3xl font-semibold text-left">The problem we saw</h2>
          <div className="col-span-1 space-y-6 text-gray-300 text-left">
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
        <section className="max-w-6xl mx-auto px-4 py-24 grid grid-cols-1 md:grid-cols-[1fr_2.5fr] gap-16">
          <h2 className="col-span-1 text-2xl md:text-3xl font-semibold text-left">The solution we're building</h2>
          <div className="col-span-1 space-y-6 text-gray-300 text-left">
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

        {/* Section 4: Founder message */}
        <section className="max-w-6xl mx-auto px-4 py-24 grid grid-cols-1 md:grid-cols-[1fr_2.5fr] gap-16">
          <h2 className="col-span-1 text-2xl md:text-3xl font-semibold text-left">A message from the founder</h2>
          <div className="col-span-1 space-y-6 text-gray-300 italic text-left">
            <p>
              "After 25 years in construction, I knew there had to be a better way. I've seen first-hand how
              hard it is to manage projects and people while keeping proposals sharp, programmes aligned,
              and clients happy.
            </p>
            <p>
              Constructa isn't just software—it's a response to everything I wish I'd had earlier in my career.
              We're building it with care, with clarity, and with builders front and centre."
            </p>
            <div className="not-italic font-semibold pt-2">— Robert Smith</div>
          </div>
        </section>

        {/* Why now? Section with icons */}
        <section className="max-w-6xl mx-auto px-4 py-24">
          <div className="text-2xl md:text-3xl font-semibold mb-8 text-left">Why now?</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-gray-300">
            <div className="space-y-2 flex flex-col items-start">
              <img src="/images/minimalist infographic cluster of small construction buildings.png" alt="Infographic showing cluster of small construction buildings" className="w-40 h-40 md:w-64 md:h-64 mb-4 object-contain mx-auto" />
              <div className="text-2xl font-semibold">1M+ small construction firms</div>
              <p>Micro businesses dominate the sector—but have no tailored tools.</p>
            </div>
            <div className="space-y-2 flex flex-col items-start">
              <img src="/images/stopwatch and swirling paperwork icons.png" alt="Stopwatch with swirling paperwork icons" className="w-40 h-40 md:w-64 md:h-64 mb-4 object-contain mx-auto" />
              <div className="text-2xl font-semibold">60% lose time to admin weekly</div>
              <p>Time spent chasing info kills productivity.</p>
            </div>
            <div className="space-y-2 flex flex-col items-start">
              <img src="/images/spreadsheet grid and warning & error symbols.png" alt="Spreadsheet grid with warning and error symbols" className="w-40 h-40 md:w-64 md:h-64 mb-4 object-contain mx-auto" />
              <div className="text-2xl font-semibold">80% still use spreadsheets</div>
              <p>Most platforms are too complex or too generic.</p>
            </div>
          </div>
        </section>

        {/* What's next section */}
        <section className="max-w-6xl mx-auto px-4 py-24 grid grid-cols-1 md:grid-cols-[1fr_2.5fr] gap-16">
          <h2 className="col-span-1 text-2xl md:text-3xl font-semibold text-left">What's next</h2>
          <div className="col-span-1 space-y-6 text-gray-300 text-left">
            <p>
              Constructa's first release is now live—helping builders quote, plan, and deliver with confidence.
            </p>
            <p>
              From here, we're expanding into contracts, resource tracking, client comms, and more.
            </p>
            <p>
              If you're a small construction team ready to simplify how you work—give Constructa a try today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <a href="https://medium.com/" className="bg-white text-black px-4 py-2 rounded font-semibold text-base hover:opacity-90 transition">Follow us on Medium →</a>
              <a href="https://www.linkedin.com/company/constructa-co" className="bg-white text-black px-4 py-2 rounded font-semibold text-base hover:opacity-90 transition">Follow us on LinkedIn →</a>
            </div>
          </div>
        </section>

        {/* News section */}
        <section className="bg-black text-white py-16 border-t border-gray-700">
          <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-xl font-bold mb-6 text-left">News</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-y-4 gap-x-6 text-sm text-gray-300 mt-2">
              <div className="text-left font-medium">How Constructa helps you win more work</div>
              <div className="text-left">How to stand out and win jobs in a crowded market</div>
              <div className="text-left text-blue-400 underline"><a href="https://medium.com/">medium.com</a></div>

              <div className="text-left font-medium">Behind the build: Constructa's approach</div>
              <div className="text-left">From spreadsheets to smart tools</div>
              <div className="text-left text-blue-400 underline"><a href="https://linkedin.com/">linkedin.com</a></div>

              <div className="text-left font-medium">Why quoting shouldn't take all day</div>
              <div className="text-left">The hidden cost of poor planning</div>
              <div className="text-left text-blue-400 underline"><a href="https://constructa.co/">constructa.co</a></div>

              <div className="text-left font-medium">Placeholder</div>
              <div className="text-left">More updates coming soon</div>
              <div className="text-left">—</div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
} 