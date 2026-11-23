import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FoundingCohortPricingPanel } from "./founding-cohort-pricing-panel";
describe("D91 draft pricing", () => {
 it("renders supplied tiers with pending terms and no checkout", () => {
  const html = renderToStaticMarkup(<FoundingCohortPricingPanel />);
  for (const copy of [
    "Free",
    "Pro",
    "Business",
    "£50",
    "£80",
    "25%",
    "£37.50",
    "Still for owner review before publication",
    "Signup and payment remain off",
    "Applications are not collected yet",
  ])
    expect(html).toContain(copy);
  expect(html).not.toContain("for Rob to confirm");
  expect(html).not.toMatch(/<form|<blockquote/i);
 });
});
