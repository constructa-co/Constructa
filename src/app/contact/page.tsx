import type { Metadata } from "next";
import { PhaseOneContact } from "@/components/marketing/cohort-contact";
import { ContactMarketingForm } from "@/components/marketing/contact-marketing-form";
import { PublicFormCollectionNotice } from "@/components/marketing/public-form-collection-notice";
import { PUBLIC_FORM_COLLECTION_NOTICE_ID_CONTACT } from "@/components/marketing/public-form-collection-notice-ids";
import { getLaunchProfile } from "@/lib/launch-profile";
import { isPublicContactFormCollectionReady } from "@/lib/marketing/public-form-collection";

import { marketingPageMetadata } from "@/lib/marketing-seo";

export const metadata: Metadata = marketingPageMetadata({
  title: "Contact | Constructa",
  description: "Contact the Constructa team.",
  pathname: "/contact",
});

export default function ContactPage() {
  if (getLaunchProfile() !== "full") return <PhaseOneContact />;

  const collectionReady = isPublicContactFormCollectionReady();

  return (
    <main className="min-h-screen pt-16 bg-black">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-bold text-white mb-8">Got a question? Want to stay in the loop?</h1>

        <div className="prose prose-invert max-w-none mb-12">
          <p className="text-gray-400">
            We&apos;re building Constructa to help construction professionals quote, plan, and win more work without the admin headache.
            If you&apos;ve got a question, suggestion, or want early access—we&apos;d love to hear from you.
          </p>
        </div>

        <div className="space-y-6">
          <PublicFormCollectionNotice
            id={PUBLIC_FORM_COLLECTION_NOTICE_ID_CONTACT}
            kind="contact"
          />
          <ContactMarketingForm collectionReady={collectionReady} />
        </div>

        <p className="mt-8 text-sm text-gray-500">
          Or email us directly:{" "}
          <a
            href="mailto:hello@constructa.co"
            className="text-gray-300 hover:text-white transition-colors duration-200"
          >
            hello@constructa.co
          </a>
        </p>
      </div>
    </main>
  );
}