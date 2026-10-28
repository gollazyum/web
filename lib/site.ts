// 사이트 전역 설정. 인스타그램 주소 등은 여기서만 바꾸면 된다.
export const site = {
  name: "Lowboti",
  nameKo: "로보티",
  url: "https://www.lowboti.com",
  tagline: "가성비를 같이 골라 주는 호텔·항공권 가격 비교",
  description:
    "호텔과 항공권 가격을 여러 예약 사이트에서 실시간으로 비교하고, AI 도우미 로보티와 함께 가성비 좋은 숙소와 항공편을 골라 보세요. 세금·수수료를 포함한 총액으로 비교해요.",
  instagramUrl: "", // [인스타 주소 입력] 예: "https://www.instagram.com/lowboti". 비어 있으면 푸터에 글자만 보인다
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
  siteName: `${site.nameKo} (${site.name})`,
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
