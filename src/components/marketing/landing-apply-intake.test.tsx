import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import FullLandingPage from "./full-landing";
import { NewsletterSignup } from "./newsletter-signup";

vi.mock("next/image", () => ({ default: () => null }));
vi.mock("next/script", () => ({ default: () => null }));

afterEach(() => vi.unstubAllEnvs());

describe("full-profile landing intake (repair #154)", () => {
  it("has a single cohort apply entry and no ConvertKit waitlist intake", () => {
    const html = renderToStaticMarkup(<FullLandingPage />);

    expect(html).toMatch(/href="\/apply"[^>]*>Apply to the founding cohort/);
    expect(html).not.toContain("<form");
    expect(html).not.toContain("convertkit.com");
    expect(html).not.toContain("Join the waitlist");
    expect(html).not.toContain("waitlist-form");
  });

  it("keeps the newsletter form as its own gated scope", () => {
    vi.stubEnv("CONSTRUCTA_NEWSLETTER_SIGNUP_ENABLED", "0");
  vi.stubEnv("CONSTRUCTA_REVIEW_ONLY", "0");
  vi.stubEnv("VERCEL_ENV", "production");
    const preview = renderToStaticMarkup(<NewsletterSignup />);
    expect(preview).toContain("data-newsletter-preview-note");
    expect(preview).not.toContain("convertkit.com");
    expect(preview).not.toContain("<form");

    vi.stubEnv("CONSTRUCTA_NEWSLETTER_SIGNUP_ENABLED", "1");
    vi.stubEnv("CONSTRUCTA_REVIEW_ONLY", "0");
    vi.stubEnv("VERCEL_ENV", "production");
    const html = renderToStaticMarkup(<NewsletterSignup />);
    expect(html).toContain("Subscribe to updates");
    expect(html).toContain("app.convertkit.com/forms/7919715/subscriptions");

    vi.stubEnv("CONSTRUCTA_REVIEW_ONLY", "1");
    expect(renderToStaticMarkup(<NewsletterSignup />)).toBe("");
    vi.stubEnv("CONSTRUCTA_REVIEW_ONLY", "0");
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(renderToStaticMarkup(<NewsletterSignup />)).toBe("");
  });
});
