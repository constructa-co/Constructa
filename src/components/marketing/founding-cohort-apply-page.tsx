import Link from "next/link";
import { FoundingCohortApplyForm } from "./founding-cohort-apply-form";
import styles from "./founding-cohort-apply.module.css";

export function PhaseOneFoundingCohortApply() {
  return (
    <div className={`${styles.theme} ${styles.root}`}>
      <section className={styles.pageIntro}>
        <p className={styles.eyebrow}>
          <span className={styles.dot} aria-hidden="true" />
          Founding cohort
        </p>
        <h1>
          Apply for the <em>founding cohort.</em>
        </h1>
        <p className={styles.lede}>
          Tell us who you are and the trade you run. This is separate from signing in with
          an existing review account — use this form if you want to express interest in
          the founding cohort.
        </p>
        <p className={styles.signInNote}>
          Already have preview access?{" "}
          <Link href="/login">Sign in with your existing account</Link>.
        </p>
      </section>
      <section className={styles.formSection} aria-labelledby="apply-form-heading">
        <div className={styles.formPanel}>
          <h2
            id="apply-form-heading"
            style={{
              fontSize: "clamp(22px, 2vw, 28px)",
              fontWeight: 500,
              margin: "0 0 18px",
              letterSpacing: "-.03em",
            }}
          >
            Application
          </h2>
          <p className={styles.todoNotice}>
            TODO(A109): submissions are validated here but not yet stored or emailed —
            Rob will choose the destination (database, CRM, or inbox) before go-live.
          </p>
          <FoundingCohortApplyForm />
        </div>
      </section>
    </div>
  );
}
