import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import Header from "./Header";

const route = vi.hoisted(() => ({ pathname: "/product" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));
vi.mock("@/lib/launch-profile", () => ({ getLaunchProfile: () => "full" }));

describe("A109 full-profile marketing header apply entry", () => {
  it.each(["/product", "/pricing", "/features"] as const)(
    "routes the primary header action to /apply and keeps sign-in on /login for %s",
    (pathname) => {
      route.pathname = pathname;
      const html = renderToStaticMarkup(<Header />);
      expect(html).toContain('href="/apply"');
      expect(html).toContain("Apply to the founding cohort");
      expect(html).toContain('href="/login"');
      expect(html).toContain("Log in");
      expect(html).not.toContain("Sign up");
      const applyIndex = html.indexOf('href="/apply"');
      const loginIndex = html.indexOf('href="/login"');
      expect(applyIndex).toBeGreaterThan(-1);
      expect(loginIndex).toBeGreaterThan(-1);
      expect(applyIndex).toBeLessThan(loginIndex);
    },
  );

  it("uses the founding cohort apply link on the landing header instead of waitlist scroll", () => {
    route.pathname = "/landing";
    const html = renderToStaticMarkup(<Header />);
    expect(html).toContain('href="/apply"');
    expect(html).toContain("Apply to the founding cohort");
    expect(html).not.toContain("#waitlist-form");
    expect(html).not.toContain("Join the waitlist");
  });
});