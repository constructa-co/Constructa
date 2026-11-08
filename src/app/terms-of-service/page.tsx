import Link from "next/link";

// A023 — public platform terms page linked from the sign-up checkbox.
// PLACEHOLDER copy only until Rob approves final legal wording.

const PLACEHOLDER_NOTICE =
    "PLACEHOLDER — Platform terms wording below is draft scaffolding for engineering and UX only. " +
    "Rob must review and approve the legal text before this page is treated as authoritative or published to customers.";

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen pt-16 bg-black">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <p
          role="note"
          className="mb-8 rounded-lg border border-amber-500/60 bg-amber-950/40 px-4 py-3 text-sm text-amber-100"
        >
          <strong className="font-semibold">PLACEHOLDER:</strong> {PLACEHOLDER_NOTICE}
        </p>

        <h1 className="text-4xl font-bold text-white mb-2">Constructa platform terms of service</h1>
        <p className="text-sm text-amber-200/90 mb-8">
          Technical revision: platform-tos-2026-03 (PLACEHOLDER — for engineering consent records only; not a legal approval stamp).
        </p>

        <div className="prose prose-invert max-w-none space-y-6 text-gray-400">
          <section aria-labelledby="placeholder-scope">
            <h2 id="placeholder-scope" className="text-xl font-semibold text-white">
              [PLACEHOLDER] Scope of the service
            </h2>
            <p>
              Constructa provides software to help UK construction contractors plan work, build estimates and proposals, and manage project information.
              [PLACEHOLDER — Rob to replace with counsel-approved scope and eligibility language.]
            </p>
          </section>

          <section aria-labelledby="placeholder-accounts">
            <h2 id="placeholder-accounts" className="text-xl font-semibold text-white">
              [PLACEHOLDER] Accounts and acceptable use
            </h2>
            <p>
              You are responsible for activity on your account and for keeping credentials secure.
              [PLACEHOLDER — Rob to add acceptable-use, suspension, and data-handling terms.]
            </p>
          </section>

          <section aria-labelledby="placeholder-updates">
            <h2 id="placeholder-updates" className="text-xl font-semibold text-white">
              [PLACEHOLDER] Changes to these terms
            </h2>
            <p>
              We may update these terms from time to time. When we do, we will describe how acceptance of a new revision is collected.
              [PLACEHOLDER — Rob to define notice and re-acceptance mechanics.]
            </p>
          </section>

          <section aria-labelledby="placeholder-contact">
            <h2 id="placeholder-contact" className="text-xl font-semibold text-white">
              [PLACEHOLDER] Contact
            </h2>
            <p>
              Questions about these terms:{" "}
              <a
                href="mailto:hello@constructa.co"
                className="text-gray-300 hover:text-white transition-colors duration-200"
              >
                hello@constructa.co
              </a>
              . Prose last visible update: March 2026 (PLACEHOLDER date label).
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
