import { marketingPageMetadata } from "@/lib/marketing-seo";
import {
  APPLICATION_DATA_HANDLING,
  CONSTRUCTA_CONTACT_EMAIL,
  DATA_CONTROLLER_LEGAL_BASIS,
  DATA_PROCESSORS_LIST,
  DATA_RETENTION,
  DATA_RIGHTS_EXTRA,
  LEGAL_ENTITY_NAME,
  POLICY_CHANGE_PROCESS,
} from "@/lib/marketing/legal-entity-draft";

export const metadata = marketingPageMetadata({
  title: "Privacy Policy | Constructa",
  description:
    "How Constructa handles personal and company information. Draft notice — not presented as compliance certification.",
  pathname: "/privacy-policy",
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

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen pt-16 bg-black">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-bold text-white mb-8">Privacy Policy</h1>

        <div
          role="note"
          aria-labelledby="privacy-draft-status"
          className="mb-8 rounded-lg border border-amber-500/40 bg-amber-950/30 px-4 py-5"
          data-privacy-draft-notice
        >
          <h2 id="privacy-draft-status" className="text-xl font-semibold text-amber-200 mb-3">
            Draft, not yet legally approved
          </h2>
          <p className="text-sm text-amber-100/90">
            This label is not legal approval of this notice. This page is not a marketing publication
            and is not presented as compliance certification. The planned inbox hello@constructa.co is not set up yet. Bracketed facts must be confirmed
            before this draft is relied on or published as final.
          </p>
        </div>

        <div className="prose prose-invert max-w-none space-y-8 text-gray-400">
          <section aria-labelledby="privacy-controller">
            <h2 id="privacy-controller" className="text-xl font-semibold text-white">
              Who is responsible for your information
            </h2>
            <p data-privacy-controller>
              {LEGAL_ENTITY_NAME} is the trading name used for this service. No company is incorporated yet.
              The responsible operator details must be confirmed before publication. You can contact us about your information at <MailLink />.
            </p>
          </section>

          <section aria-labelledby="privacy-hold">
            <h2 id="privacy-hold" className="text-xl font-semibold text-white">
              What we hold
            </h2>
            <ul className="list-disc pl-6 space-y-3">
              <li>
                Information you give us directly: your name, email address and company details when
                you contact us or join the updates list.
              </li>
              <li>
                Updates list: If you submit the updates form on this site, your email address is sent to Kit
                (ConvertKit), the email provider that runs that list.
              </li>
              <li data-privacy-apply-handling>
                Application interest: if you use the founding-cohort application page,{" "}
                {APPLICATION_DATA_HANDLING}
              </li>
              <li data-privacy-analytics-note>
                Analytics: This site can include Vercel Web Analytics. When it is on, it counts
                visits to public pages for signed-out visitors. Constructa removes query strings from
                page addresses before page views are sent. It does not collect your name, email or
                project details.
              </li>
              <li>
                We do not ask you to create an account in the phase-one preview, and this policy does
                not describe account data beyond what is listed here.
              </li>
            </ul>
          </section>

          <section aria-labelledby="privacy-use">
            <h2 id="privacy-use" className="text-xl font-semibold text-white">
              How we use it
            </h2>
            <p data-privacy-legal-basis>{DATA_CONTROLLER_LEGAL_BASIS}</p>
          </section>

          <section aria-labelledby="privacy-share">
            <h2 id="privacy-share" className="text-xl font-semibold text-white">
              Who it is shared with
            </h2>
            <p data-privacy-processors>{DATA_PROCESSORS_LIST}</p>
          </section>

          <section aria-labelledby="privacy-retention">
            <h2 id="privacy-retention" className="text-xl font-semibold text-white">
              Where it is stored and how long we keep it
            </h2>
            <p data-privacy-retention>{DATA_RETENTION}</p>
          </section>

          <section aria-labelledby="privacy-choices">
            <h2 id="privacy-choices" className="text-xl font-semibold text-white">
              Your choices
            </h2>
            <p>
              You can contact us at <MailLink /> to request access to, correction of, or deletion of
              your information, or to ask how personal, company, tax, pricing or salary information is
              handled. {DATA_RIGHTS_EXTRA}
            </p>
          </section>

          <section aria-labelledby="privacy-changes">
            <h2 id="privacy-changes" className="text-xl font-semibold text-white">
              Changes to this policy
            </h2>
            <p data-privacy-change-process>{POLICY_CHANGE_PROCESS}</p>
          </section>

        </div>

        <p className="text-sm text-gray-500 mt-8">
          This policy may be updated from time to time. Previous version dated March 2026.
        </p>
      </div>
    </main>
  );
}