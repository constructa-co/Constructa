import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PublicChrome from "@/components/public-chrome";
import AboutPage from "./page";

vi.mock("next/image", () => ({
  default: (props: { src: string; alt: string }) => (
    <img src={props.src} alt={props.alt} data-next-image="true" />
  ),
}));

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

  it("states phase-one review truthfully and routes new visitors to apply separate from pricing", () => {
    expect(whatsNext).toContain("phase-one review");
    expect(whatsNext).toContain("not currently offered for live customer work");
    expect(whatsNext).toContain("From here, we&#x27;re expanding into contracts, resource tracking, client comms, and more.");
    expect(whatsNext).toMatch(/href="\/apply"[^>]*>Apply to the founding cohort →<\/a>/);
    expect(whatsNext).toMatch(/href="\/pricing"[^>]*>Preview access →<\/a>/);
    const applyIndex = whatsNext.indexOf('href="/apply"');
    const pricingIndex = whatsNext.indexOf('href="/pricing"');
    expect(applyIndex).toBeGreaterThan(-1);
    expect(pricingIndex).toBeGreaterThan(applyIndex);
    expect(html).not.toMatch(/now live|try today|first release is now live/i);
  });

  it("uses next/image for illustrations and keeps the hero AI disclosure", () => {
    expect(html).toContain("AI-generated illustration. The people shown are not Constructa staff or clients.");
    expect(html).toMatch(/data-next-image="true"/);
    expect((html.match(/data-next-image="true"/g) ?? []).length).toBeGreaterThanOrEqual(6);
  });

  it("makes only supported claims in the stats and pointers sections", () => {
    expect(html).not.toContain("1M+");
    expect(html).not.toContain("60% lose time to admin weekly");
    expect(html).not.toContain("80% still use spreadsheets");
    expect(html).not.toContain("Placeholder");
    expect(html).not.toContain("https://medium.com/");
    expect(html).not.toContain('href="https://linkedin.com/"');
    expect(html).toContain("https://www.linkedin.com/company/constructa-co");
    expect(html).toMatch(/href="\/guides"[^>]*>constructa.co\/guides<\/a>/);
    expect(html).toMatch(/href="\/guides"[^>]*>Read the guides/);
  });
});
