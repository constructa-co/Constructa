import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import FAQ, { faqs } from "./FAQ";

const html = renderToStaticMarkup(<FAQ />);
const allCopy = faqs.map((faq) => `${faq.question} ${faq.answer}`).join(" ");

describe("marketing FAQ copy", () => {
  it("renders every FAQ question in the accordion", () => {
    for (const faq of faqs) {
      expect(html).toContain(faq.question);
    }
  });

  it("describes the phase-one preview truthfully", () => {
    expect(allCopy).toContain("phase-one review");
    expect(allCopy).toContain("founding cohort");
    expect(allCopy).toContain("existing review account");
  });

  it("does not promise trials, subscriptions or unavailable capabilities", () => {
    expect(allCopy).not.toContain("14-day");
    expect(allCopy).not.toMatch(/free trial with full access/i);
    expect(allCopy).not.toContain("AI-powered");
    expect(allCopy).not.toContain("automated reporting");
    expect(allCopy).not.toContain("resource allocation");
    expect(allCopy).not.toMatch(/cancel your subscription at any time/i);
  });
});
