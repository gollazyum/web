// 사이트 전역 설정. 인스타그램 주소 등은 여기서만 바꾸면 된다.
export const site = {
  name: "Gollazyum",
  nameKo: "Gollazyum",
  url: "https://www.lowboti.com",
  tagline: "AI Travel & Lifestyle Platform",
  description:
    "글로벌 트래블 데이터와 AI 라이프스타일 솔루션을 하나로 연결하는 차세대 디지털 플랫폼. 숙소와 항공편의 실시간 데이터를 세금·수수료를 포함한 총액으로 한 화면에서 탐색하세요.",
  instagramUrl: "https://www.instagram.com/lowboti/", // 인스타그램 주소는 여기서만 바꾼다
  contactEmail: "hello@lowboti.com",
  notifyUrl: "", // 오픈 알림 신청 링크. 예: 카카오톡 채널, 구글 폼 주소
  // 첫 화면 안내 문구의 "숨은 예약 경로 N곳". 숫자는 여기서만 바꾼다
  hiddenRouteCount: 37,
  // 푸터 사업자 정보. 실제 값이 정해지면 자리표시를 바꾼다
  business: {
    name: "[상호]",
    ceo: "[대표자]",
    registrationNo: "[사업자등록번호]",
  },
};

// 하위 페이지가 openGraph를 바꾸면 통째로 덮어써지므로 공통 항목을 같이 넣는다
export const ogBase = {
  siteName: site.name,
  images: [{ url: "/images/og-image.png", width: 1200, height: 630 }],
  locale: "ko_KR",
  type: "website" as const,
};

// URL로 어느 예약 사이트의 호텔 링크인지 판별한다
export const supportedSites = [
  { name: "아고다", hosts: ["agoda.com"] },
  { name: "부킹닷컴", hosts: ["booking.com"] },
  { name: "호텔스닷컴", hosts: ["hotels.com"] },
  { name: "익스피디아", hosts: ["expedia.com", "expedia.co.kr"] },
  { name: "트립닷컴", hosts: ["trip.com"] },
];

export function detectSite(input: string): string | null {
  let host: string;
  try {
    host = new URL(input.trim()).hostname.toLowerCase();
  } catch {
    return null;
  }
  const match = supportedSites.find((s) =>
    s.hosts.some((h) => host === h || host.endsWith("." + h)),
  );
  return match ? match.name : null;
}
