import type { MetadataRoute } from "next";
import { brand } from "@/lib/brand";
import { site } from "@/lib/site";

// 웹 앱 매니페스트. Next가 /manifest.webmanifest 로 내보내고 <link rel="manifest">를 자동으로 붙인다
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${brand.appName} | ${site.name}`,
    short_name: brand.appName,
    description: "가고 싶은 여행을 말하면 AI가 취향에 맞는 숙소와 항공편을 먼저 보여 드려요.",
    lang: "ko",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#FFFFFF",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/brand/app-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/app-icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/app-icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
