import type { Metadata } from "next";
import Script from "next/script";
import { Noto_Sans_KR } from "next/font/google";
import { site } from "@/lib/site";
import "./globals.css";

const noto = Noto_Sans_KR({ weight: ["400", "500", "700", "900"], subsets: ["latin"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: `${site.name} | 호텔 최저가 비교`,
  description: site.description,
  openGraph: {
    title: `${site.name} · ${site.tagline}`,
    description: site.description,
    url: site.url,
    siteName: site.name,
    images: [{ url: "/images/og-image.png", width: 1200, height: 630 }],
    locale: "ko_KR",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={noto.variable}>
      <body>
        {children}
        {/* Travelpayouts Drive: 제휴 링크 자동 변환 */}
        <Script id="travelpayouts-drive" src="https://emrldtp.com/NTkxMzAz.js?t=591303" strategy="afterInteractive" data-cmp-ab="2" />
      </body>
    </html>
  );
}
