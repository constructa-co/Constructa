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
        This form is a preview and is not connected to storage, so applications cannot be
        submitted yet — nothing you type here is sent, saved or emailed. Our{" "}
        <Link href="/privacy-policy">privacy policy</Link> explains how we handle personal
        details. To reach the team in the meantime, use the{" "}
        <Link href="/contact">contact page</Link>.
      </p>
    </div>
  );
}