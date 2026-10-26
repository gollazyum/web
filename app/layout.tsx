import type { Metadata } from "next";
import Script from "next/script";
import { Jua, Noto_Sans_KR } from "next/font/google";
import { site } from "@/lib/site";
import "./globals.css";

const jua = Jua({ weight: "400", subsets: ["latin"], variable: "--font-display", display: "swap" });
const noto = Noto_Sans_KR({ weight: ["400", "500", "700", "900"], subsets: ["latin"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: `${site.name} 로보티 | 호텔 최저가 비교`,
  description: site.description,
  openGraph: {
    title: `${site.name} · ${site.tagline}`,
    description: site.description,
    url: site.url,
    siteName: site.name,
    images: ["/images/og-logo.png"],
    locale: "ko_KR",
    type: "website",
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
    <html lang="ko" className={`${jua.variable} ${noto.variable}`}>
      <body>
        {children}
        {/* Travelpayouts Drive: 제휴 링크 자동 변환 */}
        <Script id="travelpayouts-drive" src="https://emrldtp.com/NTkxMzAz.js?t=591303" strategy="afterInteractive" data-cmp-ab="2" />
      </body>
    </html>
  );
}
