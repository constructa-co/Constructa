import {
  formatPublicMarketingFormFieldErrors,
  parsePublicMarketingFormInput,
  PublicMarketingFormSchema,
  type PublicMarketingFormFieldErrors,
  type PublicMarketingFormPayload,
} from "@/lib/marketing/public-marketing-form-schema";

export const FoundingCohortApplicationSchema = PublicMarketingFormSchema;

export type FoundingCohortApplication = PublicMarketingFormPayload;

export type FoundingCohortApplicationFieldErrors = PublicMarketingFormFieldErrors;

export function formatFoundingCohortFieldErrors(
  error: Parameters<typeof formatPublicMarketingFormFieldErrors>[0],
): FoundingCohortApplicationFieldErrors {
  return formatPublicMarketingFormFieldErrors(error);
}

export function parseFoundingCohortApplicationInput(
  raw: unknown,
):
  | { ok: true; data: FoundingCohortApplication }
  | { ok: false; fieldErrors: FoundingCohortApplicationFieldErrors } {
  return parsePublicMarketingFormInput(raw);
}