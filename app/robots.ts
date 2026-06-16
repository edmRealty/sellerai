import type { MetadataRoute } from "next";
import { appBaseUrl } from "@/lib/seo-pages";
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/agent/", "/dashboard/"] }], sitemap: `${appBaseUrl}/sitemap.xml` };
}
