import type { Metadata } from "next";
import { ogBase, ogImage, site } from "@/lib/site";

// 첫 화면 = AI 여행 탐색 앱 (1차: 여행 전 숙소·항공편 찾기와 예약 연결).
// 예전 첫 화면(쇼핑·링크 변환 소개)은 이 화면으로 바뀌었다. 옛 /hotels, /flights 주소는 next.config.ts 에서 이 화면으로 보낸다.
// 앱 자체는 (trip)/layout.tsx 에 있다
const HOME_TITLE = `${site.name} | 대화로 찾는 숙소·항공편`;
const HOME_DESCRIPTION = "가고 싶은 여행을 말하면 AI가 취향에 맞는 숙소와 항공편을 먼저 보여 드려요. 예약처별 세금·수수료 포함 총액을 한 화면에서 확인하세요.";

export const metadata: Metadata = {
  title: { absolute: HOME_TITLE },
  description: HOME_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { title: HOME_TITLE, description: HOME_DESCRIPTION, url: site.url, ...ogBase },
  twitter: { card: "summary_large_image", title: HOME_TITLE, description: HOME_DESCRIPTION, images: [ogImage] },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", "@id": `${site.url}/#website`, url: site.url, name: site.name, description: HOME_DESCRIPTION, inLanguage: "ko-KR" },
    {
      "@type": "Organization",
      "@id": `${site.url}/#organization`,
      name: site.name,
      url: site.url,
      ...(site.contactEmail ? { email: site.contactEmail } : {}),
      ...(site.instagramUrl ? { sameAs: [site.instagramUrl] } : {}),
    },
  ],
};

export default function Home() {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
  );
}
