import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import ContactPage from "@/app/contact/page";
import { MarketingFooter } from "./phase-one";

type Element = ReactElement<Record<string, unknown>>;

function nodes(value: unknown): Element[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const element = value as Element;
  return [element, ...nodes(element.props.children)];
}

describe("marketing footer contact navigation", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("routes footer Get in touch to /contact while cohort contact stays mailto-only and full profile keeps the legacy form", () => {
    const footerHtml = renderToStaticMarkup(<MarketingFooter />);
    expect(footerHtml).toContain('href="/contact">Get in touch</a>');
    expect(footerHtml).not.toContain("mailto:hello@constructa.co");

    vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE", "cohort");
    const cohortMarkup = renderToStaticMarkup(ContactPage());
    const cohortElements = nodes(ContactPage());
    expect(cohortElements.filter(e => e.type === "form")).toHaveLength(0);
    expect(cohortElements.filter(e => e.type === "input" || e.type === "textarea" || e.type === "button")).toHaveLength(0);
    expect(cohortMarkup).toContain('href="mailto:hello@constructa.co"');
    expect(cohortMarkup).not.toContain("<form");

    vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE", "full");
    const fullMarkup = renderToStaticMarkup(ContactPage());
    expect(fullMarkup).toContain("Got a question? Want to stay in the loop?");
    expect(fullMarkup).toContain('href="mailto:hello@constructa.co"');
    expect(fullMarkup).toContain('id="contact-message"');
    expect(fullMarkup).toContain("Submission unavailable");
    expect(fullMarkup).not.toContain("formspree");
  });
});
