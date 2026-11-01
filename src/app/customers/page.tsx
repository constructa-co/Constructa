import { getLaunchProfile } from "@/lib/launch-profile";

function CtaArrow() {
  return (
    <svg className="ml-2 w-4 h-4" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M6.5 3.5L11 8L6.5 12.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const introCopy = (
  <>
    <p className="text-lg text-gray-400 mb-6">
      Constructa is built specifically for small and micro construction businesses who quote, plan, and deliver work
      themselves.
    </p>

    <p className="text-lg text-gray-400 mb-6">
      Whether you&apos;re pricing jobs on evenings and weekends, or juggling multiple projects as a small team—we&apos;re
      building Constructa to make it easier.
    </p>

    <p className="text-lg text-gray-400 mb-6">
      You don&apos;t need a dedicated planner or expensive software to stay in control. You just need tools that fit the
      way you work.
    </p>
  </>
);

function FullCustomersPage() {
  return (
    <main className="min-h-screen pt-16 bg-black">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-bold text-white mb-8">Built for builders—not admins</h1>

        <div className="prose prose-invert max-w-none">
          {introCopy}

          <div className="mt-12">
            <p className="text-lg font-semibold text-white mb-4">Early users will help shape the platform. Want in?</p>
            <div className="flex items-center gap-4">
              <a
                href="/contact"
                className="inline-flex items-center px-6 py-1.5 rounded-lg bg-white text-black text-sm font-medium hover:bg-gray-100 transition-colors duration-200"
              >
                Get in touch
                <CtaArrow />
              </a>
              <span className="text-gray-400">or</span>
              <a
                href="/"
                className="inline-flex items-center px-6 py-1.5 rounded-lg bg-white text-black text-sm font-medium hover:bg-gray-100 transition-colors duration-200"
              >
                Join the waitlist
                <CtaArrow />
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function CohortCustomersPage() {
  return (
    <main className="min-h-screen pt-16 bg-black">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-bold text-white mb-8">Built for builders—not admins</h1>

        <div className="prose prose-invert max-w-none">
          {introCopy}

          <div className="mt-12">
            <p className="text-lg text-gray-300 mb-4">
              Constructa is in a phase-one review. We are checking the complete work-winning journey before
              release—it is not currently offered for live customer work.
            </p>
            <p className="text-lg text-gray-300 mb-6">
              Preview access explains what is in scope for this review and what still needs release verification before
              live use.
            </p>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <a
                href="/contact"
                className="inline-flex items-center px-6 py-1.5 rounded-lg bg-white text-black text-sm font-medium hover:bg-gray-100 transition-colors duration-200"
              >
                Get in touch
                <CtaArrow />
              </a>
              <a
                href="/pricing"
                className="inline-flex items-center px-6 py-1.5 rounded-lg bg-white text-black text-sm font-medium hover:bg-gray-100 transition-colors duration-200"
              >
                Preview access
                <CtaArrow />
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function CustomersPage() {
  return getLaunchProfile() === "full" ? <FullCustomersPage /> : <CohortCustomersPage />;
}
