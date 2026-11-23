import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import FullPricingPage from "./full-pricing";

describe("full profile pricing page", () => {
  it("shows approved GBP tiers as unpublished review copy", () => {
    const html = renderToStaticMarkup(<FullPricingPage />);
    expect(html).toContain("Founding cohort pricing");
    expect(html).toContain("£50");
    expect(html).toContain("£80");
    expect(html).toContain("£37.50");
    expect(html).not.toContain("for Rob to confirm");
    expect(html).not.toMatch(/Paddle|14-day free trial/i);
    expect(html).not.toMatch(/testimonial|<blockquote/i);
  });
});