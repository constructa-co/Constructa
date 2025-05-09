export default function ProductPage() {
  return (
    <main className="min-h-screen pt-16 bg-black">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-bold text-white mb-8">What is Constructa?</h1>
        
        <div className="prose prose-invert max-w-none">
          <p className="text-lg text-gray-400 mb-12">
            Constructa is a simple, smart software platform that helps small construction companies quote faster, plan smarter, and stay in control of every job.
          </p>

          <div className="space-y-12 mt-12">
            <div className="not-prose">
              <h2 className="text-2xl font-semibold text-white mb-4">Quote it</h2>
              <p className="text-gray-400">
                Create professional proposals in minutes with pricing, terms, and job details built in.
              </p>
            </div>
            
            <div className="not-prose">
              <h2 className="text-2xl font-semibold text-white mb-4">Plan it</h2>
              <p className="text-gray-400">
                Set timelines, phases, and milestones for each job. Keep your team and clients aligned.
              </p>
            </div>
            
            <div className="not-prose">
              <h2 className="text-2xl font-semibold text-white mb-4">Deliver it</h2>
              <p className="text-gray-400">
                Track progress, update plans, and manage change—all without spreadsheet chaos.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
} 