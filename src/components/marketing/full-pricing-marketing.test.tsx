import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import FullPricingPage from "./full-pricing";

describe("full profile pricing page", () => {
  it("does not surface unverified multi-tier prices or testimonial blocks", () => {
    const html = renderToStaticMarkup(<FullPricingPage />);
    expect(html).toContain("Founding cohort pricing");
    expect(html).not.toMatch(/£\s*(20|40|80)\b/);
    expect(html).not.toMatch(/Paddle|14-day free trial/i);
    expect(html).not.toMatch(/testimonial|<blockquote/i);
  });
});