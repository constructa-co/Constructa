import { isPublicApplyFormCollectionReady } from "@/lib/marketing/public-form-collection";
import { submitPublicMarketingForm } from "@/lib/marketing/public-marketing-form-submission";
import type { FoundingCohortApplication } from "./application-schema";

/**
 * True only when public apply collection is explicitly enabled and a destination env
 * value is present. While false the public apply form must not submit.
 */
export function hasFoundingCohortApplicationStorageAdapter(): boolean {
  return isPublicApplyFormCollectionReady();
}

export async function submitFoundingCohortApplication(
  application: FoundingCohortApplication,
): Promise<void> {
  await submitPublicMarketingForm("apply", application);
}