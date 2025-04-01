export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-950 text-white px-4 py-16">
      <div className="max-w-2xl text-center">
        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight">
          Constructa
        </h1>
        <p className="mt-4 text-xl sm:text-2xl font-medium text-gray-300">
          Simplify construction project planning for micro contractors.
        </p>
        <p className="mt-6 text-gray-400">
          Build proposals, manage costs, and schedule jobs — all in one
          place. Designed for the builders, not the bureaucrats.
        </p>

        <form
          action="https://formspree.io/f/{your-form-id}" // replace with your Formspree ID
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

        <p className="mt-4 text-sm text-gray-500">
          No spam. Just updates when we launch.
        </p>
      </div>
    </main>
  );
}