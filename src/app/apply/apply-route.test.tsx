import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import ApplyPage from "./page";
import { MarketingHeader } from "@/components/marketing/phase-one";

const launch = vi.hoisted(() => ({ profile: "cohort" }));
vi.mock("@/lib/launch-profile", () => ({
  getLaunchProfile: () => launch.profile,
}));

afterEach(() => {
  launch.profile = "cohort";
});

describe("/apply founding cohort route", () => {
  it("renders the minimal application form with collection-off notice", () => {
    const html = renderToStaticMarkup(<ApplyPage />);
    expect(html).toContain("Apply for the");
    expect(html).toContain("Founding cohort opens 7 December 2026.");
    expect(html).toContain('id="apply-name"');
    expect(html).toContain('id="apply-email"');
    expect(html).toContain('id="apply-company"');
    expect(html).toContain('id="apply-message"');
    expect(html).not.toContain('id="apply-consent"');
    expect(html).not.toContain('name="consent"');
    expect(html).toContain("12-month retention");
    expect(html).not.toContain('id="apply-trade"');
    expect(html).not.toContain('id="apply-team-size"');
    expect(html).toContain("are not collected yet.");
    expect(html).not.toContain("CONSTRUCTA_PUBLIC_FORM_COLLECTION_ENABLED");
    expect(html).toContain('href="/contact"');
    expect(html).toContain('id="founding-cohort-apply-storage-notice"');
    expect(html).toContain("Submission unavailable");
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

  it("keeps the launch date and sign-in separation under the full profile", () => {
    launch.profile = "full";
    const html = renderToStaticMarkup(<ApplyPage />);
    expect(html).toContain("Apply to the founding cohort");
    expect(html).toContain("Founding cohort opens 7 December 2026.");
    expect(html).toContain("not the same as signing in");
    expect(html).toContain('href="/login"');
    expect(html).toContain("are not collected yet.");
    expect(html).toContain('href="/contact"');
    expect(html).toContain("Submission unavailable");
  });

  it("places the collection notice before the form fields", () => {
    const html = renderToStaticMarkup(<ApplyPage />);
    const noticeIndex = html.indexOf('id="founding-cohort-apply-storage-notice"');
    const nameIndex = html.indexOf('id="apply-name"');
    expect(noticeIndex).toBeGreaterThan(-1);
    expect(nameIndex).toBeGreaterThan(noticeIndex);
  });
});