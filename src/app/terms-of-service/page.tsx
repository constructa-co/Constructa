import Link from "next/link";

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen pt-16 bg-black">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-bold text-white mb-8">Constructa platform terms of service</h1>

        <div className="prose prose-invert max-w-none space-y-6 text-gray-400">
          <section aria-labelledby="terms-scope">
            <h2 id="terms-scope" className="text-xl font-semibold text-white">Using Constructa</h2>
            <p>
              Constructa helps UK construction contractors plan work, build estimates and proposals,
              and manage project information. You decide what goes into the documents you share with
              clients. The terms you agree with a client govern that work.
            </p>
          </section>

          <section aria-labelledby="terms-accounts">
            <h2 id="terms-accounts" className="text-xl font-semibold text-white">Your account and acceptable use</h2>
            <p>
              Keep your sign-in details secure. Use the service lawfully, respect other people&apos;s
              rights, and do not attempt to bypass its security or upload unlawful content.
            </p>
          </section>

          <section aria-labelledby="terms-data">
            <h2 id="terms-data" className="text-xl font-semibold text-white">Your project information</h2>
            <p>
              Only enter information you have the right to use. Check estimates, programmes and
              proposals before relying on them or sharing them. Where an AI-assisted feature is
              available, check its suggestions before using them.
            </p>
          </section>

          <section aria-labelledby="terms-updates">
            <h2 id="terms-updates" className="text-xl font-semibold text-white">Changes to these terms</h2>
            <p>
              When the terms change, we will explain what changed and whether you need to
              accept the new version.
            </p>
          </section>

          <section aria-labelledby="terms-contact">
            <h2 id="terms-contact" className="text-xl font-semibold text-white">Contact</h2>
            <p>
              Send questions about the terms to{" "}
              <a href="mailto:hello@constructa.co" className="text-gray-300 hover:text-white transition-colors duration-200">
                hello@constructa.co
              </a>.
            </p>
          </section>
        </div>

        <p className="mt-10 text-sm text-gray-500">
          <Link href="/login" className="text-gray-300 hover:text-white transition-colors duration-200">
            ← Back to sign in / sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
