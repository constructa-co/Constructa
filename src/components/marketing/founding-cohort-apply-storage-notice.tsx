import { PUBLIC_FORM_COLLECTION_NOTICE_ID_APPLY } from "./public-form-collection-notice-ids";
import { PublicFormCollectionNotice } from "./public-form-collection-notice";

export const FOUNDING_COHORT_APPLY_STORAGE_NOTICE_ID =
  PUBLIC_FORM_COLLECTION_NOTICE_ID_APPLY;

export function FoundingCohortApplyStorageNotice() {
  return (
    <PublicFormCollectionNotice
      id={FOUNDING_COHORT_APPLY_STORAGE_NOTICE_ID}
      kind="apply"
    />
  );
}