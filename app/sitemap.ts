import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

// 검색엔진(구글 서치 콘솔, 네이버 서치어드바이저)에 제출하는 /sitemap.xml
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: site.url, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${site.url}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
