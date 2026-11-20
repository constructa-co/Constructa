/**
 * Public contact and apply forms share one inbox destination (proposed
 * hello@constructa.co — unverified until Rob confirms the mailbox works).
 * No destination value is embedded in source.
 */

/** Both contact and apply route here when collection is enabled. */
export const PUBLIC_MARKETING_INBOX_DESTINATION_ENV =
  "CONSTRUCTA_PUBLIC_MARKETING_INBOX_DESTINATION";

/** Submissions are retained for twelve months; access is Rob-only when stored. */
export const PUBLIC_MARKETING_FORM_RETENTION_MONTHS = 12;

export const PUBLIC_MARKETING_FORM_ACCESS_POLICY = "rob-only" as const;