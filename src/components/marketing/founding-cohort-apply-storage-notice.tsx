import Link from "next/link";
import styles from "./founding-cohort-apply.module.css";

export const FOUNDING_COHORT_APPLY_STORAGE_NOTICE_ID =
  "founding-cohort-apply-storage-notice";

export function FoundingCohortApplyStorageNotice() {
  return (
    <div
      className={styles.storageNotice}
      id={FOUNDING_COHORT_APPLY_STORAGE_NOTICE_ID}
      role="status"
    >
      <strong className={styles.storageNoticeTitle}>Applications are not saved yet.</strong>
      <p className={styles.storageNoticeBody}>
        This preview form is not connected to storage. Nothing you enter here is kept or emailed.
        To reach the team in the meantime, use the{" "}
        <Link href="/contact">contact page</Link>.
      </p>
    </div>
  );
}