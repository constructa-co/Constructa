export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-950 text-white px-6 py-16">
      <section className="max-w-3xl text-center">
        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight">
          Build Smarter with Constructa
        </h1>
        <p className="mt-4 text-xl sm:text-2xl font-medium text-gray-300">
          Constructa helps micro construction companies easily plan, cost, and manage projects.
        </p>
        <form
          action="https://formspree.io/f/{your-form-id}" // Replace with real Formspree ID
          method="POST"
          className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <input
            type="email"
            name="email"
            required
            placeholder="Enter your email"
            className="w-full sm:w-80 px-4 py-2 rounded bg-white text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            type="submit"
            className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded font-semibold transition"
          >
            Join Waitlist
          </button>
        </form>
        <p className="mt-3 text-sm text-gray-500">
          We’re launching soon — get notified first.
        </p>
      </section>

      <section className="mt-20 max-w-3xl text-center">
        <h2 className="text-3xl font-bold mb-4">Why Constructa?</h2>
        <ul className="space-y-3 text-left text-gray-300">
          <li>✅ Simplified estimating and planning</li>
          <li>✅ No more Excel chaos</li>
          <li>✅ Forecast costs in minutes</li>
          <li>✅ Professional proposals in one click</li>
          <li>✅ Works out of the box, no training needed</li>
        </ul>
      </section>

      <section className="mt-20 max-w-3xl text-center">
        <h2 className="text-3xl font-bold mb-4">How It Works</h2>
        <ol className="list-decimal list-inside text-left text-gray-300 space-y-2">
          <li>Create your project</li>
          <li>Set your budget and schedule</li>
          <li>Generate a professional proposal</li>
          <li>Deliver work with confidence</li>
        </ol>
      </section>

      <section className="mt-20 max-w-2xl text-center text-gray-400 text-sm italic">
        <p>
          “I’ve spent 20 years in construction and saw how smaller teams were underserved by complex software —
          so I’m building the tool I wish I’d had.”
        </p>
      </section>
    </main>
  );
}