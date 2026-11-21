"use client";

import {
  submitFoundingCohortApplicationAction,
} from "@/app/apply/actions";
import { FOUNDING_COHORT_APPLY_STORAGE_NOTICE_ID } from "./founding-cohort-apply-storage-notice";
import { PublicMarketingLeadForm } from "./public-marketing-lead-form";

type FoundingCohortApplyFormProps = {
  collectionReady: boolean;
};

export function FoundingCohortApplyForm({ collectionReady }: FoundingCohortApplyFormProps) {
  return (
    <PublicMarketingLeadForm
      collectionReady={collectionReady}
      collectionNoticeId={FOUNDING_COHORT_APPLY_STORAGE_NOTICE_ID}
      formAction={submitFoundingCohortApplicationAction}
      idPrefix="apply"
      submitLabel="Submit application"
      submittingLabel="Sending…"
      successMessage="Thank you for your interest in the founding cohort. We have recorded your details and will be in touch."
      messageLabel="Short message"
      messagePlaceholder="What would you like Constructa to help you with?"
    />
  );
}