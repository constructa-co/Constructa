import Image from "next/image";

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
      {/* Navbar */}
      <header className="w-full py-6 px-4 flex justify-between items-center border-b border-gray-800">
        <div className="text-xl font-semibold">CONSTRUCTA</div>
        <nav className="hidden md:flex space-x-6 text-sm">
          <a href="#" className="hover:underline">Product</a>
          <a href="#" className="hover:underline">Features</a>
          <a href="#" className="hover:underline">Pricing</a>
          <a href="#" className="hover:underline">Resources</a>
          <a href="#" className="hover:underline">About</a>
          <a href="#" className="hover:underline">Contact</a>
          <button className="border px-4 py-1 rounded hover:bg-white hover:text-black">Sign up</button>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="text-center py-20 px-4">
        <h1 className="text-4xl md:text-6xl font-bold mb-6">
          SaaS for the next generation of construction firms.
        </h1>
        <p className="text-lg md:text-xl max-w-2xl mx-auto">
          We help construction professionals plan, cost, and manage projects with ease.
        </p>
      </section>

      {/* Image 1 - Gantt Chart Placeholder */}
      <section className="flex justify-center py-10 px-4">
        <div className="w-full max-w-xs mx-auto">
          <Image
            src="/image1.png"
            alt="Gantt Chart"
            width={700}
            height={400}
            className="w-full h-auto rounded"
            priority
          />
        </div>
      </section>

      {/* Email Capture */}
      <section className="text-center py-16 px-4">
        <p className="text-lg md:text-xl mb-4">We’ll be launching soon. Stay in the loop.</p>
        <form className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <input
            type="email"
            placeholder="Enter your email"
            className="px-4 py-2 text-black rounded max-w-sm w-full sm:w-auto"
          />
          <button
            type="submit"
            className="bg-white text-black px-6 py-2 rounded sm:w-auto"
          >
            Submit
          </button>
        </form>
      </section>

      {/* Image 2 - Constructa Feature */}
      <section className="flex justify-center py-10 px-4">
        <div className="w-full max-w-xs mx-auto">
          <Image
            src="/image2.png"
            alt="Constructa Feature Visual"
            width={700}
            height={400}
            className="w-full h-auto rounded"
            priority
          />
        </div>
      </section>

      {/* Image 3 - Timeline Visual */}
      <section className="flex justify-center py-10 px-4">
        <div className="w-full max-w-xs mx-auto">
          <Image
            src="/image3.png"
            alt="Timeline Visual"
            width={700}
            height={400}
            className="w-full h-auto rounded"
            priority
          />
        </div>
      </section>

      <section className="py-20 px-4 border-t border-gray-800 text-center">
        <h2 className="text-3xl font-bold mb-6">Pricing</h2>
        <p className="max-w-xl mx-auto text-lg">
          We’ll be offering flexible plans with everything you need to quote, plan, and deliver jobs with confidence.
        </p>
        <p className="mt-2 text-sm text-gray-400">Early users get priority access and special launch pricing.</p>
      </section>
    </main>
  );
}