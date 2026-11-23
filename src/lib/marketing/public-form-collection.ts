/**
 * Public marketing contact/apply forms. Collection is default-off and must stay off
 * until an operator sets the enable flag and a destination value in the runtime env.
 * Destination URLs or keys are never embedded in source — only the env var names below.
 */

/** Exactly `1` opts in to collecting public marketing form submissions on the server. */
export const PUBLIC_FORM_COLLECTION_ENABLED_ENV =
  "CONSTRUCTA_PUBLIC_FORM_COLLECTION_ENABLED";

/** Contact submissions route here when collection is enabled (value supplied at deploy time). */
export const PUBLIC_CONTACT_FORM_DESTINATION_ENV =
  "CONSTRUCTA_PUBLIC_CONTACT_FORM_DESTINATION";

/** Apply submissions route here when collection is enabled (value supplied at deploy time). */
export const PUBLIC_APPLY_FORM_DESTINATION_ENV =
  "CONSTRUCTA_PUBLIC_APPLY_FORM_DESTINATION";

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

export function isPublicContactFormCollectionReady(
  enabledValue: string | undefined = process.env[PUBLIC_FORM_COLLECTION_ENABLED_ENV],
  destinationValue: string | undefined = process.env[PUBLIC_CONTACT_FORM_DESTINATION_ENV],
): boolean {
  return (
    isPublicMarketingFormCollectionEnabled(enabledValue) &&
    hasNonEmptyDestination(destinationValue)
  );
}

export function isPublicApplyFormCollectionReady(
  enabledValue: string | undefined = process.env[PUBLIC_FORM_COLLECTION_ENABLED_ENV],
  destinationValue: string | undefined = process.env[PUBLIC_APPLY_FORM_DESTINATION_ENV],
): boolean {
  return (
    isPublicMarketingFormCollectionEnabled(enabledValue) &&
    hasNonEmptyDestination(destinationValue)
  );
}