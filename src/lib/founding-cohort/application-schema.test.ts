import { describe, expect, it } from "vitest";
import {
  FoundingCohortApplicationSchema,
  parseFoundingCohortApplicationInput,
} from "./application-schema";

const valid = {
  name: "Alex Smith",
  company: "Smith Refurbs Ltd",
  email: "alex@example.co.uk",
  trade: "Kitchen refurbishment",
  teamSize: "2-5",
  note: "Interested in proposals for domestic clients.",
};

describe("founding cohort application schema", () => {
  it("accepts a complete application", () => {
    const parsed = FoundingCohortApplicationSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it("trims fields and allows an empty optional note", () => {
    const parsed = FoundingCohortApplicationSchema.safeParse({
      ...valid,
      name: "  Alex Smith  ",
      note: "   ",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe("Alex Smith");
      expect(parsed.data.note).toBeUndefined();
    }
  });

  it("rejects missing required fields and invalid email", () => {
    const result = parseFoundingCohortApplicationInput({
      name: "",
      company: "Co",
      email: "not-an-email",
      trade: "Groundworks",
      teamSize: "6-10",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors.name).toBeDefined();
      expect(result.fieldErrors.email).toBeDefined();
    }
  });

  it("rejects an overlong note", () => {
    const parsed = FoundingCohortApplicationSchema.safeParse({
      ...valid,
      note: "x".repeat(2001),
    });
    expect(parsed.success).toBe(false);
  });
});
