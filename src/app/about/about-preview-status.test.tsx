import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PublicChrome from "@/components/public-chrome";
import AboutPage from "./page";

const route = vi.hoisted(() => ({ pathname: "/about" }));
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({}),
}));

const html = renderToStaticMarkup(<AboutPage />);
const whatsNextAnchor = html.indexOf("not currently offered for live customer work");
expect(whatsNextAnchor, "What's next copy").toBeGreaterThan(-1);
const whatsNext = html.slice(whatsNextAnchor - 400, whatsNextAnchor + 900);

describe("about preview status in What's next", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE", "cohort");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("exposes exactly one main landmark when composed with PublicChrome", () => {
    route.pathname = "/about";
    const markup = renderToStaticMarkup(
      <PublicChrome>
        <AboutPage />
      </PublicChrome>,
    );
    expect((markup.match(/<main\b/g) ?? []).length).toBe(1);
    const mainOpen = markup.indexOf("<main");
    const mainClose = markup.lastIndexOf("</main>");
    const mainContent = markup.slice(mainOpen, mainClose);
    expect(mainContent).toMatch(/<h1[\s>]/);
    expect(mainContent).toContain(
      "Why we built Constructa, and what comes next.",
    );
    expect(mainContent).toMatch(/href="\/pricing"[^>]*>Preview access →<\/a>/);
  });

  it("states phase-one review truthfully and routes preview access to pricing", () => {
    expect(whatsNext).toContain("phase-one review");
    expect(whatsNext).toContain("not currently offered for live customer work");
    expect(whatsNext).toContain("From here, we&#x27;re expanding into contracts, resource tracking, client comms, and more.");
    expect(whatsNext).toMatch(/href="\/pricing"[^>]*>Preview access →<\/a>/);
    expect(html).not.toMatch(/now live|try today|first release is now live/i);
  });
});
