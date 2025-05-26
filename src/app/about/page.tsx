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
        <section className="max-w-6xl mx-auto px-4 pt-32 pb-8 text-center">
          <h1 className="text-4xl md:text-5xl font-semibold mb-5">Why we built Constructa, and what comes next.</h1>
        </section>

{/* Hero Section */}
<section className="max-w-6xl mx-auto px-4 pt-32 pb-24 grid md:grid-cols-2 gap-12 items-center">
  <div>
    <img src="/images/about-hero.png" alt="About hero visual" className="w-full h-auto rounded-xl shadow-md" />
  </div>
  <div className="text-left">
    <h2 className="text-2xl md:text-3xl font-semibold mb-4">Built by people who know the job</h2>
    <p className="text-gray-300 text-lg mb-4">
      We've spent decades quoting jobs, planning programmes, and juggling the chaos of construction—clipboards, emails, spreadsheets, WhatsApp threads, last-minute changes.
    </p>
    <p className="text-gray-300 text-lg mb-4">
      Constructa was born out of that reality. Not from a VC boardroom or software incubator—but from site visits, delivery delays, tight margins, and the stress of getting it right.
    </p>
    <p className="text-gray-300 text-lg">
      We're not building another tool to add to the pile. We're building the one that ties everything together.
    </p>
  </div>
</section>

        {/* Section 1 */}
        <section className="max-w-6xl mx-auto px-4 py-24 grid md:grid-cols-2 gap-12 items-center">
          <div className="text-right">
            <h2 className="text-2xl md:text-3xl font-semibold mb-4">The problem we saw</h2>
            <p className="text-gray-300 text-lg mb-4">
              Running a small construction company means juggling everything—quoting fast, planning tight, and keeping things moving on site.
            </p>
            <ul className="list-disc list-inside text-gray-400 text-sm space-y-2">
              <li>Proposals get rushed</li>
              <li>Programmes get misaligned</li>
              <li>Project control slips</li>
              <li>And admin takes over</li>
            </ul>
            <p className="text-gray-300 text-lg mt-4">
              Big software platforms are overkill. Manual systems are high risk. And most tools weren't built for builders.
            </p>
          </div>
          <div>
            <img src="/images/about-problem.png" alt="Problem illustration" className="w-full h-auto rounded-xl shadow-md" />
          </div>
        </section>

        {/* Section 2 */}
        <section className="max-w-6xl mx-auto px-4 py-24 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <img src="/images/solution.png" alt="Solution illustration" className="w-full h-auto rounded-xl shadow-md" />
          </div>
          <div className="text-left">
            <h2 className="text-2xl md:text-3xl font-semibold mb-4">The solution we're building</h2>
            <p className="text-gray-300 text-lg mb-4">
              Constructa brings quoting, planning, and delivery into one clean, easy-to-use platform.
            </p>
            <ul className="list-disc list-inside text-gray-400 text-sm space-y-2">
              <li>Create a client-ready proposal in minutes</li>
              <li>Build a job plan that keeps everyone aligned</li>
              <li>Track progress and changes without the spreadsheet stress</li>
              <li>Win more work by looking more professional from day one</li>
            </ul>
            <p className="text-gray-300 text-lg mt-4">We're starting simple. And growing with our users—brick by brick.</p>
          </div>
        </section>

        {/* Section 3 */}
        <section className="max-w-6xl mx-auto px-4 py-24 grid md:grid-cols-2 gap-12 items-center">
          <div className="text-right">
            <h2 className="text-2xl md:text-3xl font-semibold mb-4">A message from the founder</h2>
            <p className="text-gray-300 text-lg italic mb-4">
              "After 25 years in construction, I knew there had to be a better way. I've seen first-hand how hard it is to manage projects and people while keeping proposals sharp, programmes aligned, and clients happy.
            </p>
            <p className="text-gray-300 text-lg italic mb-4">
              Constructa isn't just software—it's a response to everything I wish I'd had earlier in my career. We're building it with care, with clarity, and with builders front and centre."
            </p>
            <div className="not-italic font-semibold">— Robert Smith</div>
          </div>
          <div>
            <img src="/images/founder-message.png" alt="Founder message illustration" className="w-full h-auto rounded-xl shadow-md" />
          </div>
        </section>

        {/* Why now */}
        <section className="max-w-6xl mx-auto px-4 py-24">
          <h2 className="text-3xl font-semibold mb-10">Why now?</h2>
          <div className="grid md:grid-cols-3 gap-12 text-gray-300">
            <div className="text-left">
              <img src="/images/minimalist infographic cluster of small construction buildings.png" alt="Small firms" className="w-40 h-40 mx-auto mb-4" />
              <h3 className="text-2xl font-semibold mb-2">1M+ small construction firms</h3>
              <p>Micro businesses dominate the sector—but have no tailored tools.</p>
            </div>
            <div className="text-left">
              <img src="/images/stopwatch and swirling paperwork icons.png" alt="Stopwatch and paperwork" className="w-40 h-40 mx-auto mb-4" />
              <h3 className="text-2xl font-semibold mb-2">60% lose time to admin weekly</h3>
              <p>Time spent chasing info kills productivity.</p>
            </div>
            <div className="text-left">
              <img src="/images/spreadsheet grid and warning & error symbols.png" alt="Spreadsheet errors" className="w-40 h-40 mx-auto mb-4" />
              <h3 className="text-2xl font-semibold mb-2">80% still use spreadsheets</h3>
              <p>Most platforms are too complex or too generic.</p>
            </div>
          </div>
        </section>

        {/* What's next */}
        <section className="max-w-6xl mx-auto px-4 pt-24 py-24 grid md:grid-cols-2 gap-12 items-center">
          <div className="text-right">
            <h2 className="text-2xl md:text-3xl font-semibold mb-4">What's next</h2>
            <p className="text-gray-300 text-lg mb-4">
              Constructa's first release is now live—helping builders quote, plan, and deliver with confidence.
            </p>
            <p className="text-gray-300 text-lg mb-4">
              From here, we're expanding into contracts, resource tracking, client comms, and more.
            </p>
            <p className="text-gray-300 text-lg mb-4">
              If you're a small construction team ready to simplify how you work—give Constructa a try today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <a href="https://medium.com/" className="bg-white text-black px-4 py-2 rounded font-semibold text-base hover:opacity-90 transition">Follow us on Medium →</a>
              <a href="https://www.linkedin.com/company/constructa-co" className="bg-white text-black px-4 py-2 rounded font-semibold text-base hover:opacity-90 transition">Follow us on LinkedIn →</a>
            </div>
          </div>
          <div>
            <img src="/images/whats-next.png" alt="What's next illustration" className="w-full h-auto rounded-xl shadow-md" />
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
