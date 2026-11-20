"use server";

import {
  parseFoundingCohortApplicationInput,
  type FoundingCohortApplicationFieldErrors,
} from "@/lib/founding-cohort/application-schema";
import {
  hasFoundingCohortApplicationStorageAdapter,
  submitFoundingCohortApplication,
} from "@/lib/founding-cohort/submission-adapter";
import { publicMarketingFormDataToRecord } from "@/lib/marketing/public-marketing-form-schema";
import { isPublicApplyFormCollectionReady } from "@/lib/marketing/public-form-collection";

export type FoundingCohortApplyFormState =
  | { status: "idle" }
  | { status: "validation_error"; fieldErrors: FoundingCohortApplicationFieldErrors }
  | { status: "success" }
  | { status: "error"; message: string };



export async function submitFoundingCohortApplicationAction(
  _previous: FoundingCohortApplyFormState,
  formData: FormData,
): Promise<FoundingCohortApplyFormState> {
  const parsed = parseFoundingCohortApplicationInput(
    publicMarketingFormDataToRecord(formData),
  );
  if (!parsed.ok) {
    return { status: "validation_error", fieldErrors: parsed.fieldErrors };
  }

  if (!isPublicApplyFormCollectionReady() || !hasFoundingCohortApplicationStorageAdapter()) {
    return {
      status: "error",
      message:
        "Applications cannot be submitted yet because collection is turned off. Use the contact page or email hello@constructa.co to reach the team.",
    };
  }

  try {
    await submitFoundingCohortApplication(parsed.data);
    return { status: "success" };
  } catch {
    return {
      status: "error",
      message: "We could not record your application yet. Please try again shortly.",
    };
  }
}