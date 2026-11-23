import Link from "next/link";
import {
  PUBLIC_MARKETING_FORM_ACCESS_POLICY,
  PUBLIC_MARKETING_PLANNED_INBOX,
  PUBLIC_MARKETING_FORM_RETENTION_MONTHS,
} from "@/lib/marketing/public-marketing-form-policy";
import styles from "./founding-cohort-apply.module.css";

type PublicFormCollectionNoticeProps = {
  id: string;
  kind: "contact" | "apply";
};

export function PublicFormCollectionNotice({
  id,
  kind,
}: PublicFormCollectionNoticeProps) {
  const noun = kind === "contact" ? "Messages" : "Applications";

  return (
    <div className={styles.storageNotice} id={id} role="status">
      <strong className={styles.storageNoticeTitle}>{noun} are not collected yet.</strong>
      <p className={styles.storageNoticeBody}>
        This form is not accepting submissions yet. Nothing you enter here is sent,
        stored or emailed. When collection is turned on, contact and apply messages
        go to one shared inbox ({PUBLIC_MARKETING_FORM_ACCESS_POLICY === "rob-only"
          ? "Rob-only access"
          : "restricted access"}
        ; {PUBLIC_MARKETING_FORM_RETENTION_MONTHS}-month retention). See our{" "}
        <Link href="/privacy-policy">privacy policy</Link>. You can also reach us on
        the <Link href="/contact">contact page</Link> or view the planned inbox:{" "}
        <span>{PUBLIC_MARKETING_PLANNED_INBOX}</span> (planned destination; this inbox is not set up yet).
      </p>
    </div>
  );
}