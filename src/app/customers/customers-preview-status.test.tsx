import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PublicChrome from "@/components/public-chrome";
import { getLaunchProfile } from "@/lib/launch-profile";

import CustomersPage from "./page";

const route = vi.hoisted(() => ({ pathname: "/customers" }));
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({}),
}));

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

  it("exposes exactly one main landmark when composed with PublicChrome", () => {
    route.pathname = "/customers";
    vi.mocked(getLaunchProfile).mockReturnValue("cohort");
    const markup = renderToStaticMarkup(
      <PublicChrome>
        <CustomersPage />
      </PublicChrome>,
    );
    expect((markup.match(/<main\b/g) ?? []).length).toBe(1);
    const mainOpen = markup.indexOf("<main");
    const mainClose = markup.lastIndexOf("</main>");
    const mainContent = markup.slice(mainOpen, mainClose);
    expect(mainContent).toContain("Built for builders—not admins");
    expect(mainContent).toMatch(/<h1[\s>]/);
    expect(mainContent).toMatch(/href="\/contact"[^>]*>Get in touch/);
    expect(mainContent).toMatch(/href="\/pricing"[^>]*>Preview access/);
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

  it("exposes exactly one main landmark when composed with PublicChrome", () => {
    route.pathname = "/customers";
    vi.mocked(getLaunchProfile).mockReturnValue("full");
    const markup = renderToStaticMarkup(
      <PublicChrome>
        <CustomersPage />
      </PublicChrome>,
    );
    expect((markup.match(/<main\b/g) ?? []).length).toBe(1);
    const mainOpen = markup.indexOf("<main");
    const mainClose = markup.lastIndexOf("</main>");
    const mainContent = markup.slice(mainOpen, mainClose);
    expect(mainContent).toContain("Built for builders—not admins");
    expect(mainContent).toMatch(/<h1[\s>]/);
    expect(mainContent).toMatch(/href="\/contact"[^>]*>Get in touch/);
    expect(mainContent).toMatch(/href="\/"[^>]*>Join the waitlist/);
  });
});
