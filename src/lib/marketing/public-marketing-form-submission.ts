import type { PublicMarketingFormPayload } from "./public-marketing-form-schema";
import {
  isPublicApplyFormCollectionReady,
  isPublicContactFormCollectionReady,
  PUBLIC_APPLY_FORM_DESTINATION_ENV,
  PUBLIC_CONTACT_FORM_DESTINATION_ENV,
} from "./public-form-collection";

export type PublicMarketingFormKind = "contact" | "apply";

export function isPublicMarketingFormCollectionReady(kind: PublicMarketingFormKind): boolean {
  return kind === "contact"
    ? isPublicContactFormCollectionReady()
    : isPublicApplyFormCollectionReady();
}

export function publicMarketingFormDestinationEnvName(
  kind: PublicMarketingFormKind,
): string {
  return kind === "contact"
    ? PUBLIC_CONTACT_FORM_DESTINATION_ENV
    : PUBLIC_APPLY_FORM_DESTINATION_ENV;
}

/**
 * Persists or routes a validated public form payload to the operator-supplied destination.
 * While collection is off, or routing is not implemented, this throws and must not send data.
 */
export async function submitPublicMarketingForm(
  kind: PublicMarketingFormKind,
  _payload: PublicMarketingFormPayload,
): Promise<void> {
  if (!isPublicMarketingFormCollectionReady(kind)) {
    throw new Error("Public marketing form collection is not enabled.");
  }

  const destinationEnv = publicMarketingFormDestinationEnvName(kind);
  const destination = process.env[destinationEnv];
  if (typeof destination !== "string" || destination.trim() === "") {
    throw new Error("Public marketing form destination is not configured.");
  }

  throw new Error(
    `Public marketing form destination routing is not implemented (${destinationEnv}).`,
  );
}