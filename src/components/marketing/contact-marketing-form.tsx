"use client";

import { submitContactMarketingFormAction } from "@/app/contact/actions";
import { PUBLIC_FORM_COLLECTION_NOTICE_ID_CONTACT } from "./public-form-collection-notice-ids";
import { PublicMarketingLeadForm } from "./public-marketing-lead-form";

type ContactMarketingFormProps = {
  collectionReady: boolean;
  collectionNoticeId?: string;
  className?: string;
  buttonClassName?: string;
};

export function ContactMarketingForm({
  collectionReady,
  collectionNoticeId = PUBLIC_FORM_COLLECTION_NOTICE_ID_CONTACT,
  className,
  buttonClassName,
}: ContactMarketingFormProps) {
  return (
    <PublicMarketingLeadForm
      collectionReady={collectionReady}
      collectionNoticeId={collectionNoticeId}
      formAction={submitContactMarketingFormAction}
      idPrefix="contact"
      submitLabel="Send message"
      submittingLabel="Sending…"
      successMessage="Thank you. We have received your message and will respond when collection is active."
      messageLabel="Message"
      messagePlaceholder="Your message"
      className={className}
      buttonClassName={buttonClassName}
    />
  );
}