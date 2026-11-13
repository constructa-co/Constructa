import type { FoundingCohortApplication } from "./application-schema";

/**
 * TODO(A109 — Rob to decide): Persist or route founding cohort applications to the
 * chosen destination (e.g. Supabase table, CRM, Resend notification, spreadsheet).
 * This adapter is intentionally a no-op: it must not write to a database, send email,
 * or call third-party services until that destination is approved.
 */
export async function submitFoundingCohortApplication(
  _application: FoundingCohortApplication,
): Promise<void> {}
