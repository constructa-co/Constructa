export default function AboutPage() {
  return (
    <main className="min-h-screen pt-16 bg-black">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-bold text-white mb-8">Built by people who know the job.</h1>
        
        <div className="prose prose-invert max-w-none">
          <p className="text-gray-400 mb-6">
            We've spent years in the construction industry—quoting jobs, planning programmes, and dealing with the same headaches you face every day.
          </p>
          
          <p className="text-gray-400 mb-6">
            Constructa was born out of that experience. It's designed for small construction teams who need simple, reliable tools to quote, plan, and manage work—without the bloat, the cost, or the complexity.
          </p>
          
          <p className="text-gray-400 mb-6">
            <span className="text-white font-medium">Our goal is simple:</span> To give small construction teams the tools they need to work smarter, win more jobs, and stay in control—without getting buried in admin.
          </p>
        </div>
      </div>
    </main>
  );
} 