import type { Metadata } from "next";
import Link from "next/link";
import { FoundingCohortApplyForm } from "@/components/marketing/founding-cohort-apply-form";
import { FoundingCohortApplyStorageNotice } from "@/components/marketing/founding-cohort-apply-storage-notice";
import applyStyles from "@/components/marketing/founding-cohort-apply.module.css";
import { PhaseOneFoundingCohortApply } from "@/components/marketing/founding-cohort-apply-page";
import { getLaunchProfile } from "@/lib/launch-profile";

import { marketingPageMetadata } from "@/lib/marketing-seo";

export const metadata: Metadata = marketingPageMetadata({
  title: "Apply to the founding cohort | Constructa",
  description:
    "Express interest in the Constructa founding cohort. Separate from signing in with an existing review account.",
  pathname: "/apply",
});

export default function ApplyPage() {
  if (getLaunchProfile() !== "full") {
    return <PhaseOneFoundingCohortApply />;
  }

  return (
    <main className={`${applyStyles.theme} min-h-screen pt-16 ${applyStyles.root}`}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-semibold mb-4">Apply to the founding cohort</h1>
        <p className={`${applyStyles.openingNote} mb-4`}>Founding cohort opens 7 December 2026.</p>
        <p className={`${applyStyles.lede} mb-4`}>
          New to Constructa? Share a few details below. This is not the same as signing in.
        </p>
        <p className={`${applyStyles.signInNote} mb-10`}>
          Already have an account? <Link href="/login">Sign in here</Link>.
        </p>
        <div className={applyStyles.formPanel}>
          <FoundingCohortApplyStorageNotice />
          <FoundingCohortApplyForm />
        </div>
      </div>
    </main>
  );
}
