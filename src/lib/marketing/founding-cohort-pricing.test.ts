import { describe, expect, it } from "vitest";
import {
  CONSTRUCTA_TRADING_NAME,
  PRICING_OWNER_REVIEW_NOTES,
  PRICING_SETTLED_NOTES,
  PRICING_TIERS,
  FOUNDING_MEMBER_DISCOUNT_LABEL,
} from "./founding-cohort-pricing";

describe("D102 settled founding-cohort pricing copy", () => {
  it("uses Rob's three GBP list prices", () => {
    expect(PRICING_TIERS.map((t) => [t.name, t.price])).toEqual([
      ["Free", "£0"],
      ["Pro", "£50"],
      ["Business", "£80"],
    ]);
    expect(PRICING_TIERS[0].features).toContain("1 quote");
    expect(FOUNDING_MEMBER_DISCOUNT_LABEL).toContain("25%");
  });

  it("states D99-settled billing and founding timing without stale re-answer prompts", () => {
    const settled = PRICING_SETTLED_NOTES.join(" ");
    expect(settled).toContain("£135 Pro / £216 Business");
    expect(settled).toContain("£480 Pro / £768");
    expect(settled).toContain("does not combine");
    expect(settled).toContain("2.4 months saved");
    expect(settled).toMatch(/not a .*two months free/i);
    expect(settled).toContain("£37.50 Pro / £60 Business");
    expect(settled).toContain("No free trial");
    expect(settled).toContain(CONSTRUCTA_TRADING_NAME);
    expect(settled.toLowerCase()).not.toContain("for rob to confirm");
  });

  it("keeps unresolved publication items separate", () => {
    const pending = PRICING_OWNER_REVIEW_NOTES.join(" ");
    expect(pending).toContain("eligibility");
    expect(pending).toContain("Excl. VAT");
  });
});