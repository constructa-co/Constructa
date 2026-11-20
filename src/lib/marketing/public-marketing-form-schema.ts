import { z } from "zod";

const trimmedRequired = (max: number) =>
  z
    .string()
    .trim()
    .min(1, "This field is required.")
    .max(max);

export const PublicMarketingFormSchema = z
  .object({
    name: trimmedRequired(120),
    email: z
      .string()
      .trim()
      .min(1, "Email is required.")
      .email("Enter a valid email address.")
      .max(254),
    company: z.preprocess(
      (value) =>
        typeof value === "string" && value.trim() === "" ? undefined : value,
      z.string().trim().max(160, "Keep company name under 160 characters.").optional(),
    ),
    message: trimmedRequired(4000),
    consent: z.literal("on", {
      errorMap: () => ({ message: "Confirm you agree before sending." }),
    }),
  })
  .strict();

export type PublicMarketingFormPayload = z.infer<typeof PublicMarketingFormSchema>;

export type PublicMarketingFormFieldErrors = Partial<
  Record<keyof PublicMarketingFormPayload, string>
>;

export function formatPublicMarketingFormFieldErrors(
  error: z.ZodError,
): PublicMarketingFormFieldErrors {
  const fieldErrors: PublicMarketingFormFieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in fieldErrors)) {
      fieldErrors[key as keyof PublicMarketingFormPayload] = issue.message;
    }
  }
  return fieldErrors;
}

export function parsePublicMarketingFormInput(
  raw: unknown,
):
  | { ok: true; data: PublicMarketingFormPayload }
  | { ok: false; fieldErrors: PublicMarketingFormFieldErrors } {
  const parsed = PublicMarketingFormSchema.safeParse(raw);
  if (parsed.success) return { ok: true, data: parsed.data };
  return { ok: false, fieldErrors: formatPublicMarketingFormFieldErrors(parsed.error) };
}

export function publicMarketingFormDataToRecord(
  formData: FormData,
): Record<string, unknown> {
  return {
    name: formData.get("name"),
    email: formData.get("email"),
    company: formData.get("company"),
    message: formData.get("message"),
    consent: formData.get("consent"),
  };
}