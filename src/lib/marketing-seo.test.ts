import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MARKETING_ROBOTS_DISALLOW_PREFIXES,
  MARKETING_SITEMAP_PATHS,
  marketingAbsoluteUrl,
  marketingIndexingEnabled,
  marketingPageMetadata,
  marketingRobots,
  marketingSitemapEntries,
  marketingSiteOrigin,
} from "./marketing-seo";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("marketing SEO module", () => {
  it("uses NEXT_PUBLIC_APP_URL when set", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://constructa.co/");
    expect(marketingSiteOrigin()).toBe("https://constructa.co");
    expect(marketingAbsoluteUrl("/pricing")).toBe("https://constructa.co/pricing");
  });

  it("falls back to www.constructa.co without env", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    expect(marketingSiteOrigin()).toBe("https://www.constructa.co");
  });

  it("disables indexing on protected review deployments", () => {
    vi.stubEnv("CONSTRUCTA_REVIEW_ONLY", "1");
    expect(marketingIndexingEnabled()).toBe(false);
    expect(marketingSitemapEntries()).toEqual([]);
    expect(marketingRobots()).toEqual({
      rules: { userAgent: "*", disallow: "/" },
    });
  });

  it("lists only explicit marketing paths in the sitemap", () => {
    vi.stubEnv("CONSTRUCTA_REVIEW_ONLY", "0");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.constructa.co");
    const urls = marketingSitemapEntries().map((entry) => entry.url);
    expect(urls).toContain("https://www.constructa.co/");
    expect(urls).toContain("https://www.constructa.co/contact");
    expect(urls).not.toContain("https://www.constructa.co/guides");
    expect(urls).not.toContain("https://www.constructa.co/dashboard");
    expect(MARKETING_SITEMAP_PATHS.every((path) => !path.startsWith("/guides"))).toBe(true);
  });

  it("disallows private and preview routes in robots.txt", () => {
    vi.stubEnv("CONSTRUCTA_REVIEW_ONLY", "0");
    const rules = marketingRobots();
    expect(rules.rules).toMatchObject({
      userAgent: "*",
      allow: "/",
      disallow: [...MARKETING_ROBOTS_DISALLOW_PREFIXES],
    });
    expect(rules.sitemap).toBe("https://www.constructa.co/sitemap.xml");
  });

  it("builds page metadata with canonical, Open Graph and Twitter previews", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.constructa.co");
    const meta = marketingPageMetadata({
      title: "Pricing | Constructa",
      description: "How preview access works.",
      pathname: "/pricing",
    });
    expect(meta.title).toBe("Pricing | Constructa");
    expect(meta.description).toBe("How preview access works.");
    expect(meta.alternates?.canonical).toBe("https://www.constructa.co/pricing");
    expect(meta.openGraph).toMatchObject({
      title: "Pricing | Constructa",
      url: "https://www.constructa.co/pricing",
      siteName: "Constructa",
    });
    expect(meta.twitter).toMatchObject({ card: "summary_large_image" });
    expect(meta.robots).toEqual({ index: true, follow: true });
  });

  it("marks preview routes as noindex when index is false", () => {
    const meta = marketingPageMetadata({
      title: "Guides | Constructa",
      description: "Review checklists.",
      pathname: "/guides",
      index: false,
    });
    expect(meta.robots).toEqual({ index: false, follow: false });
  });
});
