import type { MetadataRoute } from "next";
import { seoDefaults } from "@/lib/seo";

const ROUTES = ["/", "/privy-auth", "/execfi"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = `${seoDefaults.siteUrl}/`;

  return ROUTES.map((path) => ({
    url: new URL(path.replace(/^\//, ""), baseUrl).toString(),
    lastModified: new Date(),
  }));
}
