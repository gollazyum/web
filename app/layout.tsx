import type { Metadata } from "next";
import Script from "next/script";
import localFont from "next/font/local";
import { routes } from "@/lib/agoda";
import { site } from "@/lib/site";
import "./globals.css";

const pretendard = localFont({
  src: "../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  weight: "45 920",
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.nameKo} (${site.name}) - ${site.tagline}`,
    template: `%s | ${site.nameKo} (${site.name})`,
  },
  description: site.description,
  keywords: [
    "로보티",
    "Lowboti",
    "아고다 최저가",
    "아고다 할인 경로",
    "아고다 카드사 할인",
    "구글맵 아고다",
    "호텔 가격 비교",
    "항공권 최저가",
  ],
  openGraph: {
    title: `${site.nameKo} (${site.name}) - 아고다 ${routes.length}개 숨은 경로 최저가 봇`,
    description: "아고다 호텔 링크 하나로 카드사·항공사·검색 경로별 링크를 한 번에 받아 진짜 최저가를 찾아보세요.",
    url: site.url,
    siteName: `${site.nameKo} (${site.name})`,
    images: [{ url: "/images/og-image.png", width: 1200, height: 630 }],
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.nameKo} (${site.name}) - 아고다 ${routes.length}개 경로 최저가 찾기`,
    description: `번거로운 아고다 경로 타기, 이제 로보티에게 맡기세요. 링크만 넣으면 ${routes.length}개 경로를 한 번에 열어 볼 수 있어요.`,
    images: ["/images/og-image.png"],
  },
  verification: {
    google: "uHjh6W2iEsSIUKIJCFAlsYq3pryOirOYMdTrd7VHE4Q",
    other: {
      "naver-site-verification": "4de7869da453307d1edcb0881142e97f375fd1b7",
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body>
        {children}
        {/* Travelpayouts Drive: 제휴 링크 자동 변환 */}
        <Script id="travelpayouts-drive" src="https://emrldtp.com/NTkxMzAz.js?t=591303" strategy="afterInteractive" data-cmp-ab="2" />
      </body>
    </html>
  );
}
