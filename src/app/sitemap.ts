import type { MetadataRoute } from "next";
import { marketingSitemapEntries } from "@/lib/marketing-seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return marketingSitemapEntries();
}
