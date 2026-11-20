/**
 * Founding-cohort AI spend ceilings for the existing ai_generation_* ledger.
 * Enforcement lives in Postgres (atomic reserve/finish), not in process memory.
 *
 * SOURCE ONLY: the companion migration is not applied in this lane.
 * Reservation charges in pence are operator integers on each feature row, not
 * runtime token-to-price conversions. Until each feature has max_reserve_pence set
 * in SQL, reserve returns disabled — no monetary call.
 */

/** Service-wide calendar-month ceiling seeded for the founding cohort (GBP 25). */
export const FOUNDING_COHORT_AI_GLOBAL_MONTHLY_MAX_PENCE = 2500;

/**
 * Per-company calendar-month ceiling (GBP 5). R1 conservative seed for SQL apply;
 * not a verified billing rate.
 */
export const FOUNDING_COHORT_AI_CONTRACTOR_MONTHLY_MAX_PENCE = 500;

/** Ledger refusal statuses added for calendar-month pence ceilings. */
export const FOUNDING_COHORT_AI_SPEND_REFUSALS = [
  "contractor-spend-cap",
  "global-spend-cap",
] as const;

export type FoundingCohortAiSpendRefusal =
  (typeof FOUNDING_COHORT_AI_SPEND_REFUSALS)[number];