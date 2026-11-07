import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ApplyPage from "./page";
import { MarketingHeader } from "@/components/marketing/phase-one";

vi.mock("@/lib/launch-profile", () => ({
  getLaunchProfile: () => "cohort",
}));

describe("/apply founding cohort route", () => {
  it("renders the application form with expected fields and TODO notice", () => {
    const html = renderToStaticMarkup(<ApplyPage />);
    expect(html).toContain("Apply for the");
    expect(html).toContain('id="apply-name"');
    expect(html).toContain('id="apply-company"');
    expect(html).toContain('id="apply-email"');
    expect(html).toContain('id="apply-trade"');
    expect(html).toContain('id="apply-team-size"');
    expect(html).toContain('id="apply-note"');
    expect(html).toContain("TODO(A109)");
    expect(html).toContain('href="/login"');
    expect(html).not.toMatch(/formspree|resend|supabase/i);
  });

  it("exposes a header Apply CTA distinct from sign-in", () => {
    const html = renderToStaticMarkup(<MarketingHeader />);
    expect(html).toContain('href="/apply"');
    expect(html).toContain("Apply to the founding cohort");
    expect(html).toContain('href="/login"');
    expect(html).toContain("Sign in");
    const applyIndex = html.indexOf('href="/apply"');
    const signInIndex = html.indexOf('href="/login"');
    expect(applyIndex).toBeGreaterThan(-1);
    expect(signInIndex).toBeGreaterThan(-1);
    expect(applyIndex).toBeLessThan(signInIndex);
  });
});
