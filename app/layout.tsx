import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { ogImage, site } from "@/lib/site";
// 본문 글꼴 Pretendard: 화면에 쓰인 글자 묶음만 받는 분할 폰트 중 굵기 400·700만 (scripts/build-pretendard-css.mjs 로 만든다).
// preload 하지 않고 font-display: swap 이라 폰트가 늦으면 시스템 글꼴(Apple SD Gothic Neo, 맑은 고딕)로 먼저 보인다
import "./pretendard.css";
import "./globals.css";
// 휴대폰(640px 이하) 전용 보정. 기존 스타일 뒤에 불러와 덮어쓴다
import "./mobile.css";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} | ${site.tagline}`,
    template: `%s | ${site.name}`,
  },
  description: site.description,
  keywords: [
    "Gollazyum",
    "AI 여행 플랫폼",
    "호텔 가격 정보",
    "항공권 운임",
    "트래블 데이터",
    "AI 라이프스타일 솔루션",
  ],
  openGraph: {
    title: `${site.name} | ${site.tagline}`,
    description: site.description,
    url: site.url,
    siteName: site.name,
    images: [{ url: ogImage, width: 1200, height: 630 }],
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.name} | ${site.tagline}`,
    description: site.description,
    images: [ogImage],
  },
  verification: {
    google: "uHjh6W2iEsSIUKIJCFAlsYq3pryOirOYMdTrd7VHE4Q",
    other: {
      "naver-site-verification": "4de7869da453307d1edcb0881142e97f375fd1b7",
    },
  },
};

// viewport-fit=cover: 아이폰 홈 인디케이터 여백(safe-area)을 쓸 수 있게
// colorScheme 'only light': 브라우저 자동 다크 모드가 화면과 상품 사진을 어둡게 바꾸지 않게 (LB-067)
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", colorScheme: "only light" };

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
