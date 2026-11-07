"use server";

import {
  parseFoundingCohortApplicationInput,
  type FoundingCohortApplicationFieldErrors,
} from "@/lib/founding-cohort/application-schema";
import { submitFoundingCohortApplication } from "@/lib/founding-cohort/submission-adapter";

export type FoundingCohortApplyFormState =
  | { status: "idle" }
  | { status: "validation_error"; fieldErrors: FoundingCohortApplicationFieldErrors }
  | { status: "success" }
  | { status: "error"; message: string };

export const initialFoundingCohortApplyFormState: FoundingCohortApplyFormState = {
  status: "idle",
};

function formDataToRecord(formData: FormData): Record<string, unknown> {
  return {
    name: formData.get("name"),
    company: formData.get("company"),
    email: formData.get("email"),
    trade: formData.get("trade"),
    teamSize: formData.get("teamSize"),
    note: formData.get("note") ?? "",
  };
}

export async function submitFoundingCohortApplicationAction(
  _previous: FoundingCohortApplyFormState,
  formData: FormData,
): Promise<FoundingCohortApplyFormState> {
  const parsed = parseFoundingCohortApplicationInput(formDataToRecord(formData));
  if (!parsed.ok) {
    return { status: "validation_error", fieldErrors: parsed.fieldErrors };
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
