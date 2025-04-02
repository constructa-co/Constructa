export default function Home() {
  return (
    <>
      <header className="w-full py-4 px-6 fixed top-0 left-0 bg-black bg-opacity-90 z-50 flex justify-between items-center border-b border-gray-800">
        <div className="text-white font-bold text-xl tracking-widest">CONSTRUCTA</div>
        <nav className="hidden md:flex space-x-6 text-white text-sm">
          <a href="#product" className="hover:underline">Product</a>
          <a href="#features" className="hover:underline">Features</a>
          <a href="#pricing" className="hover:underline">Pricing</a>
          <a href="#resources" className="hover:underline">Resources</a>
          <a href="#about" className="hover:underline">About</a>
          <a href="#contact" className="hover:underline">Contact</a>
          <button className="ml-4 px-4 py-1 border rounded text-white border-white hover:bg-white hover:text-black transition">Sign up</button>
        </nav>
      </header>
      <main className="flex min-h-screen flex-col items-center justify-between px-4 pt-36 pb-10">
        {/* Hero Section */}
        <section className="max-w-4xl w-full text-center">
          <h1 className="text-5xl font-extrabold tracking-tight leading-tight mb-6">
            Simple software for builders who don&apos;t do admin.
          </h1>

          <p className="text-xl text-muted-foreground mb-8">
            Constructa helps micro construction companies estimate, plan, and manage projects — without spreadsheets, stress, or expensive software.
          </p>
          <form className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-md mx-auto">
            <input
              type="email"
              placeholder="Your email"
              className="px-4 py-2 border rounded-md text-black w-full sm:w-auto"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 transition"
            >
              Keep me posted
            </button>
          </form>
          <p className="text-sm text-muted-foreground mt-4">
            Launching in 2025 — be the first to know.
          </p>
        </section>

        {/* Features Section */}
        <section className="max-w-5xl w-full mt-24 text-center">
          <h2 className="text-4xl font-bold mb-10">No more Excel chaos</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
            <div>
              <h3 className="text-xl font-semibold mb-2">Forecast costs in minutes</h3>
              <p className="text-muted-foreground">
                Accurate, professional estimates without the spreadsheet headaches.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">One-click proposals</h3>
              <p className="text-muted-foreground">
                Turn your estimate into a polished proposal you&apos;ll be proud to send.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Out of the box</h3>
              <p className="text-muted-foreground">
                No training or setup. Just log in and build better.
              </p>
            </div>
          </div>
          <div className="w-full max-w-md mx-auto mt-24">
            <img
              src="/constructa-visual-1.png"
              alt="Constructa scheduling and Gantt chart interface"
              className="w-[150%] h-auto rounded-md shadow-md"
            />
          </div>
        </section>

        {/* About Section */}
        <div className="w-full max-w-md mx-auto mt-24 mb-12">
          <img
            src="/constructa-visual-2.png"
            alt="Constructa interface concept visual"
            className="w-[150%] h-auto rounded-md shadow-sm"
          />
        </div>
        <section className="max-w-3xl w-full mt-24 text-center">
          <h3 className="text-3xl font-bold mb-6">Why We&apos;re Building Constructa</h3>
          <p className="text-muted-foreground">
            I&apos;ve spent 20 years in construction and saw how smaller teams were underserved by clunky, overbuilt tools. So we&apos;re building the tool I wish I&apos;d had — one that helps great builders run great businesses.
          </p>
        </section>

        {/* Pricing Preview */}
        <div className="w-full max-w-md mx-auto mt-24 mb-12">
          <img
            src="/constructa-visual-3.png"
            alt="Constructa pricing feature preview"
            className="w-[150%] h-auto rounded-md shadow-sm"
          />
        </div>
        <section className="max-w-4xl w-full mt-24 text-center">
          <h3 className="text-3xl font-bold mb-4">Pricing made simple</h3>
          <p className="text-muted-foreground mb-6">
            Transparent, affordable pricing — with no hidden fees. Just pick the plan that works for your team.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border p-6 rounded-xl">
              <h4 className="text-xl font-semibold mb-2">Starter</h4>
              <p className="mb-4">£19/month</p>
              <ul className="text-muted-foreground text-sm space-y-1">
                <li>✓ Estimates & proposals</li>
                <li>✓ 1 user</li>
                <li>✓ Unlimited projects</li>
              </ul>
            </div>
            <div className="border p-6 rounded-xl">
              <h4 className="text-xl font-semibold mb-2">Pro</h4>
              <p className="mb-4">£49/month</p>
              <ul className="text-muted-foreground text-sm space-y-1">
                <li>✓ Everything in Starter</li>
                <li>✓ Schedule planning</li>
                <li>✓ Contract tools</li>
                <li>✓ Cost tracking</li>
              </ul>
            </div>
            <div className="border p-6 rounded-xl">
              <h4 className="text-xl font-semibold mb-2">Team</h4>
              <p className="mb-4">£99/month</p>
              <ul className="text-muted-foreground text-sm space-y-1">
                <li>✓ Everything in Pro</li>
                <li>✓ 5 users</li>
                <li>✓ Customer support</li>
                <li>✓ Future integrations</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-32 text-center text-sm text-muted-foreground">
          &copy; 2025 Constructa. All rights reserved.
        </footer>
      </main>
    </>
  );
}
