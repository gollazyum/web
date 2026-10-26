import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

// /robots.txt: 전체 수집 허용, API 경로만 제외
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: "/api/" }],
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
