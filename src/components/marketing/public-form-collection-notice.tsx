import Link from "next/link";
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
        stored or emailed. See our{" "}
        <Link href="/privacy-policy">privacy policy</Link> for how we handle personal
        details. You can also reach us on the{" "}
        <Link href="/contact">contact page</Link> or by email at{" "}
        <a href="mailto:hello@constructa.co">hello@constructa.co</a>.
      </p>
    </div>
  );
}