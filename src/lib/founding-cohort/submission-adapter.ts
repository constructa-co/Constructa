import type { FoundingCohortApplication } from "./application-schema";

/**
 * True only after a real persistence destination is approved and wired (database, CRM,
 * inbox automation, etc.). While false the public apply form must not submit.
 */
export function hasFoundingCohortApplicationStorageAdapter(): boolean {
  return false;
}

/**
 * TODO(A109 — Rob to decide): Persist or route founding cohort applications to the
 * chosen destination (e.g. Supabase table, CRM, Resend notification, spreadsheet).
 * This adapter is intentionally a no-op: it must not write to a database, send email,
 * or call third-party services until that destination is approved.
 */
export async function submitFoundingCohortApplication(
  _application: FoundingCohortApplication,
): Promise<void> {
  if (!hasFoundingCohortApplicationStorageAdapter()) {
    throw new Error("Founding cohort application storage is not wired.");
  }
}
