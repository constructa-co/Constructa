import { describe, expect, it } from "vitest";
import {
  parsePublicMarketingFormInput,
  PublicMarketingFormSchema,
} from "./public-marketing-form-schema";

const valid = {
  name: "Alex Smith",
  email: "alex@example.co.uk",
  company: "Smith Refurbs Ltd",
  message: "Interested in the founding cohort preview.",
  consent: "on" as const,
};

describe("public marketing form schema", () => {
  it("accepts name, email, message, consent and optional company", () => {
    expect(PublicMarketingFormSchema.safeParse(valid).success).toBe(true);
  });

  it("treats blank company as omitted", () => {
    const parsed = PublicMarketingFormSchema.safeParse({
      ...valid,
      company: "   ",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.company).toBeUndefined();
    }
  });

  it("rejects missing consent and invalid email", () => {
    const result = parsePublicMarketingFormInput({
      name: "Alex",
      email: "bad",
      message: "",
      consent: undefined,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors.email).toBeDefined();
      expect(result.fieldErrors.message).toBeDefined();
      expect(result.fieldErrors.consent).toBeDefined();
    }
  });
});