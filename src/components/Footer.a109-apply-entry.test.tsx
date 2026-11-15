import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import Footer from "./Footer";

vi.mock("@/lib/launch-profile", () => ({ getLaunchProfile: () => "full" }));

describe("A109 full-profile footer apply entry", () => {
  it("lists founding cohort apply before log in under Connect", () => {
    const html = renderToStaticMarkup(<Footer />);
    expect(html).toContain('href="/apply"');
    expect(html).toContain("Apply to the founding cohort");
    expect(html).toContain('href="/login"');
    expect(html).toContain("Log in");
    const applyIndex = html.indexOf('href="/apply"');
    const loginIndex = html.indexOf('href="/login"');
    expect(applyIndex).toBeLessThan(loginIndex);
  });
});