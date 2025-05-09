export default function FeaturesPage() {
  return (
    <main className="min-h-screen pt-16 bg-black">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-bold text-white mb-12">Features built for small construction teams</h1>
        
        <div className="prose prose-invert max-w-none">
          <ul className="space-y-12">
            <li className="not-prose">
              <h2 className="text-2xl font-semibold text-white mb-4">Proposal Builder</h2>
              <p className="text-gray-400">
                Quote quickly with pre-formatted templates, clear pricing, and editable terms. Add your capability statement and job details with ease.
              </p>
            </li>
            
            <li className="not-prose">
              <h2 className="text-2xl font-semibold text-white mb-4">Project Planning</h2>
              <p className="text-gray-400">
                Map out your job timeline with phases, milestones, and key dates—no spreadsheets required.
              </p>
            </li>
            
            <li className="not-prose">
              <h2 className="text-2xl font-semibold text-white mb-4">Programme at a Glance</h2>
              <p className="text-gray-400">
                See progress across all live jobs at a glance. Key updates, alerts, and schedule insights in one place.
              </p>
            </li>
            
            <li className="not-prose">
              <h2 className="text-2xl font-semibold text-white mb-4">One-Tap Updates</h2>
              <p className="text-gray-400">
                Quickly mark tasks, phases, or projects as updated. Keep crews aligned without chasing messages.
              </p>
            </li>
            
            <li className="not-prose">
              <h2 className="text-2xl font-semibold text-white mb-4">Client-Ready Outputs</h2>
              <p className="text-gray-400">
                Generate polished quotes and timelines your clients can trust—without wasting hours formatting.
              </p>
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
} 