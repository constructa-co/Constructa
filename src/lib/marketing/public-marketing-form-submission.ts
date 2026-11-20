import type { PublicMarketingFormPayload } from "./public-marketing-form-schema";
import {
  isPublicMarketingFormCollectionReady as isMarketingFormCollectionReady,
} from "./public-form-collection";
import { PUBLIC_MARKETING_INBOX_DESTINATION_ENV } from "./public-marketing-form-policy";

export type PublicMarketingFormKind = "contact" | "apply";

export function isPublicMarketingFormCollectionReady(
  _kind: PublicMarketingFormKind,
): boolean {
  return isMarketingFormCollectionReady();
}

export function publicMarketingFormDestinationEnvName(
  _kind: PublicMarketingFormKind,
): string {
  return PUBLIC_MARKETING_INBOX_DESTINATION_ENV;
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