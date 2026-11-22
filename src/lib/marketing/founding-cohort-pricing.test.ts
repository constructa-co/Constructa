import { describe, expect, it } from "vitest";
import { PRICING_TIERS, PRICING_REVIEW_NOTES, FOUNDING_MEMBER_DISCOUNT_LABEL } from "./founding-cohort-pricing";
describe("D91 approved pricing and unresolved terms", () => {
  it("uses Rob's three GBP prices", () => {
    expect(PRICING_TIERS.map(t => [t.name, t.price])).toEqual([["Free", "£0"], ["Pro", "£50"], ["Business", "£80"]]);
    expect(PRICING_TIERS[0].features).toContain("1 quote");
    expect(FOUNDING_MEMBER_DISCOUNT_LABEL).toContain("25%");
  });
  it("does not silently promise a trial, stacking or an incorrect annual saving", () => {
    const notes = PRICING_REVIEW_NOTES.join(" ");
    expect(notes).toContain("No free trial is offered");
    expect(notes).toContain("No combined discount is assumed");
    expect(notes).toContain("2.4 months saved, not 2 months free");
    expect(notes).toContain("Excl. VAT — placeholder pending Rob");
  });
});
