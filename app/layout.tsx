import type { Metadata } from "next";
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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${jua.variable} ${noto.variable}`}>
      <body>{children}</body>
    </html>
  );
}
