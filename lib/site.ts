// 사이트 전역 설정. 인스타그램 주소 등은 여기서만 바꾸면 된다.
export const site = {
  name: "Lowboti",
  nameKo: "로보티",
  url: "https://www.lowboti.com",
  tagline: "호텔 최저가, 한 번에 비교.",
  description:
    "호텔 링크 하나로 여러 예약 사이트의 가격을 세금·수수료 포함 총액으로 비교해 최저가를 찾아드립니다.",
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
