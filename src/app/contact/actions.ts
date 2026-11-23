"use server";

import {
  parsePublicMarketingFormInput,
  publicMarketingFormDataToRecord,
  type PublicMarketingFormFieldErrors,
} from "@/lib/marketing/public-marketing-form-schema";
import {
  isPublicContactFormCollectionReady,
} from "@/lib/marketing/public-form-collection";
import { submitPublicMarketingForm } from "@/lib/marketing/public-marketing-form-submission";

export type ContactMarketingFormState =
  | { status: "idle" }
  | { status: "validation_error"; fieldErrors: PublicMarketingFormFieldErrors }
  | { status: "success" }
  | { status: "error"; message: string };



export async function submitContactMarketingFormAction(
  _previous: ContactMarketingFormState,
  formData: FormData,
): Promise<ContactMarketingFormState> {
  const parsed = parsePublicMarketingFormInput(
    publicMarketingFormDataToRecord(formData),
  );
  if (!parsed.ok) {
    return { status: "validation_error", fieldErrors: parsed.fieldErrors };
  }

  if (!isPublicContactFormCollectionReady()) {
    return {
      status: "error",
      message:
        "Messages cannot be submitted yet because collection is turned off. Email hello@constructa.co instead.",
    };
  }

  try {
    await submitPublicMarketingForm("contact", parsed.data);
    return { status: "success" };
  } catch {
    return {
      status: "error",
      message: "We could not send your message yet. Please try again shortly.",
    };
  }
}