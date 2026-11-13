import type { MetadataRoute } from "next";
import { marketingRobots } from "@/lib/marketing-seo";

export default function robots(): MetadataRoute.Robots {
  return marketingRobots();
}
