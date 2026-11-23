import { describe, expect, it } from "vitest";
import {
  FoundingCohortApplicationSchema,
  parseFoundingCohortApplicationInput,
} from "./application-schema";

const valid = {
  name: "Alex Smith",
  email: "alex@example.co.uk",
  company: "Smith Refurbs Ltd",
  message: "Interested in proposals for domestic clients.",
};

describe("founding cohort application schema", () => {
  it("accepts a complete application without consent", () => {
    const parsed = FoundingCohortApplicationSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it("trims fields and allows an empty optional company", () => {
    const parsed = FoundingCohortApplicationSchema.safeParse({
      ...valid,
      name: "  Alex Smith  ",
      company: "   ",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe("Alex Smith");
      expect(parsed.data.company).toBeUndefined();
    }
  });

  it("rejects missing required fields and invalid email", () => {
    const result = parseFoundingCohortApplicationInput({
      name: "",
      email: "not-an-email",
      message: "",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors.name).toBeDefined();
      expect(result.fieldErrors.email).toBeDefined();
      expect("consent" in result.fieldErrors).toBe(false);
    }
  });

  it("rejects an overlong message", () => {
    const parsed = FoundingCohortApplicationSchema.safeParse({
      ...valid,
      message: "x".repeat(4001),
    });
    expect(parsed.success).toBe(false);
  });
});