import type { Metadata } from "next";
import Script from "next/script";
import { site } from "@/lib/site";
// 한글 전체가 든 2MB 폰트 대신, 화면에 쓰인 글자 묶음만 받아 오는 분할 폰트
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";

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
    "호텔 가격 비교",
    "항공권 가격 비교",
    "항공권 최저가",
    "호텔 최저가",
    "숙소 비교",
    "AI 여행 도우미",
  ],
  openGraph: {
    title: `${site.nameKo} (${site.name}) - ${site.tagline}`,
    description: "호텔·항공권 가격을 예약 사이트별로 실시간 비교하고, AI 도우미 로보티와 가성비 좋은 선택을 함께 골라요.",
    url: site.url,
    siteName: `${site.nameKo} (${site.name})`,
    images: [{ url: "/images/og-image.png", width: 1200, height: 630 }],
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.nameKo} (${site.name}) - ${site.tagline}`,
    description: "호텔·항공권 가격을 한 화면에서 비교하고, 로보티에게 가성비 좋은 곳을 물어보세요.",
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
    <html lang="ko">
      <body>
        {children}
        {/* Travelpayouts Drive: 제휴 링크 자동 변환 */}
        <Script id="travelpayouts-drive" src="https://emrldtp.com/NTkxMzAz.js?t=591303" strategy="afterInteractive" data-cmp-ab="2" />
      </body>
    </html>
  );
}
