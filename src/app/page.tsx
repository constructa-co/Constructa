export default function Home() {
  return (
    <main className="bg-black text-white min-h-screen font-sans">
      {/* Header */}
      <header className="sticky top-0 bg-black border-b border-neutral-800 z-50 px-6 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Constructa</h1>
        <nav className="space-x-6 text-sm text-gray-300">
          <a href="#product" className="hover:text-white">Product</a>
          <a href="#features" className="hover:text-white">Features</a>
          <a href="#pricing" className="hover:text-white">Pricing</a>
          <a href="#customers" className="hover:text-white">Customers</a>
          <a href="#resources" className="hover:text-white">Resources</a>
          <a href="#about" className="hover:text-white">About</a>
          <a href="#contact" className="hover:text-white">Contact</a>
        </nav>
      </header>

      {/* Hero */}
      <section className="px-6 py-24 text-center max-w-3xl mx-auto">
        <h2 className="text-5xl font-extrabold mb-6">Simplifying construction planning & pricing</h2>
        <p className="text-lg text-gray-400 mb-8">
          Constructa is a SaaS platform designed for micro and small construction companies.
          We help you streamline proposals, forecast costs, and manage risk with confidence.
        </p>
        <form
          action="https://formspree.io/f/{your-form-id}"
          method="POST"
          className="flex flex-col sm:flex-row gap-3 justify-center"
        >
          <input
            type="email"
            name="email"
            required
            placeholder="Enter your email"
            className="px-4 py-2 w-full sm:w-80 text-black rounded"
          />
          <button
            type="submit"
            className="bg-white text-black px-6 py-2 rounded font-semibold hover:bg-gray-200 transition"
          >
            Keep Me Updated
          </button>
        </form>
        <p className="text-sm text-gray-500 mt-4">We’re building something for you — join the early list.</p>
      </section>

      {/* Product Section */}
      <section id="product" className="px-6 py-20 max-w-4xl mx-auto text-center">
        <h3 className="text-3xl font-bold mb-6">Built for builders, not spreadsheets</h3>
        <p className="text-gray-400">
          Constructa replaces messy spreadsheets and confusing templates with a clean, intuitive platform
          that lets you focus on delivering work — not drowning in admin. Create accurate proposals, track
          your costs, and stay on schedule without the overhead.
        </p>
      </section>

      {/* Features Section */}
      <section id="features" className="px-6 py-20 bg-neutral-900">
        <div className="max-w-5xl mx-auto text-center">
          <h3 className="text-3xl font-bold mb-12">What You Can Do With Constructa</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-10 text-left">
            <div>
              <h4 className="text-xl font-semibold mb-2">Estimate with accuracy</h4>
              <p className="text-gray-400">Quickly build detailed cost forecasts and avoid underpricing your work.</p>
            </div>
            <div>
              <h4 className="text-xl font-semibold mb-2">Plan & schedule with ease</h4>
              <p className="text-gray-400">Visualise timelines with clarity using intuitive Gantt-style tools.</p>
            </div>
            <div>
              <h4 className="text-xl font-semibold mb-2">Generate professional proposals</h4>
              <p className="text-gray-400">Export clean, client-ready documentation that wins trust and work.</p>
            </div>
            <div>
              <h4 className="text-xl font-semibold mb-2">Track costs & reduce risk</h4>
              <p className="text-gray-400">Keep tabs on spending and avoid surprises with built-in reconciliation tools.</p>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="px-6 py-20 max-w-3xl mx-auto text-center">
        <h3 className="text-3xl font-bold mb-6">Why We're Building Constructa</h3>
        <p className="text-gray-400 italic">
          “After 20 years in construction, I saw how underserved small teams are when it comes to modern tools.
          Constructa is the platform I wish I’d had — to price confidently, plan clearly, and spend less time in spreadsheets.”
        </p>
      </section>

      {/* Pricing Preview */}
      <section id="pricing" className="px-6 py-20 bg-neutral-900 text-center">
        <h3 className="text-3xl font-bold mb-6">Simple, Transparent Pricing</h3>
        <p className="text-gray-400 mb-4">No hidden fees. Cancel anytime. Pricing plans to suit solo builders and growing teams.</p>
        <p className="text-white text-xl font-semibold">Coming Soon</p>
      </section>

      {/* Footer */}
      <footer className="px-6 py-10 border-t border-neutral-800 text-sm text-gray-500 text-center">
        <p>&copy; 2025 Constructa. All rights reserved.</p>
      </footer>
    </main>
  );
}
