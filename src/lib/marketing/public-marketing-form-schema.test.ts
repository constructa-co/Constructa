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
};

describe("public marketing form schema", () => {
  it("accepts name, email, message and optional company without a consent field", () => {
    expect(PublicMarketingFormSchema.safeParse(valid).success).toBe(true);
    expect(PublicMarketingFormSchema.safeParse({ ...valid, consent: "on" }).success).toBe(
      false,
    );
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

  it("rejects invalid email and missing message", () => {
    const result = parsePublicMarketingFormInput({
      name: "Alex",
      email: "bad",
      message: "",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors.email).toBeDefined();
      expect(result.fieldErrors.message).toBeDefined();
      expect("consent" in result.fieldErrors).toBe(false);
    }
  });
});