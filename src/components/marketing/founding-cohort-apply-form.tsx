"use client";

import { useActionState, useState } from "react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import {
  FOUNDING_COHORT_TEAM_SIZES,
  FoundingCohortApplicationSchema,
  formatFoundingCohortFieldErrors,
  type FoundingCohortApplicationFieldErrors,
} from "@/lib/founding-cohort/application-schema";
import {
  initialFoundingCohortApplyFormState,
  submitFoundingCohortApplicationAction,
  type FoundingCohortApplyFormState,
} from "@/app/apply/actions";
import styles from "./founding-cohort-apply.module.css";

function mergeFieldErrors(
  client: FoundingCohortApplicationFieldErrors,
  server: FoundingCohortApplicationFieldErrors | undefined,
): FoundingCohortApplicationFieldErrors {
  return { ...client, ...server };
}

function fieldError(
  errors: FoundingCohortApplicationFieldErrors,
  key: keyof FoundingCohortApplicationFieldErrors,
): string | undefined {
  return errors[key];
}

export function FoundingCohortApplyForm() {
  const [state, formAction, isPending] = useActionState<
    FoundingCohortApplyFormState,
    FormData
  >(submitFoundingCohortApplicationAction, initialFoundingCohortApplyFormState);

  const [clientErrors, setClientErrors] =
    useState<FoundingCohortApplicationFieldErrors>({});

  const serverErrors =
    state.status === "validation_error" ? state.fieldErrors : undefined;
  const fieldErrors = mergeFieldErrors(clientErrors, serverErrors);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    const form = event.currentTarget;
    const formData = new FormData(form);
    const raw = Object.fromEntries(formData.entries());
    const parsed = FoundingCohortApplicationSchema.safeParse(raw);
    if (!parsed.success) {
      event.preventDefault();
      setClientErrors(formatFoundingCohortFieldErrors(parsed.error));
      return;
    }
    setClientErrors({});
  };

  if (state.status === "success") {
    return (
      <p className={styles.success} role="status">
        Thank you for your interest in the founding cohort. Applications are not being
        collected yet. Already have access?{" "}
        <Link href="/login">Sign in here</Link>.
      </p>
    );
  }

  return (
    <>
      {state.status === "error" ? (
        <p className={styles.bannerError} role="alert">
          {state.message}
        </p>
      ) : null}
      <form
        className={styles.form}
        action={formAction}
        onSubmit={handleSubmit}
        noValidate
      >
        <div className={styles.field}>
          <label className={styles.label} htmlFor="apply-name">
            Your name
          </label>
          <input
            id="apply-name"
            name="name"
            className={styles.input}
            autoComplete="name"
            required
            aria-invalid={Boolean(fieldErrors.name)}
            aria-describedby={fieldErrors.name ? "apply-name-error" : undefined}
          />
          {fieldErrors.name ? (
            <p id="apply-name-error" className={styles.error}>
              {fieldErrors.name}
            </p>
          ) : null}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="apply-company">
            Company name
          </label>
          <input
            id="apply-company"
            name="company"
            className={styles.input}
            autoComplete="organization"
            required
            aria-invalid={Boolean(fieldErrors.company)}
            aria-describedby={fieldErrors.company ? "apply-company-error" : undefined}
          />
          {fieldErrors.company ? (
            <p id="apply-company-error" className={styles.error}>
              {fieldErrors.company}
            </p>
          ) : null}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="apply-email">
            Work email
          </label>
          <input
            id="apply-email"
            name="email"
            type="email"
            className={styles.input}
            autoComplete="email"
            required
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? "apply-email-error" : undefined}
          />
          {fieldErrors.email ? (
            <p id="apply-email-error" className={styles.error}>
              {fieldErrors.email}
            </p>
          ) : null}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="apply-trade">
            Main trade or specialism
          </label>
          <input
            id="apply-trade"
            name="trade"
            className={styles.input}
            placeholder="e.g. Refurbishment, groundworks, M&E"
            required
            aria-invalid={Boolean(fieldErrors.trade)}
            aria-describedby={fieldErrors.trade ? "apply-trade-error" : undefined}
          />
          {fieldErrors.trade ? (
            <p id="apply-trade-error" className={styles.error}>
              {fieldErrors.trade}
            </p>
          ) : null}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="apply-team-size">
            Team size
          </label>
          <select
            id="apply-team-size"
            name="teamSize"
            className={styles.select}
            defaultValue=""
            required
            aria-invalid={Boolean(fieldErrors.teamSize)}
            aria-describedby={fieldErrors.teamSize ? "apply-team-size-error" : undefined}
          >
            <option value="" disabled>
              Select team size
            </option>
            {FOUNDING_COHORT_TEAM_SIZES.map((size) => (
              <option key={size} value={size}>
                {size === "1" ? "Just me" : `${size} people`}
              </option>
            ))}
          </select>
          {fieldErrors.teamSize ? (
            <p id="apply-team-size-error" className={styles.error}>
              {fieldErrors.teamSize}
            </p>
          ) : null}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="apply-note">
            Short note <span className={styles.hint}>(optional)</span>
          </label>
          <textarea
            id="apply-note"
            name="note"
            className={styles.textarea}
            rows={4}
            maxLength={2000}
            placeholder="What kind of work do you want Constructa to help you win?"
            aria-invalid={Boolean(fieldErrors.note)}
            aria-describedby={fieldErrors.note ? "apply-note-error" : "apply-note-hint"}
          />
          <p id="apply-note-hint" className={styles.hint}>
            Up to 2000 characters. Do not include client-identifying project details yet.
          </p>
          {fieldErrors.note ? (
            <p id="apply-note-error" className={styles.error}>
              {fieldErrors.note}
            </p>
          ) : null}
        </div>

        <div className={styles.actions}>
          <button type="submit" className={styles.submit} disabled={isPending}>
            {isPending ? "Sending…" : "Submit application"}
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
      </form>
    </>
  );
}
