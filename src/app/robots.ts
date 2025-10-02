import type { MetadataRoute } from "next";
import { seoDefaults } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = seoDefaults.siteUrl;

  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
