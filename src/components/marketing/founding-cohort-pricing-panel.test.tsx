import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FoundingCohortPricingPanel } from "./founding-cohort-pricing-panel";

describe("FoundingCohortPricingPanel", () => {
  it("shows founding member discount copy and price tokens without plan tiers", () => {
    const html = renderToStaticMarkup(<FoundingCohortPricingPanel />);
    expect(html).toContain("data-founding-cohort-pricing");
    expect(html).toContain("Founding member discount");
    expect(html).toContain("[ROB TO CONFIRM: founding cohort monthly price]");
    expect(html).toContain('href="/apply"');
    expect(html).not.toMatch(/£\s*(20|40|80)\b/);
    expect(html).not.toMatch(/testimonial|<blockquote/i);
    expect(html).not.toContain("Basic");
    expect(html).not.toContain("Enterprise");
  });
});