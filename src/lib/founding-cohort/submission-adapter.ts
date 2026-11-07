import type { FoundingCohortApplication } from "./application-schema";

/**
 * TODO(A109 — Rob to decide): Persist or route founding cohort applications to the
 * chosen destination (e.g. Supabase table, CRM, Resend notification, spreadsheet).
 * This adapter is intentionally a no-op: it must not write to a database, send email,
 * or call third-party services until that destination is approved.
 */
export async function submitFoundingCohortApplication(
  application: FoundingCohortApplication,
): Promise<void> {
  if (process.env.NODE_ENV === "test") return;

  console.info(
    "[A109 TODO adapter] founding cohort application accepted locally (not persisted)",
    {
      name: application.name,
      company: application.company,
      trade: application.trade,
      teamSize: application.teamSize,
      noteLength: application.note?.length ?? 0,
      emailDomain: application.email.includes("@")
        ? application.email.split("@")[1]
        : "unknown",
    },
  );
}
