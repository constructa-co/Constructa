import Link from "next/link";
import { marketingPageMetadata } from "@/lib/marketing-seo";
import {
  CONSTRUCTA_CONTACT_EMAIL,
  GOVERNING_LAW_JURISDICTION,
  LEGAL_ENTITY_NAME,
  LIABILITY_POSITION,
  SERVICE_AVAILABILITY_POSITION,
} from "@/lib/marketing/legal-entity-draft";

export const metadata = marketingPageMetadata({
  title: "Terms of Service | Constructa",
  description:
    "Platform terms for using Constructa to plan work, build estimates and proposals, and manage project information.",
  pathname: "/terms-of-service",
});

function MailLink() {
  return (
    <a
      href={`mailto:${CONSTRUCTA_CONTACT_EMAIL}`}
      className="text-gray-300 underline underline-offset-4 hover:text-white transition-colors duration-200"
    >
      {CONSTRUCTA_CONTACT_EMAIL}
    </a>
  );
}

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen pt-16 bg-black">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-bold text-white mb-8">Constructa platform terms of service</h1>

        <div
          role="note"
          aria-labelledby="terms-draft-status"
          className="mb-8 rounded-lg border border-amber-500/40 bg-amber-950/30 px-4 py-5"
          data-terms-draft-notice
        >
          <h2 id="terms-draft-status" className="text-xl font-semibold text-amber-200 mb-3">
            Draft, not yet legally approved
          </h2>
          <p className="text-sm text-amber-100/90">
            Expanded UK SaaS structure for review. Bracketed facts require confirmation before these
            terms are relied on or published as final. This is not legal advice.
          </p>
        </div>

        <div className="prose prose-invert max-w-none space-y-6 text-gray-400">
          <section aria-labelledby="terms-service-provider">
            <h2 id="terms-service-provider" className="text-xl font-semibold text-white">
              The service
            </h2>
            <p data-terms-entity>
              {LEGAL_ENTITY_NAME} is the trading name used for this service. No company is incorporated yet.
              The responsible operator and contracting-party details must be confirmed before publication. Questions about these terms: <MailLink />.
            </p>
          </section>

          <section aria-labelledby="terms-scope">
            <h2 id="terms-scope" className="text-xl font-semibold text-white">
              Using Constructa
            </h2>
            <p>
              Constructa helps UK construction contractors plan work, build estimates and proposals,
              and manage project information. You decide what goes into the documents you share with
              clients. The terms you agree with a client govern that work.
            </p>
          </section>

          <section aria-labelledby="terms-accounts">
            <h2 id="terms-accounts" className="text-xl font-semibold text-white">
              Your account and acceptable use
            </h2>
            <p>
              Keep your sign-in details secure. Use the service lawfully, respect other people&apos;s
              rights, and do not attempt to bypass its security or upload unlawful content.
            </p>
          </section>

          <section aria-labelledby="terms-data">
            <h2 id="terms-data" className="text-xl font-semibold text-white">
              Your project information
            </h2>
            <p>
              Only enter information you have the right to use. Check estimates, programmes and
              proposals before relying on them or sharing them. Where an AI-assisted feature is
              available, check its suggestions before using them.
            </p>
          </section>

          <section aria-labelledby="terms-availability">
            <h2 id="terms-availability" className="text-xl font-semibold text-white">
              Availability of the service
            </h2>
            <p data-terms-availability>{SERVICE_AVAILABILITY_POSITION}</p>
          </section>

          <section aria-labelledby="terms-liability">
            <h2 id="terms-liability" className="text-xl font-semibold text-white">
              Liability
            </h2>
            <p data-terms-liability>{LIABILITY_POSITION}</p>
          </section>

          <section aria-labelledby="terms-law">
            <h2 id="terms-law" className="text-xl font-semibold text-white">
              Governing law
            </h2>
            <p data-terms-governing-law>{GOVERNING_LAW_JURISDICTION}</p>
          </section>

          <section aria-labelledby="terms-updates">
            <h2 id="terms-updates" className="text-xl font-semibold text-white">
              Changes to these terms
            </h2>
            <p>
              When the terms change, we will explain what changed and whether you need to accept the
              new version.
            </p>
          </section>

          <section aria-labelledby="terms-contact">
            <h2 id="terms-contact" className="text-xl font-semibold text-white">
              Contact
            </h2>
            <p>
              Send questions about the terms to <MailLink />.

            </p>
          </section>
        </div>

        <p className="mt-10 text-sm text-gray-400">
          <Link href="/login" className="text-gray-300 underline underline-offset-4 hover:text-white transition-colors duration-200">
            ← Back to sign in / sign up
          </Link>
        </p>
      </div>
    </main>
  );
}