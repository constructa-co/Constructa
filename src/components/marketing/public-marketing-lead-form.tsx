"use client";

import { useActionState, useState } from "react";
import { ArrowRight } from "lucide-react";
import {
  FoundingCohortApplicationSchema,
  formatFoundingCohortFieldErrors,
  type FoundingCohortApplicationFieldErrors,
} from "@/lib/founding-cohort/application-schema";
import { publicMarketingFormDataToRecord } from "@/lib/marketing/public-marketing-form-schema";
import styles from "./founding-cohort-apply.module.css";

export type PublicMarketingLeadFormState =
  | { status: "idle" }
  | { status: "validation_error"; fieldErrors: FoundingCohortApplicationFieldErrors }
  | { status: "success" }
  | { status: "error"; message: string };

export const initialPublicMarketingLeadFormState: PublicMarketingLeadFormState = {
  status: "idle",
};

type PublicMarketingLeadFormProps = {
  collectionReady: boolean;
  collectionNoticeId: string;
  formAction: (
    previous: PublicMarketingLeadFormState,
    formData: FormData,
  ) => Promise<PublicMarketingLeadFormState>;
  idPrefix: string;
  submitLabel: string;
  submittingLabel: string;
  successMessage: string;
  messageLabel?: string;
  messagePlaceholder?: string;
  className?: string;
  buttonClassName?: string;
};

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

export function PublicMarketingLeadForm({
  collectionReady,
  collectionNoticeId,
  formAction,
  idPrefix,
  submitLabel,
  submittingLabel,
  successMessage,
  messageLabel = "Message",
  messagePlaceholder = "How can we help?",
  className,
  buttonClassName,
}: PublicMarketingLeadFormProps) {
  const [state, action, isPending] = useActionState(formAction, initialPublicMarketingLeadFormState);
  const [clientErrors, setClientErrors] =
    useState<FoundingCohortApplicationFieldErrors>({});

  const serverErrors =
    state.status === "validation_error" ? state.fieldErrors : undefined;
  const fieldErrors = mergeFieldErrors(clientErrors, serverErrors);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (!collectionReady) {
      event.preventDefault();
      return;
    }
    const form = event.currentTarget;
    const raw = publicMarketingFormDataToRecord(new FormData(form));
    const parsed = FoundingCohortApplicationSchema.safeParse(raw);
    if (!parsed.success) {
      event.preventDefault();
      setClientErrors(formatFoundingCohortFieldErrors(parsed.error));
      return;
    }
    setClientErrors({});
  };

  if (collectionReady && state.status === "success") {
    return (
      <p className={styles.success} role="status">
        {successMessage}
      </p>
    );
  }

  const formClassName = className ?? styles.form;

  return (
    <>
      {state.status === "error" ? (
        <p className={styles.bannerError} role="alert">
          {state.message}
        </p>
      ) : null}
      <form
        className={formClassName}
        action={collectionReady ? action : undefined}
        onSubmit={handleSubmit}
        noValidate
        aria-describedby={collectionReady ? undefined : collectionNoticeId}
      >
        <fieldset disabled={!collectionReady || isPending} className="contents">
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${idPrefix}-name`}>
            Your name
          </label>
          <input
            id={`${idPrefix}-name`}
            name="name"
            className={styles.input}
            autoComplete="name"
            required
            aria-invalid={Boolean(fieldErrors.name)}
            aria-describedby={fieldErrors.name ? `${idPrefix}-name-error` : undefined}
          />
          {fieldErrors.name ? (
            <p id={`${idPrefix}-name-error`} className={styles.error}>
              {fieldErrors.name}
            </p>
          ) : null}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${idPrefix}-email`}>
            Email
          </label>
          <input
            id={`${idPrefix}-email`}
            name="email"
            type="email"
            className={styles.input}
            autoComplete="email"
            required
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? `${idPrefix}-email-error` : undefined}
          />
          {fieldErrors.email ? (
            <p id={`${idPrefix}-email-error`} className={styles.error}>
              {fieldErrors.email}
            </p>
          ) : null}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${idPrefix}-company`}>
            Company <span className={styles.hint}>(optional)</span>
          </label>
          <input
            id={`${idPrefix}-company`}
            name="company"
            className={styles.input}
            autoComplete="organization"
            aria-invalid={Boolean(fieldErrors.company)}
            aria-describedby={fieldErrors.company ? `${idPrefix}-company-error` : undefined}
          />
          {fieldErrors.company ? (
            <p id={`${idPrefix}-company-error`} className={styles.error}>
              {fieldErrors.company}
            </p>
          ) : null}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${idPrefix}-message`}>
            {messageLabel}
          </label>
          <textarea
            id={`${idPrefix}-message`}
            name="message"
            className={styles.textarea}
            rows={4}
            required
            placeholder={messagePlaceholder}
            aria-invalid={Boolean(fieldErrors.message)}
            aria-describedby={
              fieldErrors.message ? `${idPrefix}-message-error` : undefined
            }
          />
          {fieldErrors.message ? (
            <p id={`${idPrefix}-message-error`} className={styles.error}>
              {fieldErrors.message}
            </p>
          ) : null}
        </div>

        <div className={styles.actions}>
          <button
            type="submit"
            className={buttonClassName ?? styles.submit}
            disabled={!collectionReady || isPending}
            aria-disabled={!collectionReady || isPending}
          >
            {collectionReady
              ? isPending
                ? submittingLabel
                : submitLabel
              : "Submission unavailable"}
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
        </fieldset>
      </form>
    </>
  );
}