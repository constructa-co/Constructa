import { describe, expect, it } from "vitest";
import {
  FOUNDING_COHORT_MONTHLY_PRICE,
  FOUNDING_MEMBER_DISCOUNT_LABEL,
  STANDARD_MONTHLY_PRICE_BEFORE_DISCOUNT,
} from "./founding-cohort-pricing";

describe("founding cohort pricing tokens", () => {
  it("uses rob-confirm tokens instead of invented GBP amounts", () => {
    expect(FOUNDING_COHORT_MONTHLY_PRICE).toMatch(/^\[ROB TO CONFIRM:/);
    expect(STANDARD_MONTHLY_PRICE_BEFORE_DISCOUNT).toMatch(/^\[ROB TO CONFIRM:/);
    expect(FOUNDING_COHORT_MONTHLY_PRICE).not.toMatch(/£\s*\d/);
    expect(STANDARD_MONTHLY_PRICE_BEFORE_DISCOUNT).not.toMatch(/£\s*\d/);
  });

  it("labels the discount without a numeric percent", () => {
    expect(FOUNDING_MEMBER_DISCOUNT_LABEL).toBe("Founding member discount");
    expect(FOUNDING_MEMBER_DISCOUNT_LABEL).not.toMatch(/\d+\s*%/);
  });
});