import { brand } from "./brand";
import { siteConfig } from "@/config/siteConfig";

// 사이트 전역 설정. 인스타그램 주소 등은 여기서만 바꾸면 된다. 운영 이름은 lib/brand.ts 의 legalName
export const site = {
  name: brand.legalName,
  nameKo: brand.legalName,
  url: siteConfig.url,
  description: "숙소와 항공권의 예약처별 예상 총액을 한 화면에서 비교하세요(최종 금액은 결제 화면에서 확인). 예약은 이동한 예약 사이트에서 진행돼요.",
  // 홈·약관·개인정보·404 바닥글 문구. 여기서만 바꾼다
  footerIntro: "숙소와 항공권의 예약처별 예상 총액을 한 화면에 모아 보여 드려요(최종 금액은 결제 화면에서 확인).",
  footerAffiliate: "이 사이트의 링크로 예약하시면 제휴사로부터 수수료를 받을 수 있지만, 내시는 금액은 같아요.",
  footerNotice: "예약·결제·취소·환불은 이동한 예약 사이트의 정책에 따라 진행돼요. 표시 가격은 확인한 시각 기준이며 바뀔 수 있어요.",
  instagramUrl: "https://www.instagram.com/gollazyum/", // 인스타그램 주소는 여기서만 바꾼다
  contactEmail: siteConfig.businessInfo.supportEmail,
  notifyUrl: "", // 오픈 알림 신청 링크. 예: 카카오톡 채널, 구글 폼 주소
  // 첫 화면 안내 문구의 "숨은 예약 경로 N곳". 숫자는 여기서만 바꾼다
  hiddenRouteCount: 37,
  // 사업자·개인정보 보호책임자 정보는 config/siteConfig.ts 의 businessInfo 에서만 바꾼다 (지어내지 않는다).
  // 홈 푸터, 사이트 푸터, 이용약관, 개인정보처리방침이 모두 이 값을 쓴다
  business: {
    name: siteConfig.businessInfo.companyName,
    ceo: siteConfig.businessInfo.representative,
    registrationNo: siteConfig.businessInfo.bizRegNumber,
    mailOrderNo: siteConfig.businessInfo.mailOrderNumber,
    address: siteConfig.businessInfo.address,
    privacyOfficer: siteConfig.businessInfo.privacyOfficer,
  },
};

// 하위 페이지가 openGraph를 바꾸면 통째로 덮어써지므로 공통 항목을 같이 넣는다
// 이미지를 바꾸면 v 숫자를 올린다. 카카오톡 등이 옛 미리보기를 캐시해 두기 때문
export const ogImage = "/images/og-image.png?v=2";

export const ogBase = {
  siteName: site.name,
  images: [{ url: ogImage, width: 1200, height: 630 }],
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
