import type { Metadata, MetadataRoute } from "next";

/** Absolute marketing origin; uses configured app URL when present. */
export function marketingSiteOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw) return raw.replace(/\/+$/, "");
  return "https://www.constructa.co";
}

export const MARKETING_OG_IMAGE_PATH = "/images/hero-image.png";

/** Public marketing routes eligible for sitemap entries (excludes preview-only guides). */
export const MARKETING_SITEMAP_PATHS = [
  "/",
  "/landing",
  "/about",
  "/apply",
  "/contact",
  "/pricing",
  "/features",
  "/product",
  "/customers",
  "/privacy-policy",
  "/terms-of-service",
] as const;

/** Paths that must stay non-indexable regardless of marketing SEO defaults. */
export const MARKETING_ROBOTS_DISALLOW_PREFIXES = [
  "/dashboard",
  "/admin",
  "/login",
  "/onboarding",
  "/auth",
  "/proposal",
  "/supervisor",
  "/api",
  "/offline",
  "/guides",
] as const;

export function marketingIndexingEnabled(): boolean {
  return process.env.CONSTRUCTA_REVIEW_ONLY !== "1"
    && (!process.env.VERCEL_ENV || process.env.VERCEL_ENV === "production");
}

export function marketingAbsoluteUrl(pathname: string): string {
  const origin = marketingSiteOrigin();
  if (pathname === "/" || pathname === "") return `${origin}/`;
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${origin}${path}`;
}

type MarketingPageSeoInput = {
  title: string;
  description: string;
  pathname: string;
  /** When false, page is public but should not be indexed (e.g. preview guides). */
  index?: boolean;
};

export function marketingPageMetadata({
  title,
  description,
  pathname,
  index = true,
}: MarketingPageSeoInput): Metadata {
  const canonical = marketingAbsoluteUrl(pathname);
  const allowIndex = index && marketingIndexingEnabled();

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "Constructa",
      locale: "en_GB",
      type: "website",
      images: [
        {
          url: MARKETING_OG_IMAGE_PATH,
          alt: "Constructa",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [MARKETING_OG_IMAGE_PATH],
    },
    robots: allowIndex
      ? { index: true, follow: true }
      : { index: false, follow: false },
  };
}

/** Root layout defaults: metadata base and shared social preview fallbacks. */
export function marketingRootMetadata(): Pick<Metadata, "metadataBase" | "openGraph" | "twitter"> {
  return {
    metadataBase: new URL(marketingSiteOrigin()),
    openGraph: {
      siteName: "Constructa",
      locale: "en_GB",
      type: "website",
      images: [
        {
          url: MARKETING_OG_IMAGE_PATH,
          alt: "Constructa",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      images: [MARKETING_OG_IMAGE_PATH],
    },
  };
}

export function marketingRobots(): MetadataRoute.Robots {
  if (!marketingIndexingEnabled()) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [...MARKETING_ROBOTS_DISALLOW_PREFIXES],
    },
    sitemap: marketingAbsoluteUrl("/sitemap.xml"),
  };
}

export function marketingSitemapEntries(): MetadataRoute.Sitemap {
  if (!marketingIndexingEnabled()) return [];

  const lastModified = new Date("2026-11-13");

  return MARKETING_SITEMAP_PATHS.map((pathname) => ({
    url: marketingAbsoluteUrl(pathname),
    lastModified,
    changeFrequency: "weekly" as const,
    priority: pathname === "/" || pathname === "/landing" ? 1 : 0.7,
  }));
}
