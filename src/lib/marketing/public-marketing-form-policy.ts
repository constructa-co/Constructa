/**
 * D88: planned destination approved by Rob; mailbox is not set up yet.
 * Collection remains OFF; runtime destination and enable settings remain Rob-owned.
 */

/** Both contact and apply route here when collection is enabled. */
export const PUBLIC_MARKETING_INBOX_DESTINATION_ENV =
  "CONSTRUCTA_PUBLIC_MARKETING_INBOX_DESTINATION";

/** Submissions are retained for twelve months; access is Rob-only when stored. */
export const PUBLIC_MARKETING_FORM_RETENTION_MONTHS = 12;

export const PUBLIC_MARKETING_FORM_ACCESS_POLICY = "rob-only" as const;
/** Selected destination only; not evidence of a working mailbox or permission to enable collection. */
export const PUBLIC_MARKETING_PLANNED_INBOX = "hello@constructa.co";
