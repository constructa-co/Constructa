import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getLaunchProfile } from "@/lib/launch-profile";

import CustomersPage from "./page";

vi.mock("@/lib/launch-profile", () => ({
  getLaunchProfile: vi.fn(),
}));

function renderCustomers(profile: "cohort" | "full") {
  vi.mocked(getLaunchProfile).mockReturnValue(profile);
  return renderToStaticMarkup(<CustomersPage />);
}

describe("customers preview status (cohort default)", () => {
  beforeEach(() => {
    vi.mocked(getLaunchProfile).mockReturnValue("cohort");
  });

  it("states phase-one review truthfully and routes preview access to pricing", () => {
    const html = renderCustomers("cohort");

    expect(html).toContain("phase-one review");
    expect(html).toContain("not currently offered for live customer work");
    expect(html).toMatch(/href="\/pricing"[^>]*>Preview access/);
    expect(html).toMatch(/href="\/contact"[^>]*>Get in touch/);
    expect(html).not.toContain("Join the waitlist");
    expect(html).not.toMatch(/href="\/"[^>]*>Join the waitlist<\/a>/);
    expect(html).not.toMatch(/now live|try today|first release is now live/i);
  });
});

describe("customers page (full launch profile)", () => {
  it("retains the original early-access copy and both contact and waitlist links", () => {
    const html = renderCustomers("full");

    expect(html).toContain("Early users will help shape the platform. Want in?");
    expect(html).toMatch(/href="\/contact"[^>]*>Get in touch/);
    expect(html).toMatch(/href="\/"[^>]*>Join the waitlist/);
    expect(html).not.toContain("phase-one review");
  });
});
