import { z } from "zod";

export const FOUNDING_COHORT_TEAM_SIZES = [
  "1",
  "2-5",
  "6-10",
  "11-20",
  "21+",
] as const;

export type FoundingCohortTeamSize = (typeof FOUNDING_COHORT_TEAM_SIZES)[number];

const trimmed = (max: number) =>
  z
    .string()
    .trim()
    .min(1, "This field is required.")
    .max(max);

export const FoundingCohortApplicationSchema = z
  .object({
    name: trimmed(120),
    company: trimmed(160),
    email: z
      .string()
      .trim()
      .min(1, "Email is required.")
      .email("Enter a valid email address.")
      .max(254),
    trade: trimmed(120),
    teamSize: z.enum(FOUNDING_COHORT_TEAM_SIZES, {
      message: "Choose a team size.",
    }),
    note: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z
        .string()
        .trim()
        .max(2000, "Keep your note under 2000 characters.")
        .optional(),
    ),
  })
  .strict();

export type FoundingCohortApplication = z.infer<
  typeof FoundingCohortApplicationSchema
>;

export type FoundingCohortApplicationFieldErrors = Partial<
  Record<keyof FoundingCohortApplication, string>
>;

export function formatFoundingCohortFieldErrors(
  error: z.ZodError,
): FoundingCohortApplicationFieldErrors {
  const fieldErrors: FoundingCohortApplicationFieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in fieldErrors)) {
      fieldErrors[key as keyof FoundingCohortApplication] = issue.message;
    }
  }
  return fieldErrors;
}

export function parseFoundingCohortApplicationInput(
  raw: unknown,
):
  | { ok: true; data: FoundingCohortApplication }
  | { ok: false; fieldErrors: FoundingCohortApplicationFieldErrors } {
  const parsed = FoundingCohortApplicationSchema.safeParse(raw);
  if (parsed.success) return { ok: true, data: parsed.data };
  return { ok: false, fieldErrors: formatFoundingCohortFieldErrors(parsed.error) };
}
