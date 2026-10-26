// 사이트 전역 설정. 인스타그램 주소 등은 여기서만 바꾸면 된다.
export const site = {
  name: "Lowboti",
  nameKo: "로보티",
  url: "https://www.lowboti.com",
  tagline: "아고다 37개 경로 최저가 찾기",
  description:
    "혹시 나만 비싸게 예약하고 있나요? 아고다 호텔 링크만 붙여넣으면 구글지도·카드사·항공사 등 37개 숨은 접속 경로로 한 번에 바꿔 드려요. 경로마다 세금·봉사료 포함 총액을 비교해 보세요.",
  instagramUrl: "", // 예: "https://www.instagram.com/lowboti"
  contactEmail: "", // 예: "hello@lowboti.com"
  notifyUrl: "", // 오픈 알림 신청 링크. 예: 카카오톡 채널, 구글 폼 주소
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
