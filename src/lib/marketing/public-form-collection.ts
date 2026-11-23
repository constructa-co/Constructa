/**
 * Public marketing contact/apply forms. Collection is default-off and must stay off
 * until an operator sets the enable flag and a destination value in the runtime env.
 * Destination URLs or keys are never embedded in source — only the env var names below.
 */

import { PUBLIC_MARKETING_INBOX_DESTINATION_ENV } from "./public-marketing-form-policy";

/** Exactly `1` opts in to collecting public marketing form submissions on the server. */
export const PUBLIC_FORM_COLLECTION_ENABLED_ENV =
  "CONSTRUCTA_PUBLIC_FORM_COLLECTION_ENABLED";

/**
 * @deprecated Use {@link PUBLIC_MARKETING_INBOX_DESTINATION_ENV}. Kept for one release
 * so existing env names in operator notes still grep-match.
 */
export const PUBLIC_CONTACT_FORM_DESTINATION_ENV =
  PUBLIC_MARKETING_INBOX_DESTINATION_ENV;

/**
 * @deprecated Use {@link PUBLIC_MARKETING_INBOX_DESTINATION_ENV}.
 */
export const PUBLIC_APPLY_FORM_DESTINATION_ENV =
  PUBLIC_MARKETING_INBOX_DESTINATION_ENV;

export function isPublicMarketingFormCollectionEnabled(
  enabledValue: string | undefined = process.env[PUBLIC_FORM_COLLECTION_ENABLED_ENV],
): boolean {
  return enabledValue === "1";
}

function hasNonEmptyDestination(
  destinationValue: string | undefined,
): boolean {
  return typeof destinationValue === "string" && destinationValue.trim().length > 0;
}

export function isPublicMarketingInboxDestinationConfigured(
  destinationValue: string | undefined = process.env[PUBLIC_MARKETING_INBOX_DESTINATION_ENV],
): boolean {
  return hasNonEmptyDestination(destinationValue);
}

export function isPublicMarketingFormCollectionReady(
  enabledValue: string | undefined = process.env[PUBLIC_FORM_COLLECTION_ENABLED_ENV],
  destinationValue: string | undefined = process.env[PUBLIC_MARKETING_INBOX_DESTINATION_ENV],
): boolean {
  return (
    isPublicMarketingFormCollectionEnabled(enabledValue) &&
    hasNonEmptyDestination(destinationValue)
  );
}

export function isPublicContactFormCollectionReady(
  enabledValue: string | undefined = process.env[PUBLIC_FORM_COLLECTION_ENABLED_ENV],
  destinationValue: string | undefined = process.env[PUBLIC_MARKETING_INBOX_DESTINATION_ENV],
): boolean {
  return isPublicMarketingFormCollectionReady(enabledValue, destinationValue);
}

export function isPublicApplyFormCollectionReady(
  enabledValue: string | undefined = process.env[PUBLIC_FORM_COLLECTION_ENABLED_ENV],
  destinationValue: string | undefined = process.env[PUBLIC_MARKETING_INBOX_DESTINATION_ENV],
): boolean {
  return isPublicMarketingFormCollectionReady(enabledValue, destinationValue);
}